import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import { selectTodayStats, useAppStore } from '../store/useAppStore';
import { formatDate, relativeDay, todayISO } from '../utils/format';
import { findExercise } from '../data/exercises';
import CalendarHeatmap from '../components/common/CalendarHeatmap';

export default function Home() {
  const nav = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const sessions = useAppStore((s) => s.sessions);
  const routines = useAppStore((s) => s.routines);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const stats = useAppStore(selectTodayStats);

  const finishedSessions = sessions.filter((s) => s.finishedAt);
  const lastSession = finishedSessions[0];

  const feedback = buildCoachTip(sessions);

  return (
    <Box>
      <PageHeader
        title={`안녕하세요, ${profile.nickname}님`}
        subtitle={`오늘 ${formatDate(new Date())}`}
      />

      {/* 오늘 요약 카드 */}
      <Box sx={{ px: 2 }}>
        <Card
          sx={{
            background:
              'linear-gradient(135deg, rgba(255,107,53,0.18) 0%, rgba(78,205,196,0.10) 100%)',
            border: '1px solid rgba(255,107,53,0.25)',
          }}
        >
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="overline" color="text.secondary">
                  오늘의 운동
                </Typography>
                <Typography variant="h4" fontWeight={800}>
                  {stats.count > 0 ? '완료' : '준비'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {stats.count > 0
                    ? `${stats.totalSets}세트 · 총 볼륨 ${stats.volume.toLocaleString()}kg`
                    : '오늘 운동을 시작해 보세요'}
                </Typography>
              </Box>
              <LocalFireDepartmentRoundedIcon
                sx={{ fontSize: 44, color: 'primary.main', opacity: 0.9 }}
              />
            </Stack>
          </CardContent>
        </Card>

        {/* 활성 세션 이어하기 / 새로 시작 */}
        <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
          {activeSessionId ? (
            <Button
              fullWidth
              size="large"
              variant="contained"
              color="primary"
              startIcon={<RestartAltRoundedIcon />}
              onClick={() => nav(`/record/session/${activeSessionId}`)}
            >
              진행 중인 운동 이어하기
            </Button>
          ) : (
            <Button
              fullWidth
              size="large"
              variant="contained"
              color="primary"
              startIcon={<PlayArrowRoundedIcon />}
              onClick={() => nav('/record')}
            >
              운동 시작하기
            </Button>
          )}
        </Stack>

        {/* 최근 운동 요약 */}
        {lastSession && (
          <Card sx={{ mt: 2.5 }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                최근 운동 · {relativeDay(lastSession.startedAt)}
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {lastSession.name}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
                {lastSession.exercises.slice(0, 6).map((e) => {
                  const ex = findExercise(e.exerciseId);
                  return (
                    <Chip
                      key={e.exerciseId}
                      size="small"
                      label={`${ex?.name ?? e.exerciseId} · ${e.sets.length}세트`}
                    />
                  );
                })}
                {lastSession.exercises.length > 6 && (
                  <Chip size="small" label={`+${lastSession.exercises.length - 6}`} />
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* AI 코치 카드 (LLM 미연동 - 데이터 기반 규칙) */}
        <Card sx={{ mt: 2, border: '1px solid rgba(78,205,196,0.25)' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <BoltRoundedIcon sx={{ color: 'secondary.main' }} />
              <Typography variant="overline" color="secondary.main">
                AI 코치
              </Typography>
            </Stack>
            <Typography variant="body1" lineHeight={1.55}>
              {feedback}
            </Typography>
          </CardContent>
        </Card>

        {/* 이번달 캘린더 히트맵 */}
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              이번 달 운동 캘린더
            </Typography>
            <CalendarHeatmap sessions={finishedSessions} monthOf={todayISO()} />
          </CardContent>
        </Card>

        {/* 빠른 시작 루틴 */}
        {routines.length > 0 && (
          <Box sx={{ mt: 2, mb: 4 }}>
            <Typography variant="overline" color="text.secondary" sx={{ pl: 0.5 }}>
              빠른 시작 루틴
            </Typography>
            <Stack spacing={1} sx={{ mt: 0.5 }}>
              {routines.slice(0, 3).map((r) => (
                <Card
                  key={r.id}
                  onClick={() => nav(`/record?routine=${r.id}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography fontWeight={700}>{r.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.exercises.length}종목 · {r.description}
                        </Typography>
                      </Box>
                      <PlayArrowRoundedIcon color="primary" />
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// 운동 기록 기반 간단 코칭 로직 (WBS 3.5 규칙형 대체)
function buildCoachTip(sessions: ReturnType<typeof useAppStore.getState>['sessions']) {
  const finished = sessions.filter((s) => s.finishedAt);
  if (finished.length === 0) {
    return '아직 기록이 없네요! 첫 세션을 완료하면 데이터 기반 피드백을 드릴 수 있어요. 부담 없이 시작해 보세요 💪';
  }
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = finished.filter(
    (s) => now - new Date(s.startedAt).getTime() < week,
  );
  if (thisWeek.length >= 4) {
    return `이번 주 ${thisWeek.length}회 운동! 훌륭한 리듬입니다. 오늘은 회복에 집중하는 가벼운 세션도 좋은 선택이에요.`;
  }
  if (thisWeek.length === 0) {
    const last = finished[0];
    return `마지막 운동 이후 ${relativeDay(last.startedAt)}. 오늘 짧게라도 몸을 움직여 리듬을 되찾아 봐요.`;
  }
  return `이번 주 ${thisWeek.length}회 완료. 목표까지 조금 더! 부위별 균형(당기기·밀기·하체)을 점검해 보세요.`;
}
