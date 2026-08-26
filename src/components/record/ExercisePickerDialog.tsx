import { useMemo, useRef, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Chip,
  Dialog,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { CATEGORY_LABEL, EQUIPMENT_LABEL, EXERCISES } from '../../data/exercises';
import type { Exercise, MuscleCategory } from '../../types';
import ExerciseInfoDialog from './ExerciseInfoDialog';

const CATEGORIES: (MuscleCategory | 'ALL')[] = [
  'ALL',
  'CHEST',
  'BACK',
  'SHOULDER',
  'LEG',
  'ARM',
  'CORE',
  'CARDIO',
  'FULL',
];

const LONG_PRESS_MS = 450;

export default function ExercisePickerDialog({
  open,
  onClose,
  onSelect,
  excludeIds = [],
  multiple = true,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (ids: string[]) => void;
  excludeIds?: string[];
  multiple?: boolean;
}) {
  const [category, setCategory] = useState<MuscleCategory | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [infoExercise, setInfoExercise] = useState<Exercise | null>(null);

  // 롱프레스 상태: 타이머와 "이 롱프레스가 트리거됐는지" 플래그
  const timerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISES.filter((ex) => {
      if (excludeIds.includes(ex.id)) return false;
      if (category !== 'ALL' && ex.category !== category) return false;
      if (!q) return true;
      return (
        ex.name.toLowerCase().includes(q) ||
        (ex.nameEn?.toLowerCase().includes(q) ?? false) ||
        ex.musclePrimary.toLowerCase().includes(q)
      );
    });
  }, [category, query, excludeIds]);

  const toggle = (id: string) => {
    if (!multiple) {
      onSelect([id]);
      reset();
      return;
    }
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  };

  const reset = () => {
    setSelected([]);
    setQuery('');
    setCategory('ALL');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleConfirm = () => {
    if (selected.length === 0) return;
    onSelect(selected);
    reset();
  };

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startLongPress = (ex: Exercise) => {
    clearTimer();
    longPressedRef.current = false;
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      setInfoExercise(ex);
      // 햅틱 피드백 (지원 시)
      if (navigator.vibrate) navigator.vibrate(30);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    clearTimer();
  };

  const handleRowClick = (ex: Exercise) => {
    // 롱프레스로 정보 모달을 이미 열었다면 클릭 무시
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    toggle(ex.id);
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullScreen>
        <AppBar position="sticky" color="default" elevation={0}>
          <Toolbar sx={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <IconButton edge="start" onClick={handleClose}>
              <CloseRoundedIcon />
            </IconButton>
            <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>
              종목 선택
            </Typography>
            {multiple && (
              <Button
                onClick={handleConfirm}
                variant="contained"
                disabled={selected.length === 0}
              >
                추가 {selected.length > 0 && `(${selected.length})`}
              </Button>
            )}
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="종목명·부위 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ mt: 1.5, overflowX: 'auto', pb: 0.5 }}
          >
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={c === 'ALL' ? '전체' : CATEGORY_LABEL[c]}
                onClick={() => setCategory(c)}
                color={category === c ? 'primary' : 'default'}
                variant={category === c ? 'filled' : 'outlined'}
                size="small"
              />
            ))}
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 1, opacity: 0.7 }}
          >
            💡 종목을 길게 누르면 자극 부위 그림이 나와요
          </Typography>
        </Box>

        <List sx={{ pt: 0 }}>
          {filtered.length === 0 && (
            <Box sx={{ textAlign: 'center', p: 4, color: 'text.secondary' }}>
              검색 결과가 없어요
            </Box>
          )}
          {filtered.map((ex) => {
            const isSel = selected.includes(ex.id);
            return (
              <ListItemButton
                key={ex.id}
                onClick={() => handleRowClick(ex)}
                onTouchStart={() => startLongPress(ex)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                onTouchCancel={cancelLongPress}
                onMouseDown={() => startLongPress(ex)}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setInfoExercise(ex);
                }}
                selected={isSel}
                sx={{
                  borderLeft: '3px solid',
                  borderColor: isSel ? 'primary.main' : 'transparent',
                }}
              >
                <ListItemText
                  primary={ex.name}
                  secondary={`${CATEGORY_LABEL[ex.category]} · ${EQUIPMENT_LABEL[ex.equipment]} · ${ex.musclePrimary}`}
                  primaryTypographyProps={{ fontWeight: 600 }}
                />
                <IconButton
                  size="small"
                  edge="end"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfoExercise(ex);
                  }}
                  sx={{ mr: isSel ? 1 : 0 }}
                >
                  <InfoOutlinedIcon fontSize="small" />
                </IconButton>
                {isSel && (
                  <Chip size="small" label="선택됨" color="primary" variant="outlined" />
                )}
              </ListItemButton>
            );
          })}
        </List>
      </Dialog>

      <ExerciseInfoDialog exercise={infoExercise} onClose={() => setInfoExercise(null)} />
    </>
  );
}
