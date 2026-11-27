"""FFmpeg 합성: 장면 클립(켄번스 + 상단 타이틀) → 이어붙이기 → 자막 번인 + 내레이션/BGM(덕킹) 믹스 → final.mp4."""
from __future__ import annotations

import json
import logging
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf

log = logging.getLogger(__name__)
SR = 44100


def run_ffmpeg(args: list[str]) -> None:
    from ..tools import tool
    proc = subprocess.run([tool("ffmpeg"), "-y", "-hide_banner", "-loglevel", "error", *args], capture_output=True,
                          text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg 실패: {proc.stderr[-1500:]}")


# ---------------------------------------------------------------- 영상
CARTOON_FILTER = (  # 색 단순화 + 검은 외곽선 → 만화 느낌 (속도 위해 절반 해상도에서 처리 후 확대)
    "scale=iw/2:ih/2,split[ca][cb];[cb]median=radius=2,lutrgb=r='floor(val/40)*40+20':g='floor(val/40)*40+20':"
    "b='floor(val/40)*40+20',eq=saturation=1.5:contrast=1.08,format=gbrp[cp];"
    "[ca]edgedetect=low=0.04:high=0.12,negate,erosion,format=gbrp[ce];"
    "[cp][ce]blend=all_mode=multiply,scale=iw*2:ih*2:flags=bicubic")


def _style_chain(w: int, h: int, style: str, cartoonize: bool) -> str:
    """배경 영상 뒤에 붙는 스타일 효과 (쉼표로 시작)."""
    chain = ""
    if cartoonize:
        chain += "," + CARTOON_FILTER
    if style == "dynamic":  # 장면 시작 0.25초 흔들림 → 빠른 전환 느낌
        sw, sh = int(w * 1.04) // 2 * 2, int(h * 1.04) // 2 * 2
        chain += (f",scale={sw}:{sh},crop={w}:{h}:x='(iw-ow)/2+if(lt(t,0.25),18*sin(t*70),0)'"
                  f":y='(ih-oh)/2+if(lt(t,0.25),12*cos(t*60),0)'")
    return chain


def render_scene(image: Path, overlay: Path, duration: float, out: Path, idx: int,
                 size: tuple[int, int] = (1080, 1920), fps: int = 30, kind: str = "image",
                 style: str = "classic", cartoonize: bool = False) -> None:
    w, h = size
    n = max(int(round(duration * fps)), 1)
    fx = _style_chain(w, h, style, cartoonize)
    # 오버레이(제목·카드)는 장면 시작에 0.25초 페이드 인 → 툭 튀어나오는 느낌
    ov = "[1:v]format=rgba,fade=in:st=0:d=0.25:alpha=1[ov];" if style != "classic" else "[1:v]null[ov];"
    if kind == "video":
        # 실제 촬영 클립: 9:16 로 꽉 차게 크롭, 짧으면 반복, 원본 오디오 제거, 살짝 줌인으로 움직임 보강
        fc = (f"{ov}[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps={fps},"
              f"scale=w='{w}*(1+0.06*t/{max(duration, 0.1):.3f})':h=-2:eval=frame,crop={w}:{h}{fx},setsar=1[bg];"
              f"[bg][ov]overlay=0:0,format=yuv420p[v]")
        run_ffmpeg(["-stream_loop", "-1", "-i", str(image), "-loop", "1", "-i", str(overlay), "-filter_complex", fc,
                    "-map", "[v]", "-an", "-frames:v", str(n), "-r", str(fps), "-c:v", "libx264",
                    "-preset", "veryfast", "-crf", "18", str(out)])
        return
    sw, sh = int(w * 1.5) // 2 * 2, int(h * 1.5) // 2 * 2  # 업스케일 후 zoompan → 떨림 감소
    motion = idx % 4
    if motion == 0:  # 중앙 줌인
        z, x, y = f"1+0.12*on/{n}", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    elif motion == 1:  # 줌아웃
        z, x, y = f"1.12-0.12*on/{n}", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    elif motion == 2:  # 좌→우 팬
        z, x, y = "1.12", f"(iw-iw/zoom)*on/{n}", "ih/2-(ih/zoom/2)"
    else:  # 아래→위 팬
        z, x, y = "1.12", "iw/2-(iw/zoom/2)", f"(ih-ih/zoom)*(1-on/{n})"
    fc = (f"{ov}[0:v]scale={sw}:{sh},zoompan=z='{z}':x='{x}':y='{y}':d={n}:s={w}x{h}:fps={fps}{fx},setsar=1[bg];"
          f"[bg][ov]overlay=0:0,format=yuv420p[v]")
    run_ffmpeg(["-loop", "1", "-i", str(image), "-loop", "1", "-i", str(overlay), "-filter_complex", fc,
                "-map", "[v]", "-frames:v", str(n), "-r", str(fps), "-c:v", "libx264", "-preset", "veryfast",
                "-crf", "18", str(out)])


def concat_videos(parts: list[Path], out: Path) -> None:
    lst = out.with_suffix(".txt")
    lst.write_text("".join(f"file '{p.resolve().as_posix()}'\n" for p in parts), encoding="utf-8")
    run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)])


def filter_path(p: Path) -> str:
    """ffmpeg 필터 인자용 경로 (Windows 드라이브 문자 C: 의 콜론·역슬래시 이스케이프)."""
    return Path(p).resolve().as_posix().replace(":", r"\:").replace("'", r"\'")


# ---------------------------------------------------------------- 오디오
@dataclass
class Segment:
    start: float
    end: float


def speech_segments(word_times: list[tuple[float, float]], merge_gap: float = 0.3) -> list[Segment]:
    segs: list[Segment] = []
    for s, e in sorted(word_times):
        if segs and s - segs[-1].end <= merge_gap:
            segs[-1].end = max(segs[-1].end, e)
        else:
            segs.append(Segment(s, e))
    return segs


def duck_envelope(n: int, segments: list[Segment], duck_db: float, ramp: float = 0.12) -> np.ndarray:
    """말하는 구간은 duck_db 만큼 감소, 문장 사이 공백에서는 원래 레벨로 부드럽게 복귀."""
    mask = np.zeros(n, dtype=np.float32)
    for sg in segments:
        mask[max(int(sg.start * SR), 0): min(int(sg.end * SR), n)] = 1
    k = max(int(ramp * SR), 1)
    mask = np.convolve(mask, np.ones(k, dtype=np.float32) / k, mode="same")
    duck = 10 ** (duck_db / 20)
    return 1 - (1 - duck) * np.clip(mask, 0, 1)


def _rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x ** 2))) if x.size else 0.0


def mix_audio(narration: Path, bgm: Path | None, segments: list[Segment], out: Path, total: float,
              bgm_volume: float, duck_db: float) -> dict:
    """bgm_volume: '말하는 동안' BGM RMS 가 내레이션 RMS 의 몇 배인지 (0.08 ≈ -22dB). 공백에선 |duck_db| 만큼 올라온다."""
    n = int(round(total * SR))
    voice, sr = sf.read(str(narration), dtype="float32", always_2d=True)
    assert sr == SR
    voice = voice.mean(axis=1)
    voice = voice[:n] if len(voice) >= n else np.pad(voice, (0, n - len(voice)))
    active = np.abs(voice) > 1e-3
    v_rms = _rms(voice[active]) or 1e-6
    voice *= 10 ** (-18 / 20) / v_rms  # 내레이션 -18 dBFS RMS 로 정규화
    mix = np.stack([voice, voice], axis=1)
    info = {"bgm": False}
    if bgm is not None:
        music, sr = sf.read(str(bgm), dtype="float32", always_2d=True)
        if music.shape[1] == 1:
            music = np.repeat(music, 2, axis=1)
        music = music[:n] if len(music) >= n else np.pad(music, ((0, n - len(music)), (0, 0)))
        m_rms = _rms(music) or 1e-6
        speaking_level = bgm_volume * 10 ** (-18 / 20)
        gain = speaking_level / (m_rms * 10 ** (duck_db / 20))  # 덕킹된 상태에서 speaking_level 이 되도록
        env = duck_envelope(n, segments, duck_db)
        mix += music * gain * env[:, None]
        info = {"bgm": True, "bgm_gain": round(gain, 4), "duck_db": duck_db}
    peak = float(np.max(np.abs(mix))) or 1e-9
    if peak > 0.95:
        mix *= 0.95 / peak
    sf.write(str(out), mix, SR, subtype="PCM_16")
    return info


def sfx(kind: str) -> np.ndarray:
    """직접 합성한 효과음 (저작권 걱정 없음). whoosh: 휙 / pop: 뽁."""
    rng = np.random.default_rng(7)
    if kind == "pop":
        n = int(0.12 * SR)
        t = np.arange(n) / SR
        f = 700 + 900 * t / t[-1]
        return (0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30)).astype(np.float32)
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n).astype(np.float32)
    k = np.clip((8 + 40 * t / t[-1]).astype(int), 1, 64)  # 점점 밝아지는 바람 소리
    out = np.empty(n, dtype=np.float32)
    acc = np.cumsum(np.concatenate([[0], noise]))
    for i in range(n):
        j = max(0, i - k[i])
        out[i] = (acc[i + 1] - acc[j]) / (i + 1 - j)
    env = np.sin(np.pi * t / t[-1]) ** 2
    return (out * env * 2.5).astype(np.float32)


def add_sfx(mix_path: Path, times: list[float], kind: str, gain_db: float = -10) -> None:
    """장면 전환 시점에 효과음 얹기."""
    audio, sr = sf.read(str(mix_path), dtype="float32", always_2d=True)
    s = sfx(kind)
    s = s / (np.max(np.abs(s)) or 1) * 10 ** (gain_db / 20)
    for t in times:
        a = max(int((t - (0.15 if kind == "whoosh" else 0)) * sr), 0)
        b = min(a + len(s), len(audio))
        if b > a:
            audio[a:b] += s[: b - a, None]
    peak = float(np.max(np.abs(audio))) or 1
    if peak > 0.98:
        audio *= 0.98 / peak
    sf.write(str(mix_path), audio, sr, subtype="PCM_16")


# ---------------------------------------------------------------- 최종
def finalize(video: Path, audio: Path, out: Path, total: float, ass: Path | None, fonts_dir: Path | None,
             fps: int = 30, progress_bar: bool = False, size: tuple[int, int] = (1080, 1920)) -> None:
    vf = "null"
    if ass is not None:
        vf = f"ass='{filter_path(ass)}'" + (f":fontsdir='{filter_path(fonts_dir)}'" if fonts_dir else "")
    video_fc = f"[0:v]{vf},format=yuv420p[v]"
    if progress_bar:  # 화면 맨 아래 노란 진행 막대 (왼쪽에서 오른쪽으로 차오름)
        video_fc = (f"[0:v]{vf}[v0];color=c=0xFFD400:s={size[0]}x14:r={fps}[bar];"
                    f"[v0][bar]overlay=x='-W+W*t/{max(total, 0.1):.3f}':y=H-14:shortest=1,format=yuv420p[v]")
    run_ffmpeg(["-i", str(video), "-i", str(audio), "-filter_complex",
                f"{video_fc};[1:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample={SR}[a]",
                "-map", "[v]", "-map", "[a]", "-t", f"{total:.3f}", "-r", str(fps),
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "192k",
                "-movflags", "+faststart", str(out)])


def probe(path: Path) -> dict:
    from ..tools import tool
    out = subprocess.run([tool("ffprobe"), "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
                          "-of", "json", str(path)], capture_output=True, text=True, check=True).stdout
    data = json.loads(out)
    v = next((s for s in data["streams"] if s["codec_type"] == "video"), {})
    has_audio = any(s["codec_type"] == "audio" for s in data["streams"])
    vd = subprocess.run([tool("ffmpeg"), "-hide_banner", "-i", str(path), "-af", "volumedetect", "-vn", "-f", "null", "-"],
                        capture_output=True, text=True).stderr
    mx = re.search(r"max_volume: (-?[\d.]+) dB", vd)
    mean = re.search(r"mean_volume: (-?[\d.]+) dB", vd)
    return {"duration": float(data["format"]["duration"]), "width": v.get("width"), "height": v.get("height"),
            "has_audio": has_audio, "max_volume_db": float(mx.group(1)) if mx else None,
            "mean_volume_db": float(mean.group(1)) if mean else None}


def validate(info: dict, max_seconds: float, size: tuple[int, int]) -> list[str]:
    errs = []
    if info["duration"] > max_seconds + 0.05:
        errs.append(f"길이 초과 {info['duration']:.2f}s > {max_seconds}s")
    if (info["width"], info["height"]) != tuple(size):
        errs.append(f"해상도 {info['width']}x{info['height']} != {size[0]}x{size[1]}")
    if not info["has_audio"]:
        errs.append("오디오 없음")
    elif info["max_volume_db"] is None or info["max_volume_db"] > 0.0:
        errs.append(f"오디오 클리핑 의심 (peak {info['max_volume_db']} dB)")
    elif info["mean_volume_db"] is not None and info["mean_volume_db"] < -50:
        errs.append(f"오디오가 거의 무음 (mean {info['mean_volume_db']} dB)")
    return errs
