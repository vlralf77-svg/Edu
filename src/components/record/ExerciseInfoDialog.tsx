import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import type { Exercise } from '../../types';
import { CATEGORY_LABEL, EQUIPMENT_LABEL } from '../../data/exercises';
import MuscleBodyDiagram, { nameToRegions } from '../common/MuscleBodyDiagram';
import ExerciseAnimation, {
  getCues,
  idToArchetype,
} from '../common/ExerciseAnimation';

export default function ExerciseInfoDialog({
  exercise,
  onClose,
}: {
  exercise: Exercise | null;
  onClose: () => void;
}) {
  if (!exercise) return null;
  const primaryRegions = nameToRegions(exercise.musclePrimary);
  const secondaryRegions = nameToRegions(exercise.muscleSecondary);
  const archetype = idToArchetype(exercise.id);
  const cues = getCues(exercise.id);

  return (
    <Dialog open={!!exercise} onClose={onClose} fullWidth maxWidth="xs">
      <DialogContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary">
              {CATEGORY_LABEL[exercise.category]} · {EQUIPMENT_LABEL[exercise.equipment]}
            </Typography>
            <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2 }}>
              {exercise.name}
            </Typography>
            {exercise.nameEn && (
              <Typography variant="body2" color="text.secondary">
                {exercise.nameEn}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseRoundedIcon />
          </IconButton>
        </Stack>

        {/* 동작 애니메이션 */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ pl: 0.5 }}>
            자세 · 동작
          </Typography>
          <ExerciseAnimation archetype={archetype} />
        </Box>

        {/* 핵심 큐 */}
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ pl: 0.5 }}>
            핵심 포인트
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
            {cues.map((c, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                <Box
                  sx={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mt: '2px',
                  }}
                >
                  {i + 1}
                </Box>
                <Typography variant="body2" sx={{ flex: 1, lineHeight: 1.5 }}>
                  {c}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 자극 부위 다이어그램 */}
        <Typography variant="overline" color="text.secondary" sx={{ pl: 0.5 }}>
          자극 부위
        </Typography>
        <Box sx={{ mt: 0.5 }}>
          <MuscleBodyDiagram primary={primaryRegions} secondary={secondaryRegions} />
        </Box>

        <Stack spacing={1.2} sx={{ mt: 1.5 }}>
          <Row label="주동근" value={exercise.musclePrimary} color="primary.main" />
          {exercise.muscleSecondary && exercise.muscleSecondary.length > 0 && (
            <Row
              label="협응근"
              value={exercise.muscleSecondary.join(', ')}
              color="text.primary"
            />
          )}
          <Stack direction="row" spacing={0.75} sx={{ pt: 0.5 }}>
            <Chip
              size="small"
              label={CATEGORY_LABEL[exercise.category]}
              variant="outlined"
            />
            <Chip
              size="small"
              label={EQUIPMENT_LABEL[exercise.equipment]}
              variant="outlined"
            />
          </Stack>
        </Stack>

        <Box
          sx={{
            mt: 2,
            p: 1.2,
            bgcolor: 'rgba(255,107,53,0.06)',
            border: '1px solid rgba(255,107,53,0.2)',
            borderRadius: 1.5,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            🟠 진한 오렌지 = 주동근 · 옅은 오렌지 = 협응근
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Stack direction="row" spacing={1}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 60 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} color={color}>
        {value}
      </Typography>
    </Stack>
  );
}
