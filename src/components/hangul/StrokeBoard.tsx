import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Box } from '@mui/material';
import type { Stroke } from '@/data/strokeData';

interface Props {
  char: string; // 가이드로 보여줄 글자(폰트 글리프)
  strokes: Stroke[]; // 획순(0~100 좌표). 비어 있으면 번호/시범 없이 가이드만.
  size?: number;
}

export interface StrokeBoardHandle {
  clear: () => void;
  playDemo: () => void;
  /** 캔버스에 칠해진 비율(0~1) — '다 썼어요' 판정용 */
  coverage: () => number;
}

const seglen = (a: number[], b: number[]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const strokeLen = (s: Stroke) => {
  let L = 0;
  for (let i = 1; i < s.length; i++) L += seglen(s[i - 1], s[i]);
  return L;
};
// 폴리라인에서 frac(0~1) 위치 좌표
const pointAt = (s: Stroke, frac: number): number[] => {
  const total = strokeLen(s);
  let want = total * frac;
  for (let i = 1; i < s.length; i++) {
    const d = seglen(s[i - 1], s[i]);
    if (want <= d) {
      const t = d === 0 ? 0 : want / d;
      return [s[i - 1][0] + (s[i][0] - s[i - 1][0]) * t, s[i - 1][1] + (s[i][1] - s[i - 1][1]) * t];
    }
    want -= d;
  }
  return s[s.length - 1];
};
const pathD = (s: Stroke) =>
  s.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

const StrokeBoard = forwardRef<StrokeBoardHandle, Props>(function StrokeBoard(
  { char, strokes, size = 240 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // 시범 애니메이션 상태
  const [demo, setDemo] = useState<{ i: number; frac: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearCanvas = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
  };

  const stopDemo = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setDemo(null);
  };

  const playDemo = () => {
    if (!strokes.length) return;
    stopDemo();
    const lens = strokes.map(strokeLen);
    const SPEED = 90; // 유닛/초
    let i = 0;
    let elapsed = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = (now - prev) / 1000;
      prev = now;
      elapsed += dt * SPEED;
      let dur = Math.max(lens[i], 8);
      while (elapsed >= dur && i < strokes.length - 1) {
        elapsed -= dur;
        i++;
        dur = Math.max(lens[i], 8);
      }
      const frac = Math.min(1, elapsed / dur);
      setDemo({ i, frac });
      if (i >= strokes.length - 1 && frac >= 1) {
        rafRef.current = null;
        setTimeout(() => setDemo(null), 400);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useImperativeHandle(ref, () => ({
    clear: clearCanvas,
    playDemo,
    coverage: () => {
      const c = canvasRef.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return 0;
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let painted = 0;
      for (let p = 3; p < data.length; p += 4) if (data[p] > 0) painted++;
      return painted / (c.width * c.height);
    },
  }));

  // 글자 변경 시: 캔버스 비우고 시범 자동 재생
  useEffect(() => {
    clearCanvas();
    stopDemo();
    const t = setTimeout(playDemo, 350);
    return () => {
      clearTimeout(t);
      stopDemo();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char]);

  // ── 따라쓰기(캔버스) ──
  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
    };
  };
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.strokeStyle = '#7F77DD';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const end = () => {
    drawing.current = false;
    last.current = null;
  };

  // 화살표(획 끝 방향)
  const arrow = (s: Stroke) => {
    if (s.length < 2) return null;
    const a = s[s.length - 2];
    const b = s[s.length - 1];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const L = 5;
    const w = 3;
    const p1 = [b[0] - L * Math.cos(ang) + w * Math.sin(ang), b[1] - L * Math.sin(ang) - w * Math.cos(ang)];
    const p2 = [b[0] - L * Math.cos(ang) - w * Math.sin(ang), b[1] - L * Math.sin(ang) + w * Math.cos(ang)];
    return `${b[0]},${b[1]} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`;
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: 6,
        bgcolor: '#fff',
        boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      {/* 가이드 글자(폰트) */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * Math.min(0.72, 1 / ((char?.length || 1) + 0.4)),
          fontWeight: 800,
          color: 'rgba(127,119,221,0.30)',
          userSelect: 'none',
          lineHeight: 1,
          px: 1,
        }}
      >
        {char}
      </Box>

      {/* 획순 번호·화살표·시범 (SVG) */}
      {strokes.length > 0 && (
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {/* 시범: 완료된 획 + 진행 중 획 */}
          {demo &&
            strokes.map((s, idx) => {
              if (idx > demo.i) return null;
              const L = strokeLen(s);
              const frac = idx < demo.i ? 1 : demo.frac;
              return (
                <path
                  key={`d${idx}`}
                  d={pathD(s)}
                  fill="none"
                  stroke="#7F77DD"
                  strokeWidth={7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={L}
                  strokeDashoffset={L * (1 - frac)}
                  opacity={0.85}
                />
              );
            })}
          {/* 시범 펜 위치 */}
          {demo && (
            <circle
              cx={pointAt(strokes[demo.i], demo.frac)[0]}
              cy={pointAt(strokes[demo.i], demo.frac)[1]}
              r={4.5}
              fill="#E8743B"
            />
          )}

          {/* 화살표(획 방향) — 번호 대신 방향만 표시 */}
          {strokes.map((s, idx) => {
            const pts = arrow(s);
            return pts ? <polygon key={`a${idx}`} points={pts} fill="#1D9E75" opacity={0.6} /> : null;
          })}
        </svg>
      )}

      {/* 따라쓰기 캔버스 (맨 위) */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'crosshair' }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
    </Box>
  );
});

export default StrokeBoard;
