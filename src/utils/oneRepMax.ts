// 1RM 자동 계산 (WBS 3.1)
// Epley: 1RM = w × (1 + reps/30)
// Brzycki: 1RM = w × (36 / (37 - reps))

export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

export function brzycki1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0 || reps >= 37) return 0;
  return weight * (36 / (37 - reps));
}

export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  if (reps > 12) return round1(epley1RM(weight, reps));
  // reps ≤ 12: 두 공식 평균
  return round1((epley1RM(weight, reps) + brzycki1RM(weight, reps)) / 2);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface IntensityInfo {
  level: number; // 1~6
  pct: number;
  color: string;
  label: string;
}

// WBS 3.1 6단계 색상표 (다크 테마용으로 채도 조정)
export function intensityInfo(weight: number, reps: number, oneRM: number): IntensityInfo | null {
  if (!oneRM || oneRM <= 0 || weight <= 0) return null;
  const set1RM = estimate1RM(weight, reps);
  const pct = (set1RM / oneRM) * 100;
  if (pct < 50) return { level: 1, pct, color: '#60A5FA', label: '워밍업' };
  if (pct < 65) return { level: 2, pct, color: '#4ADE80', label: '가벼움' };
  if (pct < 75) return { level: 3, pct, color: '#FBBF24', label: '중강도' };
  if (pct < 85) return { level: 4, pct, color: '#FB923C', label: '고강도' };
  if (pct < 95) return { level: 5, pct, color: '#F87171', label: '매우고강도' };
  return { level: 6, pct, color: '#C084FC', label: '최대강도' };
}
