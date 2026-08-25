import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import ExercisePickerDialog from '../components/record/ExercisePickerDialog';
import { useAppStore } from '../store/useAppStore';
import { findExercise } from '../data/exercises';
import type { RoutineExercise } from '../types';

export default function RoutineEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const isEdit = !!id;

  const existing = useAppStore((s) =>
    isEdit ? s.routines.find((r) => r.id === id) : undefined,
  );
  const createRoutine = useAppStore((s) => s.createRoutine);
  const updateRoutine = useAppStore((s) => s.updateRoutine);
  const deleteRoutine = useAppStore((s) => s.deleteRoutine);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // 편집 모드에서 기존 값 로드
  useEffect(() => {
    if (isEdit && existing && !hydrated) {
      setName(existing.name);
      setDescription(existing.description ?? '');
      setExercises(existing.exercises.map((e) => ({ ...e })));
      setHydrated(true);
    }
    if (!isEdit && !hydrated) setHydrated(true);
  }, [isEdit, existing, hydrated]);

  // 편집 모드인데 루틴을 못 찾은 경우
  if (isEdit && !existing) {
    return (
      <Box>
        <PageHeader title="루틴을 찾을 수 없어요" showBack />
        <Box sx={{ px: 2 }}>
          <Button onClick={() => nav('/record')}>기록 화면으로</Button>
        </Box>
      </Box>
    );
  }

  const handleAdd = (ids: string[]) => {
    setExercises((cur) => [
      ...cur,
      ...ids
        .filter((exId) => !cur.some((e) => e.exerciseId === exId))
        .map((exId) => ({
          exerciseId: exId,
          targetSets: 3,
          targetReps: '8-12',
          restSeconds: 90,
        })),
    ]);
    setPickerOpen(false);
  };

  const updateEx = (exId: string, patch: Partial<RoutineExercise>) =>
    setExercises((cur) =>
      cur.map((e) => (e.exerciseId === exId ? { ...e, ...patch } : e)),
    );

  const removeEx = (exId: string) =>
    setExercises((cur) => cur.filter((e) => e.exerciseId !== exId));

  const moveEx = (exId: string, dir: -1 | 1) =>
    setExercises((cur) => {
      const idx = cur.findIndex((e) => e.exerciseId === exId);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= cur.length) return cur;
      const copy = [...cur];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });

  const handleSave = () => {
    if (!name.trim() || exercises.length === 0) {
      window.alert('이름과 종목을 최소 1개 이상 추가해 주세요.');
      return;
    }
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      exercises,
    };
    if (isEdit && id) {
      updateRoutine(id, payload);
    } else {
      createRoutine(payload);
    }
    nav('/record', { replace: true });
  };

  const handleDelete = () => {
    if (!id) return;
    if (window.confirm(`"${name || '이 루틴'}" 을(를) 삭제할까요?`)) {
      deleteRoutine(id);
      nav('/record', { replace: true });
    }
  };

  return (
    <Box>
      <PageHeader
        title={isEdit ? '루틴 수정' : '새 루틴'}
        subtitle="종목·목표·휴식 설정"
        showBack
      />

      <Box sx={{ px: 2 }}>
        <Stack spacing={1.5}>
          <TextField
            label="루틴 이름"
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="설명 (선택)"
            size="small"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Stack>

        <Box sx={{ mt: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="overline" color="text.secondary">
              종목 {exercises.length}개
            </Typography>
            <Button
              size="small"
              startIcon={<AddRoundedIcon />}
              onClick={() => setPickerOpen(true)}
            >
              종목 추가
            </Button>
          </Stack>

          <Stack spacing={1} sx={{ mt: 1 }}>
            {exercises.map((e, i) => {
              const ex = findExercise(e.exerciseId);
              return (
                <Card key={e.exerciseId}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography fontWeight={700} sx={{ flex: 1, minWidth: 0 }} noWrap>
                        {ex?.name}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => moveEx(e.exerciseId, -1)}
                        disabled={i === 0}
                      >
                        <ArrowUpwardRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => moveEx(e.exerciseId, 1)}
                        disabled={i === exercises.length - 1}
                      >
                        <ArrowDownwardRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => removeEx(e.exerciseId)}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <TextField
                        size="small"
                        label="세트"
                        type="number"
                        value={e.targetSets}
                        onChange={(ev) =>
                          updateEx(e.exerciseId, {
                            targetSets: Math.max(1, parseInt(ev.target.value, 10) || 1),
                          })
                        }
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small"
                        label="목표 횟수"
                        value={e.targetReps}
                        onChange={(ev) => updateEx(e.exerciseId, { targetReps: ev.target.value })}
                        sx={{ flex: 1 }}
                        placeholder="8-12"
                      />
                      <TextField
                        size="small"
                        label="휴식(초)"
                        type="number"
                        value={e.restSeconds}
                        onChange={(ev) =>
                          updateEx(e.exerciseId, {
                            restSeconds: Math.max(15, parseInt(ev.target.value, 10) || 90),
                          })
                        }
                        sx={{ flex: 1 }}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
            {exercises.length === 0 && (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 4,
                  color: 'text.secondary',
                  border: '1px dashed rgba(255,255,255,0.12)',
                  borderRadius: 2,
                }}
              >
                <Typography variant="body2">종목을 추가해 주세요</Typography>
              </Box>
            )}
          </Stack>
        </Box>

        <Stack direction="row" spacing={1} sx={{ mt: 3, mb: 3 }}>
          {isEdit && (
            <Button
              variant="outlined"
              color="error"
              onClick={handleDelete}
              sx={{ minWidth: 100 }}
            >
              삭제
            </Button>
          )}
          <Button fullWidth size="large" variant="contained" onClick={handleSave}>
            {isEdit ? '변경사항 저장' : '루틴 저장'}
          </Button>
        </Stack>
      </Box>

      <ExercisePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAdd}
        excludeIds={exercises.map((e) => e.exerciseId)}
      />
    </Box>
  );
}
