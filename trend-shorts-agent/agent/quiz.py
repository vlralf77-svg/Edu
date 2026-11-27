"""🧩 어린이 '그림자 퀴즈' 영상: 실루엣(문제) → 3·2·1 → 컬러 이미지 + 정답 공개, 약 10문제.

저작권 안전:
- 자동 모드는 동물·공룡·탈것·바다 생물·과일처럼 저작권이 없는 대상만 쓰고, 이미지는 무료 상업 이용 가능한
  Pixabay(벡터·일러스트·사진) 또는 자유 라이선스 Wikimedia Commons 에서만 가져온다 (출처는 설명란에 표기).
- 인기 캐릭터(티니핑·뽀로로·포켓몬 등)는 저작권·상표가 있어 자동 수집·AI 생성하지 않는다.
  직접 만들었거나 사용 허락을 받은 캐릭터 이미지는 '내 이미지' 모드로 올려서 만들 수 있다.
"""
from __future__ import annotations

import json
import logging
import random
import re
import subprocess
from datetime import datetime
from pathlib import Path

import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFilter

from .production import composer
from .production.fonts import font
from .tools import tool

log = logging.getLogger(__name__)
SR = 44100

THEMES: dict[str, tuple[str, list[tuple[str, str]]]] = {
    "animals": ("동물", [("펭귄", "penguin"), ("기린", "giraffe"), ("코끼리", "elephant"), ("사자", "lion"),
                       ("토끼", "rabbit"), ("고양이", "cat"), ("강아지", "puppy"), ("판다", "panda"), ("코알라", "koala"),
                       ("원숭이", "monkey"), ("얼룩말", "zebra"), ("호랑이", "tiger"), ("곰", "bear"), ("여우", "fox"),
                       ("부엉이", "owl"), ("거북이", "turtle"), ("하마", "hippopotamus"), ("낙타", "camel"),
                       ("다람쥐", "squirrel"), ("캥거루", "kangaroo")]),
    "dinosaurs": ("공룡", [("티라노사우루스", "tyrannosaurus"), ("트리케라톱스", "triceratops"),
                         ("스테고사우루스", "stegosaurus"), ("브라키오사우루스", "brachiosaurus"),
                         ("프테라노돈", "pteranodon"), ("안킬로사우루스", "ankylosaurus"), ("벨로키랍토르", "velociraptor"),
                         ("스피노사우루스", "spinosaurus"), ("파라사우롤로푸스", "parasaurolophus"),
                         ("파키케팔로사우루스", "pachycephalosaurus"), ("디플로도쿠스", "diplodocus")]),
    "vehicles": ("탈것", [("소방차", "fire truck"), ("경찰차", "police car"), ("구급차", "ambulance"),
                        ("굴착기", "excavator"), ("버스", "bus"), ("기차", "train"), ("비행기", "airplane"),
                        ("헬리콥터", "helicopter"), ("배", "ship"), ("자전거", "bicycle"), ("트랙터", "tractor"),
                        ("오토바이", "motorcycle"), ("로켓", "rocket"), ("잠수함", "submarine")]),
    "sea": ("바다 생물", [("상어", "shark"), ("고래", "whale"), ("문어", "octopus"), ("해파리", "jellyfish"),
                       ("불가사리", "starfish"), ("바다거북", "sea turtle"), ("게", "crab"), ("해마", "seahorse"),
                       ("가오리", "stingray"), ("물개", "seal"), ("돌고래", "dolphin"), ("새우", "shrimp")]),
    "fruits": ("과일", [("사과", "apple"), ("바나나", "banana"), ("딸기", "strawberry"), ("포도", "grapes"),
                      ("수박", "watermelon"), ("파인애플", "pineapple"), ("체리", "cherry"), ("레몬", "lemon"),
                      ("복숭아", "peach"), ("키위", "kiwi fruit"), ("배", "pear"), ("당근", "carrot")]),
}
W, H = 1080, 1920
Q_SEC, A_SEC, INTRO, OUTRO = 3.0, 2.2, 2.4, 3.0
BG = [((255, 214, 102), (255, 145, 77)), ((140, 220, 255), (90, 140, 255)), ((180, 240, 160), (60, 190, 140)),
      ((255, 180, 220), (190, 120, 255))]


# ---------------------------------------------------------------- 이미지
def make_silhouette(img: Image.Image) -> tuple[Image.Image, str]:
    """투명 배경·흰 배경이면 그림자(실루엣), 아니면 모자이크로 가리기. (이미지, 'silhouette'|'mosaic')"""
    img = img.convert("RGBA")
    a = np.array(img).astype(np.int16)
    alpha = a[..., 3]
    if (alpha < 20).mean() > 0.15:
        mask = alpha > 40
    else:
        corners = np.concatenate([a[:20, :20, :3].reshape(-1, 3), a[:20, -20:, :3].reshape(-1, 3),
                                  a[-20:, :20, :3].reshape(-1, 3), a[-20:, -20:, :3].reshape(-1, 3)])
        bg = corners.mean(axis=0)
        if corners.std(axis=0).max() < 18 and bg.mean() > 200:
            mask = np.abs(a[..., :3] - bg).sum(axis=2) > 60
        else:
            small = img.resize((max(img.width // 28, 1), max(img.height // 28, 1)), Image.BILINEAR)
            return small.resize(img.size, Image.NEAREST), "mosaic"
    if mask.mean() < 0.03:
        small = img.resize((max(img.width // 28, 1), max(img.height // 28, 1)), Image.BILINEAR)
        return small.resize(img.size, Image.NEAREST), "mosaic"
    m = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    sil = Image.new("RGBA", img.size, (35, 35, 75, 255))
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(sil, (0, 0), m)
    return out, "silhouette"


def _bg(i: int) -> Image.Image:
    c1, c2 = BG[i % len(BG)]
    grad = Image.linear_gradient("L").resize((W, H))
    img = Image.composite(Image.new("RGB", (W, H), c2), Image.new("RGB", (W, H), c1), grad).convert("RGBA")
    d = ImageDraw.Draw(img)
    rng = random.Random(i)
    for _ in range(14):  # 동글동글 배경 무늬
        r = rng.randint(30, 110)
        x, y = rng.randint(0, W), rng.randint(0, H)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, 45))
    return img


def _fit(img: Image.Image, box: int) -> Image.Image:
    img = img.convert("RGBA")
    s = box / max(img.width, img.height)
    return img.resize((max(int(img.width * s), 1), max(int(img.height * s), 1)), Image.LANCZOS)


def _center_text(d: ImageDraw.ImageDraw, y: int, text: str, size: int, fill, stroke=(40, 30, 20), sw=6):
    f = font(size)
    tw = d.textlength(text, font=f)
    d.text(((W - tw) / 2, y), text, font=f, fill=fill, stroke_width=sw, stroke_fill=stroke)


def _panel(img: Image.Image, pic: Image.Image) -> None:
    box = 820
    x0, y0 = (W - box) // 2 - 30, 520
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((x0, y0, x0 + box + 60, y0 + box + 60), 60, fill=(255, 255, 255, 235),
                        outline=(40, 30, 20, 255), width=8)
    p = _fit(pic, box)
    img.alpha_composite(p, ((W - p.width) // 2, y0 + 30 + (box - p.height) // 2))


def question_frames(i: int, n: int, sil: Image.Image, label: str) -> list[Image.Image]:
    frames = []
    for c in (3, 2, 1):
        img = _bg(i)
        d = ImageDraw.Draw(img)
        _center_text(d, 170, f"{i + 1}번 문제", 96, (255, 255, 255))
        _center_text(d, 300, "그림자의 주인공은 누구일까요?" if label == "그림자" else "누구일까요?", 76, (255, 255, 255))
        _panel(img, sil)
        d = ImageDraw.Draw(img)
        d.ellipse((W / 2 - 110, 1460, W / 2 + 110, 1680), fill=(230, 33, 23, 255), outline=(255, 255, 255, 255), width=10)
        _center_text(d, 1490, str(c), 140, (255, 255, 255), sw=0)
        _center_text(d, 1760, f"{i + 1} / {n}", 56, (255, 255, 255))
        frames.append(img)
    return frames


def answer_frame(i: int, n: int, pic: Image.Image, answer: str) -> Image.Image:
    img = _bg(i)
    d = ImageDraw.Draw(img)
    rng = random.Random(i * 7)
    for _ in range(40):  # 색종이
        x, y = rng.randint(0, W), rng.randint(0, 480)
        col = rng.choice([(255, 80, 80), (80, 200, 255), (255, 220, 60), (120, 230, 120), (220, 120, 255)])
        d.rectangle((x, y, x + 18, y + 30), fill=col + (255,))
    _center_text(d, 200, "정답!", 120, (255, 240, 80))
    _panel(img, pic)
    d = ImageDraw.Draw(img)
    f = font(120)
    tw = d.textlength(answer, font=f)
    d.rounded_rectangle(((W - tw) / 2 - 60, 1470, (W + tw) / 2 + 60, 1650), 80, fill=(255, 230, 80, 255),
                        outline=(40, 30, 20, 255), width=8)
    d.text(((W - tw) / 2, 1488), answer, font=f, fill=(40, 30, 20))
    _center_text(d, 1760, f"{i + 1} / {n}", 56, (255, 255, 255))
    return img


def title_frame(theme_label: str, n: int, end: bool, cta: str = "") -> Image.Image:
    img = _bg(0 if not end else 3)
    d = ImageDraw.Draw(img)
    if not end:
        _center_text(d, 640, f"{theme_label} 그림자 퀴즈!", 110, (255, 255, 255))
        _center_text(d, 820, f"{n}문제 다 맞힐 수 있을까?", 80, (255, 240, 80))
        _center_text(d, 1050, "?", 360, (255, 255, 255), sw=10)
    else:
        _center_text(d, 700, "몇 개 맞혔나요?", 110, (255, 255, 255))
        _center_text(d, 880, "댓글 대신 가족에게 자랑해 봐요!" if not cta else cta, 60, (255, 240, 80))
        _center_text(d, 1100, "또 만나요~", 120, (255, 255, 255))
    return img


# ---------------------------------------------------------------- 문항 수집
def collect_items(theme: str, count: int, out_dir: Path, clients: dict | None = None, seed: int | None = None) -> list[dict]:
    from .production.visuals import CommonsSearch, StockPhotoSearch
    label, pool = THEMES[theme]
    rng = random.Random(seed)
    pool = pool[:]
    rng.shuffle(pool)
    clients = clients or {}
    order = ["pixabay_vector", "pixabay_illust", "pixabay", "commons"]
    items = []
    for ko, en in pool:
        if len(items) >= count:
            break
        for src in order:
            c = clients.get(src) or (CommonsSearch() if src == "commons" else StockPhotoSearch(src))
            clients[src] = c
            try:
                cands = c.search(en if src == "commons" else f"{en} cartoon" if src != "pixabay" else en)
            except Exception as e:  # noqa: BLE001
                log.warning("%s 검색 실패(%s): %s", src, en, e)
                continue
            if not cands:
                continue
            cand = cands[0]
            try:
                img = c.download_image(cand["url"])
            except Exception as e:  # noqa: BLE001
                log.warning("이미지 받기 실패(%s): %s", en, e)
                continue
            path = out_dir / f"item_{len(items):02d}.png"
            img.convert("RGBA").save(path)
            items.append({"answer": ko, "query": en, "image": str(path), "source": cand.get("source", src),
                          "author": cand.get("author", ""), "page": cand.get("page", ""),
                          "license": cand.get("license", ""), "title": cand.get("title", "")})
            log.info("문제 %d: %s (%s)", len(items), ko, src)
            break
    return items


def items_from_folder(folder: Path, count: int) -> list[dict]:
    """'정답이름.png' 형식의 내 이미지들 → 문항. (직접 만들었거나 사용 허락을 받은 이미지만)"""
    files = sorted(p for p in folder.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"))
    items = []
    for p in files[:count]:
        answer = re.sub(r"[_\-]+", " ", p.stem).strip()
        answer = re.sub(r"^\d+\s*", "", answer) or p.stem   # '01_펭귄' → '펭귄'
        items.append({"answer": answer, "image": str(p), "source": "user", "license": "사용자 제공(권리 보유 확인)"})
    return items


# ---------------------------------------------------------------- 영상 만들기
def build_quiz_video(items: list[dict], theme_label: str, out_dir: Path, settings, tts=None) -> dict:
    from .production.bgm.generator import generate_bgm, seed_for
    from .production.tts.base import get_provider
    p = settings.production
    out_dir.mkdir(parents=True, exist_ok=True)
    work = out_dir / "work"
    work.mkdir(exist_ok=True)
    n = len(items)
    if n < 3:
        raise RuntimeError(f"퀴즈 문제를 {n}개밖에 못 만들었습니다 (최소 3개). Pixabay 키를 넣거나 다른 주제를 골라 보세요.")
    # 1) 화면 (정지 이미지 + 길이)
    frames: list[tuple[Image.Image, float]] = [(title_frame(theme_label, n, False), INTRO)]
    modes = []
    for i, it in enumerate(items):
        pic = Image.open(it["image"]).convert("RGBA")
        sil, mode = make_silhouette(pic)
        modes.append(mode)
        for fr in question_frames(i, n, sil, "그림자" if mode == "silhouette" else "모자이크"):
            frames.append((fr, Q_SEC / 3))
        frames.append((answer_frame(i, n, pic, it["answer"]), A_SEC))
    cta = settings.script.cta_soft_text if settings.script.cta_style == "soft" else (
        "재미있었다면 좋아요와 구독!" if settings.script.cta_style == "direct" else "")
    frames.append((title_frame(theme_label, n, True, cta if settings.script.cta_style == "direct" else ""), OUTRO))
    lst = work / "frames.txt"
    lines = []
    for k, (img, dur) in enumerate(frames):
        fp = work / f"f_{k:03d}.png"
        img.convert("RGB").save(fp)
        lines += [f"file '{fp.resolve().as_posix()}'", f"duration {dur:.3f}"]
    lines.append(f"file '{(work / f'f_{len(frames) - 1:03d}.png').resolve().as_posix()}'")
    lst.write_text("\n".join(lines) + "\n", encoding="utf-8")
    total = sum(d for _, d in frames)
    video = work / "video.mp4"
    subprocess.run([tool("ffmpeg"), "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-vf", f"fps={p.fps},format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                    "-t", f"{total:.3f}", str(video)], check=True)
    # 2) 내레이션 (문제마다 짧은 말)
    tts = tts or get_provider(p.tts_provider, p.voice_id, model_id=p.elevenlabs_model, edge_voice=p.edge_voice,
                              chars_per_second=settings.script.chars_per_second)
    track = np.zeros(int((total + 0.5) * SR), dtype=np.float32)
    segs = []

    def say(text: str, at: float, name: str):
        r = tts.synthesize(text, work / f"tts_{name}.wav")
        a, sr = sf.read(str(r.audio_path), dtype="float32")
        if a.ndim > 1:
            a = a.mean(axis=1)
        s0 = int(at * SR)
        e0 = min(s0 + len(a), len(track))
        track[s0:e0] += a[: e0 - s0]
        segs.append(composer.Segment(at, at + len(a) / SR))

    say(f"{theme_label} 그림자 퀴즈! {n}문제 다 맞혀 볼까요?", 0.2, "intro")
    t = INTRO
    ticks, pops = [], []
    for i, it in enumerate(items):
        say(f"{i + 1}번! 누구일까요?", t + 0.1, f"q{i}")
        ticks += [t + Q_SEC / 3 * k for k in (1, 2)]
        t += Q_SEC
        pops.append(t)
        say(f"정답은 {it['answer']}!", t + 0.15, f"a{i}")
        t += A_SEC
    say(settings.script.cta_soft_text if settings.script.cta_style != "direct"
        else "몇 개 맞혔나요? 재미있었다면 좋아요와 구독 부탁해요!", t + 0.2, "outro")
    narration = work / "narration.wav"
    sf.write(str(narration), track, SR, subtype="PCM_16")
    # 3) 음악 + 효과음
    seed = seed_for(datetime.now().strftime("%Y-%m-%d"), theme_label + str(n))
    bgm, _ = generate_bgm("funny", total, seed, work, settings.resolve(settings.bgm.soundfont), tempo_bpm=128)
    mix = work / "mix.wav"
    composer.mix_audio(narration, bgm, segs, mix, total, 0.12, settings.bgm.ducking_db)
    composer.add_sfx(mix, ticks, "pop", gain_db=-20)
    composer.add_sfx(mix, pops, "whoosh", gain_db=-12)
    final = out_dir / "final.mp4"
    composer.finalize(video, mix, final, total, None, None, p.fps)
    info = composer.probe(final)
    errs = composer.validate(info, settings.script.max_seconds, (W, H))
    if errs:
        raise RuntimeError("퀴즈 영상 검증 실패: " + "; ".join(errs))
    return {"path": str(final), "duration": info["duration"], "modes": modes}


def quiz_meta(items: list[dict], theme_label: str, kids: bool, cta_style: str) -> dict:
    n = len(items)
    title = f"{theme_label} 그림자 퀴즈! {n}문제 다 맞힐 수 있을까? #shorts"
    lines = [title, "", "그림자만 보고 누구인지 맞혀 보세요! 정답은 바로 공개돼요.", ""]
    if cta_style == "direct":
        lines += ["👍 재미있었다면 좋아요와 구독 부탁드려요!", ""]
    if kids:
        lines += ["👨‍👩‍👧 보호자와 함께 시청해 주세요.", ""]
    credits = []
    for it in items:
        if it["source"] == "wikimedia_commons":
            credits.append(f"{it['answer']}: \"{it.get('title', '').removeprefix('File:')}\" by {it.get('author')}, "
                           f"{it.get('license')}, via Wikimedia Commons {it.get('page', '')}")
        elif it["source"] in ("pixabay", "pexels"):
            credits.append(f"{it['answer']}: {it['source'].capitalize()} — {it.get('author', '')} {it.get('page', '')}")
    if credits:
        lines += ["🖼 이미지 출처"] + [f"- {c}" for c in credits] + [""]
    lines += ["※ 이 영상은 AI 도구(음성 합성 등)를 활용해 제작되었습니다.", "", "#퀴즈 #어린이퀴즈 #그림자퀴즈"]
    return {"title": title[:95], "description": "\n".join(lines), "hashtags": ["#퀴즈", "#어린이퀴즈", "#그림자퀴즈"],
            "sources": [], "items": items, "synthetic_media": True, "made_for_kids": kids,
            "category_id": "27", "profile": "kids", "style": "quiz"}


def make_quiz(theme: str = "animals", count: int = 10, folder: Path | None = None, settings=None,
              clients: dict | None = None, tts=None, seed: int | None = None) -> int:
    """퀴즈 영상 만들고 DB 에 '제작 완료'로 등록 → 🎬 만든 영상에 나타남. production id 반환."""
    from .config import get_settings
    from .context import RunContext
    from .models import Production, Script, Topic
    from .pipeline import next_batch
    base = settings or get_settings()
    count = max(3, min(count, 10))  # 60초 안에 들어가게 최대 10문제
    name = next_batch(base, profile="kids", suffix="quiz")
    with RunContext(name, base) as ctx:
        s = ctx.settings
        out_dir = ctx.run_dir / "quiz"
        label = "내 캐릭터" if folder else THEMES[theme][0]
        (out_dir / "images").mkdir(parents=True, exist_ok=True)
        items = items_from_folder(Path(folder), count) if folder else collect_items(theme, count, out_dir / "images",
                                                                                     clients, seed)
        topic = Topic(run_id=ctx.run.id, key=f"quiz-{theme if not folder else 'mine'}", title=f"{label} 그림자 퀴즈",
                      score=100, status="checked")
        ctx.session.add(topic)
        ctx.session.flush()
        meta = quiz_meta(items, label, kids=True, cta_style=s.script.cta_style)
        script = Script(topic_id=topic.id, json={"title": meta["title"], "scenes": [], "quiz": items,
                                                 "hashtags": meta["hashtags"], "sources": []},
                        approval_status="producing")
        ctx.session.add(script)
        ctx.session.flush()
        prod = Production(script_id=script.id, status="producing")
        ctx.session.add(prod)
        ctx.session.commit()
        try:
            res = build_quiz_video(items, label, out_dir, s, tts=tts)
            meta["modes"] = res["modes"]
            (out_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
            prod.status, prod.video_path, prod.duration = "produced", res["path"], res["duration"]
            script.approval_status = "produced"
            log.info("퀴즈 영상 완료: %s (%d문제, %.0f초)", res["path"], len(items), res["duration"])
        except Exception as e:
            from .production.producer import describe_error
            prod.status, prod.error = "failed", describe_error(e)
            script.approval_status = "failed"
            log.exception("퀴즈 영상 실패")
        ctx.session.commit()
        return prod.id
