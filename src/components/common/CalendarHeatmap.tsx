import { Box, Stack, Typography } from '@mui/material';
import type { WorkoutSession } from '../../types';
import { pad2 } from '../../utils/format';

// 월간 히트맵 (WBS 3.3 운동 캘린더)
export default function CalendarHeatmap({
  sessions,
  monthOf,
}: {
  sessions: WorkoutSession[];
  monthOf: string; // YYYY-MM-DD
}) {
  const base = new Date(monthOf);
  const y = base.getFullYear();
  const m = base.getMonth();
  const firstDow = new Date(y, m, 1).getDay(); // 0=일
  const lastDate = new Date(y, m + 1, 0).getDate();

  // 날짜별 볼륨 합계
  const volumeByDay = new Map<string, number>();
  for (const s of sessions) {
    const key = s.startedAt.slice(0, 10);
    if (!key.startsWith(`${y}-${pad2(m + 1)}`)) continue;
    const v = s.exercises.reduce(
      (a, e) => a + e.sets.reduce((b, st) => b + st.weightKg * st.reps, 0),
      0,
    );
    volumeByDay.set(key, (volumeByDay.get(key) ?? 0) + v);
  }

  const maxVol = Math.max(1, ...Array.from(volumeByDay.values()));

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= lastDate; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

  const bgFor = (day: number | null) => {
    if (day == null) return 'transparent';
    const key = `${y}-${pad2(m + 1)}-${pad2(day)}`;
    const v = volumeByDay.get(key) ?? 0;
    if (v <= 0) return 'rgba(255,255,255,0.05)';
    const t = Math.min(1, v / maxVol);
    const alpha = 0.25 + t * 0.65;
    return `rgba(255,107,53,${alpha.toFixed(2)})`;
  };

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {y}년 {m + 1}월 · 색상이 진할수록 볼륨이 큰 날
      </Typography>
      <Stack direction="row" spacing={0.5} sx={{ mb: 0.5 }}>
        {dayLabels.map((d) => (
          <Box key={d} sx={{ flex: 1, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {d}
            </Typography>
          </Box>
        ))}
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 0.5,
        }}
      >
        {cells.map((day, idx) => (
          <Box
            key={idx}
            sx={{
              aspectRatio: '1',
              borderRadius: 1.5,
              bgcolor: bgFor(day),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: day == null ? 'transparent' : 'text.primary',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {day ?? '·'}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
