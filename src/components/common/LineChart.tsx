import { Box, Typography } from '@mui/material';

// 순수 SVG 라인 차트 (의존성 제로)
export interface LinePoint {
  x: string; // 라벨 (예: '3/1')
  y: number;
}

export default function LineChart({
  points,
  height = 160,
  color = '#FF6B35',
  unit = '',
  emptyLabel = '데이터가 없어요',
}: {
  points: LinePoint[];
  height?: number;
  color?: string;
  unit?: string;
  emptyLabel?: string;
}) {
  if (points.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
        }}
      >
        <Typography variant="body2">{emptyLabel}</Typography>
      </Box>
    );
  }

  const w = 320;
  const h = height;
  const padL = 32;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const values = points.map((p) => p.y);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const yPad = range * 0.1;
  const lo = minV - yPad;
  const hi = maxV + yPad;

  const xAt = (i: number) =>
    padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yAt = (v: number) => padT + innerH - ((v - lo) / (hi - lo)) * innerH;

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.y).toFixed(1)}`)
    .join(' ');
  const areaD =
    pathD +
    ` L ${xAt(points.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)}` +
    ` L ${xAt(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  // Y축 눈금 3개
  const yTicks = [lo, (lo + hi) / 2, hi];

  return (
    <Box sx={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block' }}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={w - padR}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
            <text
              x={padL - 4}
              y={yAt(t) + 3}
              fontSize={9}
              fill="rgba(255,255,255,0.4)"
              textAnchor="end"
            >
              {t >= 100 ? t.toFixed(0) : t.toFixed(1)}
            </text>
          </g>
        ))}
        <path d={areaD} fill={`${color}22`} />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xAt(i)}
            cy={yAt(p.y)}
            r={2.5}
            fill={color}
            stroke="#0F1621"
            strokeWidth={1}
          />
        ))}
        {points.map((p, i) => {
          // X 라벨은 첫/중간/마지막만
          if (
            points.length > 4 &&
            i !== 0 &&
            i !== points.length - 1 &&
            i !== Math.floor(points.length / 2)
          )
            return null;
          return (
            <text
              key={`xl-${i}`}
              x={xAt(i)}
              y={h - 6}
              fontSize={9}
              fill="rgba(255,255,255,0.5)"
              textAnchor="middle"
            >
              {p.x}
            </text>
          );
        })}
      </svg>
      {unit && (
        <Typography variant="caption" color="text.secondary">
          단위: {unit}
        </Typography>
      )}
    </Box>
  );
}
