import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import ExerciseSetsCard from '../components/record/ExerciseSetsCard';
import RestTimer from '../components/record/RestTimer';
import ExercisePickerDialog from '../components/record/ExercisePickerDialog';
import { useAppStore } from '../store/useAppStore';
import { formatDuration } from '../utils/format';

export default function SessionEditor() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const session = useAppStore((s) => s.sessions.find((x) => x.id === id));
  const profile = useAppStore((s) => s.profile);
  const addExerciseToSession = useAppStore((s) => s.addExerciseToSession);
  const removeExerciseFromSession = useAppStore((s) => s.removeExerciseFromSession);
  const endSession = useAppStore((s) => s.endSession);
  const discardSession = useAppStore((s) => s.discardSession);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [memo, setMemo] = useState('');
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [restStart, setRestStart] = useState<number | null>(null);

  // 진행 시간 실시간 표시
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const totalVolume = useMemo(() => {
    if (!session) return 0;
    return session.exercises.reduce(
      (a, e) => a + e.sets.reduce((b, st) => b + st.weightKg * st.reps, 0),
      0,
    );
  }, [session]);

  const totalSets = useMemo(() => {
    if (!session) return 0;
    return session.exercises.reduce((a, e) => a + e.sets.length, 0);
  }, [session]);

  if (!session) {
    return (
      <Box sx={{ p: 3 }}>
        <PageHeader title="세션을 찾을 수 없어요" showBack />
        <Button onClick={() => nav('/record')}>기록 화면으로</Button>
      </Box>
    );
  }

  const durationMs =
    (session.finishedAt ? new Date(session.finishedAt).getTime() : now) -
    new Date(session.startedAt).getTime();

  const isFinished = !!session.finishedAt;

  const handleAddExercise = (ids: string[]) => {
    ids.forEach((exId) => addExerciseToSession(session.id, exId));
    setPickerOpen(false);
  };

  const handleFinish = () => {
    endSession(session.id, memo || undefined, mood);
    setFinishOpen(false);
    nav('/', { replace: true });
  };

  return (
    <Box>
      <PageHeader
        title={session.name ?? '자유 운동'}
        subtitle={isFinished ? '완료된 세션' : '기록 중'}
        showBack
      />

      {/* 상단 실시간 지표 */}
      <Box sx={{ px: 2 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            bgcolor: 'background.paper',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 2,
            p: 1.5,
          }}
        >
          <Stat label="시간" value={formatDuration(durationMs)} />
          <Stat label="세트" value={String(totalSets)} />
          <Stat label="볼륨" value={`${totalVolume.toLocaleString()}kg`} />
        </Stack>
      </Box>

      {/* 종목 카드 리스트 */}
      <Box sx={{ px: 2, mt: 2 }}>
        {session.exercises.length === 0 && (
          <Box
            sx={{
              textAlign: 'center',
              py: 5,
              color: 'text.secondary',
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 2,
            }}
          >
            <Typography variant="body2">아직 종목이 없어요</Typography>
            <Typography variant="caption">아래 “종목 추가” 버튼을 눌러주세요</Typography>
          </Box>
        )}
        {session.exercises.map((block) => (
          <ExerciseSetsCard
            key={block.exerciseId}
            sessionId={session.id}
            block={block}
            onSetLogged={() => setRestStart(Date.now())}
            onRemoveExercise={() =>
              removeExerciseFromSession(session.id, block.exerciseId)
            }
          />
        ))}
      </Box>

      {/* 하단 액션 */}
      <Box sx={{ px: 2, pb: 3, display: 'flex', gap: 1 }}>
        <Button
          fullWidth
          size="large"
          variant="outlined"
          startIcon={<AddRoundedIcon />}
          onClick={() => setPickerOpen(true)}
          disabled={isFinished}
        >
          종목 추가
        </Button>
        {!isFinished ? (
          <Button
            fullWidth
            size="large"
            variant="contained"
            color="primary"
            startIcon={<DoneAllRoundedIcon />}
            onClick={() => setFinishOpen(true)}
            disabled={totalSets === 0}
          >
            운동 완료
          </Button>
        ) : (
          <Button
            fullWidth
            size="large"
            variant="contained"
            color="error"
            startIcon={<DeleteForeverRoundedIcon />}
            onClick={() => {
              if (window.confirm('이 세션 기록을 완전히 삭제할까요?')) {
                discardSession(session.id);
                nav('/record', { replace: true });
              }
            }}
          >
            세션 삭제
          </Button>
        )}
      </Box>

      {/* 휴식 타이머 오버레이 */}
      {restStart && !isFinished && (
        <RestTimer
          startedAt={restStart}
          initialSeconds={profile.defaultRestSec}
          onDismiss={() => setRestStart(null)}
        />
      )}

      {/* 종목 추가 다이얼로그 */}
      <ExercisePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAddExercise}
        excludeIds={session.exercises.map((e) => e.exerciseId)}
      />

      {/* 완료 다이얼로그 */}
      <Dialog open={finishOpen} onClose={() => setFinishOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>운동 요약</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={1}>
              <Stat label="시간" value={formatDuration(durationMs)} />
              <Stat label="세트" value={String(totalSets)} />
              <Stat label="볼륨" value={`${totalVolume.toLocaleString()}kg`} />
            </Stack>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                오늘 컨디션
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={mood}
                onChange={(_, v) => v && setMood(v)}
                size="small"
                fullWidth
              >
                {(['😩', '😕', '🙂', '😄', '🤩'] as const).map((emoji, i) => (
                  <ToggleButton key={emoji} value={(i + 1) as 1 | 2 | 3 | 4 | 5}>
                    {emoji}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <TextField
              label="메모"
              multiline
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="오늘의 느낌·특이사항"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinishOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleFinish}>
            완료
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ flex: 1, textAlign: 'center' }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}
