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
    proc = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args], capture_output=True,
                          text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg 실패: {proc.stderr[-1500:]}")


# ---------------------------------------------------------------- 영상
def render_scene(image: Path, overlay: Path, duration: float, out: Path, idx: int,
                 size: tuple[int, int] = (1080, 1920), fps: int = 30) -> None:
    w, h = size
    n = max(int(round(duration * fps)), 1)
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
    fc = (f"[0:v]scale={sw}:{sh},zoompan=z='{z}':x='{x}':y='{y}':d={n}:s={w}x{h}:fps={fps},setsar=1[bg];"
          f"[bg][1:v]overlay=0:0,format=yuv420p[v]")
    run_ffmpeg(["-loop", "1", "-i", str(image), "-i", str(overlay), "-filter_complex", fc, "-map", "[v]",
                "-frames:v", str(n), "-r", str(fps), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                str(out)])


def concat_videos(parts: list[Path], out: Path) -> None:
    lst = out.with_suffix(".txt")
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in parts), encoding="utf-8")
    run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)])


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


# ---------------------------------------------------------------- 최종
def finalize(video: Path, audio: Path, out: Path, total: float, ass: Path | None, fonts_dir: Path | None,
             fps: int = 30) -> None:
    vf = "null"
    if ass is not None:
        esc = str(ass.resolve()).replace("\\", "/").replace(":", r"\:").replace("'", r"\'")
        vf = f"ass='{esc}'" + (f":fontsdir='{fonts_dir}'" if fonts_dir else "")
    run_ffmpeg(["-i", str(video), "-i", str(audio), "-filter_complex",
                f"[0:v]{vf},format=yuv420p[v];[1:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample={SR}[a]",
                "-map", "[v]", "-map", "[a]", "-t", f"{total:.3f}", "-r", str(fps),
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "192k",
                "-movflags", "+faststart", str(out)])


def probe(path: Path) -> dict:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
                          "-of", "json", str(path)], capture_output=True, text=True, check=True).stdout
    data = json.loads(out)
    v = next((s for s in data["streams"] if s["codec_type"] == "video"), {})
    has_audio = any(s["codec_type"] == "audio" for s in data["streams"])
    vd = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "volumedetect", "-vn", "-f", "null", "-"],
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
