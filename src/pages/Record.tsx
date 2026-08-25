import { useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import { useAppStore } from '../store/useAppStore';
import { findExercise } from '../data/exercises';
import { formatDate, relativeDay } from '../utils/format';

export default function Record() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const routineParam = params.get('routine');

  const routines = useAppStore((s) => s.routines);
  const sessions = useAppStore((s) => s.sessions);
  const startSession = useAppStore((s) => s.startSession);
  const deleteRoutine = useAppStore((s) => s.deleteRoutine);
  const activeSessionId = useAppStore((s) => s.activeSessionId);

  // URL로 루틴 지정 시 바로 시작
  useEffect(() => {
    if (!routineParam) return;
    const r = routines.find((x) => x.id === routineParam);
    if (!r) return;
    const id = startSession(r.id, r.name);
    nav(`/record/session/${id}`, { replace: true });
  }, [routineParam, routines, startSession, nav]);

  const finished = sessions.filter((s) => s.finishedAt);

  return (
    <Box>
      <PageHeader title="운동 시작" subtitle="루틴 · 프리 모드 · 이전 기록" />

      {activeSessionId && (
        <Box sx={{ px: 2, mb: 2 }}>
          <Card sx={{ border: '1px solid rgba(255,107,53,0.4)' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="overline" color="primary.main">
                    진행 중
                  </Typography>
                  <Typography fontWeight={700}>
                    미완료 세션이 있어요
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  onClick={() => nav(`/record/session/${activeSessionId}`)}
                >
                  이어하기
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* 프리 모드 시작 */}
      <Box sx={{ px: 2 }}>
        <Card
          sx={{
            background:
              'linear-gradient(135deg, rgba(255,107,53,0.18), rgba(78,205,196,0.06))',
          }}
        >
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              프리 모드
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              루틴 없이 자유롭게 기록
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              종목을 그때그때 추가하며 세트만 기록합니다
            </Typography>
            <Button
              fullWidth
              variant="contained"
              sx={{ mt: 2 }}
              startIcon={<PlayArrowRoundedIcon />}
              onClick={() => {
                const id = startSession(undefined, '자유 운동');
                nav(`/record/session/${id}`);
              }}
            >
              빈 세션 시작
            </Button>
          </CardContent>
        </Card>
      </Box>

      {/* 내 루틴 */}
      <Box sx={{ px: 2, mt: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="overline" color="text.secondary">
            내 루틴
          </Typography>
          <Button
            size="small"
            startIcon={<AddRoundedIcon />}
            onClick={() => nav('/routines/new')}
          >
            새 루틴
          </Button>
        </Stack>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {routines.map((r) => (
            <Card key={r.id}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} noWrap>
                      {r.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {r.exercises.length}종목 · {r.description ?? '—'}
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                      {r.exercises.slice(0, 4).map((e) => {
                        const ex = findExercise(e.exerciseId);
                        return (
                          <Typography key={e.exerciseId} variant="caption" color="text.secondary">
                            · {ex?.name}
                          </Typography>
                        );
                      })}
                      {r.exercises.length > 4 && (
                        <Typography variant="caption" color="text.secondary">
                          외 {r.exercises.length - 4}종
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                  <IconButton
                    onClick={() => {
                      if (window.confirm(`"${r.name}" 루틴을 삭제할까요?`)) {
                        deleteRoutine(r.id);
                      }
                    }}
                  >
                    <DeleteOutlineRoundedIcon />
                  </IconButton>
                  <IconButton
                    color="primary"
                    onClick={() => {
                      const id = startSession(r.id, r.name);
                      nav(`/record/session/${id}`);
                    }}
                  >
                    <PlayArrowRoundedIcon />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>

      {/* 최근 세션 히스토리 */}
      <Box sx={{ px: 2, mt: 3, mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <HistoryRoundedIcon fontSize="small" color="disabled" />
          <Typography variant="overline" color="text.secondary">
            최근 기록
          </Typography>
        </Stack>
        {finished.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            완료된 세션이 아직 없어요
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ mt: 1 }}>
            {finished.slice(0, 8).map((s) => {
              const setCount = s.exercises.reduce((a, e) => a + e.sets.length, 0);
              const vol = s.exercises.reduce(
                (a, e) => a + e.sets.reduce((b, st) => b + st.weightKg * st.reps, 0),
                0,
              );
              return (
                <Card
                  key={s.id}
                  onClick={() => nav(`/record/session/${s.id}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Box>
                        <Typography fontWeight={700}>{s.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(s.startedAt)} · {relativeDay(s.startedAt)}
                        </Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography variant="body2">
                          {setCount}세트
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {vol.toLocaleString()}kg
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
