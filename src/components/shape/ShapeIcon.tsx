import type { ShapeType } from '@/data/shapeData';

interface Props {
  type: ShapeType;
  color: string;
  size?: number | string;
}

/** 색·도형을 SVG로 렌더링 (이미지 에셋 불필요) */
export default function ShapeIcon({ type, color, size = 80 }: Props) {
  const common = { fill: color };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${color} ${type}`}
    >
      {type === 'circle' && <circle cx="50" cy="50" r="44" {...common} />}
      {type === 'square' && <rect x="8" y="8" width="84" height="84" rx="12" {...common} />}
      {type === 'triangle' && <polygon points="50,8 92,90 8,90" {...common} />}
      {type === 'star' && (
        <polygon
          points="50,5 61,38 96,38 68,59 79,92 50,72 21,92 32,59 4,38 39,38"
          {...common}
        />
      )}
      {type === 'heart' && (
        <path
          d="M50 88 L18 54 C2 38 12 14 32 14 C42 14 48 22 50 28 C52 22 58 14 68 14 C88 14 98 38 82 54 Z"
          {...common}
        />
      )}
    </svg>
  );
}
