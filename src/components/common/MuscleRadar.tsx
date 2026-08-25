import { Box } from '@mui/material';

// 부위별 볼륨 레이더 차트 (SVG)
export default function MuscleRadar({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  if (data.length === 0) return null;
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = (Math.PI * 2) / data.length;

  const pt = (i: number, ratio: number) => ({
    x: cx + Math.sin(i * step) * r * ratio,
    y: cy - Math.cos(i * step) * r * ratio,
  });

  const polygon = data
    .map((d, i) => {
      const p = pt(i, d.value / max);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {rings.map((ratio, i) => (
          <polygon
            key={i}
            points={data
              .map((_, idx) => {
                const p = pt(idx, ratio);
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              })
              .join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}
        {data.map((_, i) => {
          const p = pt(i, 1);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="rgba(255,255,255,0.06)"
            />
          );
        })}
        <polygon
          points={polygon}
          fill="rgba(78,205,196,0.28)"
          stroke="#4ECDC4"
          strokeWidth={1.5}
        />
        {data.map((d, i) => {
          const p = pt(i, 1.18);
          return (
            <text
              key={d.label}
              x={p.x}
              y={p.y}
              fontSize={11}
              fill="rgba(255,255,255,0.7)"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {d.label}
            </text>
          );
        })}
      </svg>
    </Box>
  );
}
