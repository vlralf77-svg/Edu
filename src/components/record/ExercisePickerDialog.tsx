import { useMemo, useState } from 'react';
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
import { CATEGORY_LABEL, EQUIPMENT_LABEL, EXERCISES } from '../../data/exercises';
import type { MuscleCategory } from '../../types';

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

  return (
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
              onClick={() => toggle(ex.id)}
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
              {isSel && (
                <Chip size="small" label="선택됨" color="primary" variant="outlined" />
              )}
            </ListItemButton>
          );
        })}
      </List>
    </Dialog>
  );
}
