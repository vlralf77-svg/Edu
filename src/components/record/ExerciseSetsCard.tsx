import { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import type { SetType, SessionExercise, WorkoutSet } from '../../types';
import { findExercise, CATEGORY_LABEL } from '../../data/exercises';
import { intensityInfo } from '../../utils/oneRepMax';
import { useAppStore } from '../../store/useAppStore';

const setTypeLabel: Record<SetType, string> = {
  NORMAL: '일반',
  WARMUP: '워밍업',
  DROP: '드롭',
  FAILURE: '실패',
};

export default function ExerciseSetsCard({
  sessionId,
  block,
  onSetLogged,
  onRemoveExercise,
}: {
  sessionId: string;
  block: SessionExercise;
  onSetLogged: () => void;
  onRemoveExercise: () => void;
}) {
  const ex = findExercise(block.exerciseId);
  const addSet = useAppStore((s) => s.addSet);
  const updateSet = useAppStore((s) => s.updateSet);
  const deleteSet = useAppStore((s) => s.deleteSet);
  const getLast = useAppStore((s) => s.getLastSetForExercise);
  const getPB1RM = useAppStore((s) => s.getPersonalBest1RM);

  const previous = useMemo(
    () => getLast(block.exerciseId, sessionId),
    [block.exerciseId, sessionId, getLast],
  );
  const pb1rm = useMemo(() => getPB1RM(block.exerciseId), [block.exerciseId, getPB1RM]);

  // 새 세트 입력용 로컬 상태.
  // 이전 값이 있으면 미리 채우되 onFocus 에서 자동 선택되므로 덮어쓰기 쉽다.
  // 이전 값이 없으면 빈 상태로 두고 placeholder 로만 힌트를 준다.
  const lastSet = block.sets[block.sets.length - 1];
  const prefillWeight = lastSet?.weightKg ?? previous?.weightKg;
  const prefillReps = lastSet?.reps ?? previous?.reps;
  const [weight, setWeight] = useState<string>(
    prefillWeight != null ? String(prefillWeight) : '',
  );
  const [reps, setReps] = useState<string>(
    prefillReps != null ? String(prefillReps) : '',
  );
  const [setType, setSetType] = useState<SetType>('NORMAL');

  const handleAdd = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (isNaN(w) || isNaN(r) || w < 0 || r <= 0) return;
    addSet(sessionId, block.exerciseId, w, r, setType);
    onSetLogged();
    // 다음 세트 준비: 값 유지
    setSetType('NORMAL');
  };

  const handleCopyPrev = () => {
    if (!previous) return;
    setWeight(String(previous.weightKg));
    setReps(String(previous.reps));
  };

  if (!ex) return null;

  return (
    <Card sx={{ mb: 1.5 }}>
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700} noWrap>
              {ex.name}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} alignItems="center">
              <Chip size="small" label={CATEGORY_LABEL[ex.category]} variant="outlined" />
              <Typography variant="caption" color="text.secondary">
                {ex.musclePrimary}
              </Typography>
              {pb1rm > 0 && (
                <Typography variant="caption" color="secondary.main" sx={{ ml: 'auto' }}>
                  1RM {pb1rm.toFixed(1)}kg
                </Typography>
              )}
            </Stack>
          </Box>
          <IconButton size="small" onClick={onRemoveExercise}>
            <RemoveCircleOutlineRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>

        {/* 이전 기록 참조 */}
        {previous && (
          <Box
            sx={{
              mt: 1,
              px: 1,
              py: 0.5,
              borderRadius: 1,
              bgcolor: 'rgba(255,255,255,0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              이전
            </Typography>
            <Typography variant="body2" fontFamily="monospace">
              {previous.weightKg}kg × {previous.reps}
            </Typography>
            <IconButton size="small" onClick={handleCopyPrev} sx={{ ml: 'auto' }}>
              <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        )}

        {/* 이미 기록된 세트들 */}
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {block.sets.map((st) => (
            <SetRow
              key={st.id}
              set={st}
              pb1rm={pb1rm}
              onUpdate={(patch) => updateSet(sessionId, st.id, patch)}
              onDelete={() => deleteSet(sessionId, st.id)}
            />
          ))}
        </Stack>

        {/* 새 세트 입력 */}
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1.5 }}>
          <Chip
            size="small"
            label={`${block.sets.length + 1}세트`}
            color="primary"
            variant="outlined"
            sx={{ minWidth: 60 }}
          />
          <Select
            size="small"
            value={setType}
            onChange={(e) => setSetType(e.target.value as SetType)}
            sx={{ minWidth: 84 }}
          >
            {(['NORMAL', 'WARMUP', 'DROP', 'FAILURE'] as SetType[]).map((t) => (
              <MenuItem key={t} value={t}>
                {setTypeLabel[t]}
              </MenuItem>
            ))}
          </Select>
          <TextField
            type="number"
            inputProps={{
              inputMode: 'decimal',
              step: '0.5',
              min: 0,
              style: {
                fontSize: 22,
                fontWeight: 700,
                textAlign: 'center',
                padding: '10px 6px',
                fontVariantNumeric: 'tabular-nums',
              },
            }}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onFocus={(e) => e.target.select()}
            sx={{ flex: 1 }}
            placeholder="kg"
          />
          <Box
            sx={{
              color: 'text.secondary',
              px: 0.5,
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            ×
          </Box>
          <TextField
            type="number"
            inputProps={{
              inputMode: 'numeric',
              min: 1,
              style: {
                fontSize: 22,
                fontWeight: 700,
                textAlign: 'center',
                padding: '10px 6px',
                fontVariantNumeric: 'tabular-nums',
              },
            }}
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onFocus={(e) => e.target.select()}
            sx={{ width: 84 }}
            placeholder="reps"
          />
          <IconButton
            color="primary"
            onClick={handleAdd}
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              width: 48,
              height: 48,
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            <CheckRoundedIcon fontSize="medium" />
          </IconButton>
        </Stack>
      </CardContent>
    </Card>
  );
}

function SetRow({
  set,
  pb1rm,
  onUpdate,
  onDelete,
}: {
  set: WorkoutSet;
  pb1rm: number;
  onUpdate: (patch: Partial<WorkoutSet>) => void;
  onDelete: () => void;
}) {
  const info = intensityInfo(set.weightKg, set.reps, pb1rm);
  const typeColor: Record<SetType, string> = {
    NORMAL: 'text.primary',
    WARMUP: 'info.main',
    DROP: 'warning.main',
    FAILURE: 'error.main',
  };
  const numberInputStyle = {
    fontSize: 18,
    fontWeight: 700,
    textAlign: 'center' as const,
    padding: '6px 4px',
    fontVariantNumeric: 'tabular-nums' as const,
  };
  return (
    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ py: 0.25 }}>
      <Box sx={{ minWidth: 32 }}>
        <Typography
          variant="body1"
          fontWeight={800}
          sx={{ color: typeColor[set.setType] }}
        >
          {set.setType === 'NORMAL' ? set.setNumber : setTypeLabel[set.setType][0]}
        </Typography>
      </Box>
      <TextField
        variant="standard"
        type="number"
        inputProps={{ inputMode: 'decimal', step: '0.5', min: 0, style: numberInputStyle }}
        value={set.weightKg}
        onChange={(e) => onUpdate({ weightKg: parseFloat(e.target.value) || 0 })}
        onFocus={(e) => e.target.select()}
        sx={{ flex: 1 }}
      />
      <Typography variant="body2" color="text.secondary" fontWeight={600}>
        kg ×
      </Typography>
      <TextField
        variant="standard"
        type="number"
        inputProps={{ inputMode: 'numeric', min: 1, style: numberInputStyle }}
        value={set.reps}
        onChange={(e) => onUpdate({ reps: parseInt(e.target.value, 10) || 1 })}
        onFocus={(e) => e.target.select()}
        sx={{ width: 64 }}
      />
      {info && (
        <Chip
          size="small"
          label={`${info.pct.toFixed(0)}%`}
          sx={{
            height: 22,
            bgcolor: `${info.color}22`,
            color: info.color,
            fontWeight: 700,
            border: `1px solid ${info.color}55`,
          }}
        />
      )}
      <IconButton size="small" onClick={onDelete}>
        <DeleteOutlineRoundedIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

// Add 종목 버튼용 훅용 아이콘
export { AddRoundedIcon };
