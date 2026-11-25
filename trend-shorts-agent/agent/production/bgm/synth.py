"""내장 신시사이저: fluidsynth/사운드폰트가 없는 PC(주로 Windows)에서도 BGM 을 만들 수 있게
pretty_midi 악보를 numpy 로 직접 렌더링한다. (사운드폰트보다 소리는 단순하지만 외부 의존성 0)

음색은 GM 프로그램 번호 계열로 대략 구분: 건반·뜯는 악기 / 현·패드 / 베이스 / 신스 리드 / 팀파니 / 드럼.
"""
from __future__ import annotations

import numpy as np
import pretty_midi

SR = 44100


def _env(n: int, attack: float, release: float, decay: float | None = None) -> np.ndarray:
    t = np.arange(n) / SR
    env = np.minimum(1.0, t / max(attack, 1e-4))
    if decay:
        env *= np.exp(-t / decay)
    r = int(release * SR)
    if 0 < r < n:
        env[-r:] *= np.linspace(1, 0, r)
    return env


def _family(program: int) -> str:
    if program in (47,):
        return "timpani"
    if 32 <= program <= 39 or program in (42, 43):
        return "bass"
    if (40 <= program <= 55 and program != 45) or 88 <= program <= 95:
        return "pad"
    if 80 <= program <= 87:
        return "lead"
    return "pluck"  # 피아노·일렉피아노·마림바·기타·피치카토 등


def _tone(freq: float, dur: float, family: str, vel: float, rng: np.random.Generator) -> np.ndarray:
    tail = {"pluck": 0.6, "pad": 0.4, "bass": 0.08, "lead": 0.08, "timpani": 0.8}[family]
    n = int((dur + tail) * SR)
    t = np.arange(n) / SR
    if family == "pluck":
        sig = sum(np.sin(2 * np.pi * freq * k * t) / k ** 1.6 * np.exp(-t * k * 1.4) for k in range(1, 6))
        env = _env(n, 0.004, 0.05, decay=0.9)
    elif family == "pad":
        det = [0.997, 1.0, 1.003]
        sig = sum(np.sin(2 * np.pi * freq * d * k * t) / k ** 1.8 for d in det for k in range(1, 5)) / 3
        env = _env(n, 0.25, tail)
    elif family == "bass":
        sig = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * 2 * freq * t)
        env = _env(n, 0.006, tail, decay=1.2)
    elif family == "lead":
        sig = sum(np.sin(2 * np.pi * freq * k * t) / k for k in (1, 3, 5, 7)) * 0.6
        env = _env(n, 0.01, tail)
    else:  # timpani
        sig = np.sin(2 * np.pi * freq * t * (1 + 0.02 * np.exp(-t * 8))) + 0.2 * rng.standard_normal(n) * np.exp(-t * 20)
        env = _env(n, 0.003, 0.1, decay=0.7)
    return (sig * env * vel).astype(np.float32)


def _drum(pitch: int, vel: float, rng: np.random.Generator) -> np.ndarray:
    if pitch == 36:  # kick
        n = int(0.35 * SR)
        t = np.arange(n) / SR
        f = 50 + 90 * np.exp(-t * 30)
        sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    elif pitch in (38, 39, 37):  # snare / clap / side stick
        n = int((0.08 if pitch == 37 else 0.2) * SR)
        t = np.arange(n) / SR
        sig = 0.7 * rng.standard_normal(n) * np.exp(-t * 25) + 0.4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    elif pitch == 49:  # crash
        n = int(1.6 * SR)
        t = np.arange(n) / SR
        noise = rng.standard_normal(n)
        sig = (noise - np.convolve(noise, np.ones(8) / 8, "same")) * np.exp(-t * 2.5) * 0.6
    else:  # hat / shaker
        n = int(0.06 * SR)
        t = np.arange(n) / SR
        noise = rng.standard_normal(n)
        sig = (noise - np.convolve(noise, np.ones(4) / 4, "same")) * np.exp(-t * 60) * 0.5
    return (sig * vel).astype(np.float32)


def render_numpy(pm: pretty_midi.PrettyMIDI, seed: int = 0) -> np.ndarray:
    """스테레오 float32 (n, 2). 결정적(같은 악보·시드 → 같은 결과)."""
    rng = np.random.default_rng(seed)
    total = pm.get_end_time() + 2.0
    out = np.zeros(int(total * SR) + SR, dtype=np.float32)
    for inst in pm.instruments:
        fam = None if inst.is_drum else _family(inst.program)
        gain = {"pad": 0.18, "pluck": 0.22, "bass": 0.35, "lead": 0.12, "timpani": 0.4, None: 0.35}[fam]
        for note in inst.notes:
            vel = note.velocity / 127 * gain
            if inst.is_drum:
                sig = _drum(note.pitch, vel, rng)
            else:
                sig = _tone(pretty_midi.note_number_to_hz(note.pitch), note.end - note.start, fam, vel, rng)
            a = int(note.start * SR)
            b = min(a + len(sig), len(out))
            out[a:b] += sig[: b - a]
    # 아주 짧은 잔향(피드백 딜레이 2개)으로 건조함 완화 + 좌우 약간 다르게
    left, right = out.copy(), out.copy()
    for d, g in ((0.031, 0.25), (0.047, 0.18)):
        k = int(d * SR)
        left[k:] += g * out[:-k]
        right[int(k * 1.3):] += g * out[: -int(k * 1.3)]
    return np.stack([left, right], axis=1)
