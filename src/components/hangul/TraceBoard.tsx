import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Box } from '@mui/material';

interface Props {
  char: string; // 따라쓸 글자
  size?: number;
}

export interface TraceBoardHandle {
  clear: () => void;
}

/**
 * 따라쓰기 보드.
 * 흐린 가이드 글자 위에 손가락/마우스로 획을 그릴 수 있는 캔버스.
 * 글자가 바뀌면 자동으로 비우며, ref.clear() 로 수동 초기화할 수 있다.
 */
const TraceBoard = forwardRef<TraceBoardHandle, Props>(function TraceBoard(
  { char, size = 280 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  useImperativeHandle(ref, () => ({ clear }));

  // 글자 변경 시 캔버스 초기화
  useEffect(() => {
    clear();
  }, [char]);

  const pos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
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
    ctx.lineWidth = 18;
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
      {/* 흐린 가이드 글자 */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.72,
          fontWeight: 800,
          color: 'rgba(127,119,221,0.18)',
          userSelect: 'none',
          lineHeight: 1,
        }}
      >
        {char}
      </Box>
      {/* 그리기 캔버스 */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          cursor: 'crosshair',
        }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
    </Box>
  );
});

export default TraceBoard;
