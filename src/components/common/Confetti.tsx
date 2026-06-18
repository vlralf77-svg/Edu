import { Box } from '@mui/material';
import { useMemo } from 'react';

const COLORS = ['#7F77DD', '#1D9E75', '#FFC53D', '#EF4444', '#3B82F6', '#F97316'];

/** CSS 기반 컨페티 (결과 화면 축하 효과) */
export default function Confetti({ count = 40 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        duration: 2.5 + Math.random() * 2,
        color: COLORS[i % COLORS.length],
        size: 8 + Math.random() * 8,
        rounded: Math.random() > 0.5,
      })),
    [count],
  );

  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 5,
      }}
    >
      {pieces.map((p) => (
        <Box
          key={p.id}
          sx={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            bgcolor: p.color,
            borderRadius: p.rounded ? '50%' : '2px',
            animation: `tl-fall ${p.duration}s linear ${p.delay}s forwards`,
          }}
        />
      ))}
    </Box>
  );
}
