// 색깔·도형 데이터 — 색 6종 / 도형 5종

export type ShapeType = 'circle' | 'triangle' | 'square' | 'star' | 'heart';
export type ColorName = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

export interface ShapeItem {
  id: string;
  type: ShapeType;
  color: ColorName;
  colorHex: string;
}

export const COLOR_HEX: Record<ColorName, string> = {
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#22C55E',
  yellow: '#FACC15',
  purple: '#A855F7',
  orange: '#F97316',
};

// 한국어 라벨 (지시문/필터에 사용)
export const COLOR_LABEL_KO: Record<ColorName, string> = {
  red: '빨간',
  blue: '파란',
  green: '초록',
  yellow: '노란',
  purple: '보라',
  orange: '주황',
};

export const SHAPE_LABEL_KO: Record<ShapeType, string> = {
  circle: '동그라미',
  triangle: '세모',
  square: '네모',
  star: '별',
  heart: '하트',
};

export const COLORS: ColorName[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
export const SHAPES: ShapeType[] = ['circle', 'triangle', 'square', 'star', 'heart'];

// 모든 색×도형 조합 데이터셋
export const shapeData: ShapeItem[] = SHAPES.flatMap((type) =>
  COLORS.map((color) => ({
    id: `${color}-${type}`,
    type,
    color,
    colorHex: COLOR_HEX[color],
  })),
);
