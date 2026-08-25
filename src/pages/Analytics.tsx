import { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import PageHeader from '../components/layout/PageHeader';
import { useAppStore } from '../store/useAppStore';
import LineChart, { type LinePoint } from '../components/common/LineChart';
import MuscleRadar from '../components/common/MuscleRadar';
import { EXERCISES, CATEGORY_LABEL, findExercise } from '../data/exercises';
import type { MuscleCategory } from '../types';
import { estimate1RM } from '../utils/oneRepMax';
import { pad2 } from '../utils/format';

type Period = 7 | 30 | 90 | 180;

const PERIOD_LABEL: Record<Period, string> = {
  7: '최근 1주',
  30: '최근 1개월',
  90: '최근 3개월',
  180: '최근 6개월',
};

export default function Analytics() {
  const sessions = useAppStore((s) => s.sessions).filter((s) => s.finishedAt);
  const bodyRecords = useAppStore((s) => s.bodyRecords);

  const [period, setPeriod] = useState<Period>(30);
  const [exerciseId, setExerciseId] = useState<string>(() => {
    const first = sessions[0]?.exercises[0]?.exerciseId;
    return first ?? EXERCISES[0].id;
  });

  const cutoff = Date.now() - period * 24 * 60 * 60 * 1000;
  const filteredSessions = sessions.filter(
    (s) => new Date(s.startedAt).getTime() >= cutoff,
  );

  // 볼륨 추이 (일자별)
  const volumePoints: LinePoint[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of filteredSessions) {
      const key = s.startedAt.slice(0, 10);
      const v = s.exercises.reduce(
        (a, e) => a + e.sets.reduce((b, st) => b + st.weightKg * st.reps, 0),
        0,
      );
      map.set(key, (map.get(key) ?? 0) + v);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        const d = new Date(k);
        return { x: `${d.getMonth() + 1}/${d.getDate()}`, y: Math.round(v) };
      });
  }, [filteredSessions]);

  // 1RM 추이 (선택 종목)
  const oneRmPoints: LinePoint[] = useMemo(() => {
    const entries: { date: string; value: number }[] = [];
    for (const s of filteredSessions) {
      const block = s.exercises.find((e) => e.exerciseId === exerciseId);
      if (!block) continue;
      let best = 0;
      for (const st of block.sets) {
        if (st.setType === 'WARMUP') continue;
        const r = estimate1RM(st.weightKg, st.reps);
        if (r > best) best = r;
      }
      if (best > 0) entries.push({ date: s.startedAt.slice(0, 10), value: best });
    }
    entries.sort((a, b) => a.date.localeCompare(b.date));
    return entries.map((e) => {
      const d = new Date(e.date);
      return { x: `${d.getMonth() + 1}/${d.getDate()}`, y: Math.round(e.value * 10) / 10 };
    });
  }, [filteredSessions, exerciseId]);

  // 부위별 볼륨 분포 (레이더)
  const radar = useMemo(() => {
    const byCat = new Map<MuscleCategory, number>();
    for (const s of filteredSessions) {
      for (const e of s.exercises) {
        const ex = findExercise(e.exerciseId);
        if (!ex) continue;
        const v = e.sets.reduce((a, st) => a + st.weightKg * st.reps, 0);
        byCat.set(ex.category, (byCat.get(ex.category) ?? 0) + v);
      }
    }
    const cats: MuscleCategory[] = ['CHEST', 'BACK', 'SHOULDER', 'LEG', 'ARM', 'CORE'];
    return cats.map((c) => ({
      label: CATEGORY_LABEL[c],
      value: byCat.get(c) ?? 0,
    }));
  }, [filteredSessions]);

  // 신체 데이터 추이
  const bodyPoints: LinePoint[] = useMemo(() => {
    const cutoffISO = new Date(cutoff).toISOString().slice(0, 10);
    return bodyRecords
      .filter((b) => b.date >= cutoffISO && b.weightKg)
      .map((b) => {
        const d = new Date(b.date);
        return { x: `${d.getMonth() + 1}/${d.getDate()}`, y: b.weightKg! };
      });
  }, [bodyRecords, cutoff]);

  // 통계 요약
  const totalSessions = filteredSessions.length;
  const totalVolume = volumePoints.reduce((a, p) => a + p.y, 0);
  const streak = useMemo(() => computeStreak(sessions), [sessions]);

  const exerciseOptions = EXERCISES.filter((ex) =>
    sessions.some((s) => s.exercises.some((e) => e.exerciseId === ex.id)),
  );

  return (
    <Box>
      <PageHeader title="분석 대시보드" subtitle="볼륨·1RM·부위 분포" />

      <Box sx={{ px: 2 }}>
        <Select
          fullWidth
          size="small"
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value) as Period)}
        >
          {([7, 30, 90, 180] as Period[]).map((p) => (
            <MenuItem key={p} value={p}>
              {PERIOD_LABEL[p]}
            </MenuItem>
          ))}
        </Select>

        {/* 요약 */}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <StatCard label="세션" value={String(totalSessions)} />
          <StatCard label="총 볼륨" value={`${totalVolume.toLocaleString()}kg`} />
          <StatCard label="연속" value={`${streak}일`} />
        </Stack>

        {/* 볼륨 추이 */}
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              볼륨 추이
            </Typography>
            <LineChart
              points={volumePoints}
              color="#FF6B35"
              unit="kg"
              emptyLabel="이 기간에 완료된 세션이 없어요"
            />
          </CardContent>
        </Card>

        {/* 부위별 분포 */}
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              부위별 볼륨 분포
            </Typography>
            {radar.every((r) => r.value === 0) ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                기록이 없어요
              </Typography>
            ) : (
              <MuscleRadar data={radar} />
            )}
          </CardContent>
        </Card>

        {/* 1RM 추이 */}
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="overline" color="text.secondary" sx={{ flex: 1 }}>
                예상 1RM 추이
              </Typography>
              <Select
                size="small"
                value={exerciseId}
                onChange={(e) => setExerciseId(e.target.value)}
                sx={{ minWidth: 140 }}
              >
                {(exerciseOptions.length > 0 ? exerciseOptions : EXERCISES).map((ex) => (
                  <MenuItem key={ex.id} value={ex.id}>
                    {ex.name}
                  </MenuItem>
                ))}
              </Select>
            </Stack>
            <LineChart
              points={oneRmPoints}
              color="#4ECDC4"
              unit="kg"
              emptyLabel="선택한 종목의 기록이 없어요"
            />
          </CardContent>
        </Card>

        {/* 체중 추이 */}
        <Card sx={{ mt: 2, mb: 3 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              체중 추이
            </Typography>
            <LineChart
              points={bodyPoints}
              color="#FBBF24"
              unit="kg"
              emptyLabel="신체 기록이 없어요 · 마이 탭에서 입력"
            />
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card sx={{ flex: 1 }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h6" fontWeight={800}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function computeStreak(sessions: ReturnType<typeof useAppStore.getState>['sessions']) {
  const days = new Set(
    sessions.filter((s) => s.finishedAt).map((s) => s.startedAt.slice(0, 10)),
  );
  let streak = 0;
  const now = new Date();
  for (;;) {
    const key = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    if (days.has(key)) {
      streak++;
      now.setDate(now.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
