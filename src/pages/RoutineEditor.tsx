import { useState } from 'react';
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
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import ExercisePickerDialog from '../components/record/ExercisePickerDialog';
import { useAppStore } from '../store/useAppStore';
import { findExercise } from '../data/exercises';
import type { RoutineExercise } from '../types';

export default function RoutineEditor() {
  const nav = useNavigate();
  const createRoutine = useAppStore((s) => s.createRoutine);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleAdd = (ids: string[]) => {
    setExercises((cur) => [
      ...cur,
      ...ids
        .filter((id) => !cur.some((e) => e.exerciseId === id))
        .map((id) => ({
          exerciseId: id,
          targetSets: 3,
          targetReps: '8-12',
          restSeconds: 90,
        })),
    ]);
    setPickerOpen(false);
  };

  const handleSave = () => {
    if (!name.trim() || exercises.length === 0) {
      window.alert('이름과 종목을 최소 1개 이상 추가해 주세요.');
      return;
    }
    createRoutine({ name: name.trim(), description: description.trim() || undefined, exercises });
    nav('/record', { replace: true });
  };

  const updateEx = (id: string, patch: Partial<RoutineExercise>) =>
    setExercises((cur) => cur.map((e) => (e.exerciseId === id ? { ...e, ...patch } : e)));

  const removeEx = (id: string) =>
    setExercises((cur) => cur.filter((e) => e.exerciseId !== id));

  return (
    <Box>
      <PageHeader title="새 루틴" subtitle="종목·목표·휴식 설정" showBack />

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
            {exercises.map((e) => {
              const ex = findExercise(e.exerciseId);
              return (
                <Card key={e.exerciseId}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography fontWeight={700}>{ex?.name}</Typography>
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

        <Button
          fullWidth
          size="large"
          variant="contained"
          sx={{ mt: 3, mb: 3 }}
          onClick={handleSave}
        >
          루틴 저장
        </Button>
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
