import { useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PageHeader from '../components/layout/PageHeader';
import { useAppStore } from '../store/useAppStore';
import { FOODS } from '../data/foods';
import type { MealType } from '../types';
import { todayISO } from '../utils/format';

const MEAL_LABEL: Record<MealType, string> = {
  BREAKFAST: '아침',
  LUNCH: '점심',
  DINNER: '저녁',
  SNACK: '간식',
};

// 목표 (프로필 기반이면 좋지만 MVP: 상수)
const GOAL = { kcal: 2200, proteinG: 140, carbsG: 260, fatG: 65 };

export default function Meals() {
  const meals = useAppStore((s) => s.meals);
  const addMeal = useAppStore((s) => s.addMeal);
  const deleteMeal = useAppStore((s) => s.deleteMeal);

  const [date, setDate] = useState(todayISO());
  const [open, setOpen] = useState(false);

  const dayMeals = useMemo(
    () => meals.filter((m) => m.date === date).sort((a, b) => a.time.localeCompare(b.time)),
    [meals, date],
  );

  const totals = dayMeals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.calories,
      p: acc.p + m.proteinG,
      c: acc.c + m.carbsG,
      f: acc.f + m.fatG,
    }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

  return (
    <Box>
      <PageHeader title="식단" subtitle="타임라인·영양소 추적" />

      <Box sx={{ px: 2 }}>
        <TextField
          type="date"
          size="small"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          fullWidth
        />

        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              오늘 섭취 · 목표 대비
            </Typography>
            <Stack spacing={1.2} sx={{ mt: 1 }}>
              <NutRow label="칼로리" value={totals.kcal} goal={GOAL.kcal} unit="kcal" color="#FF6B35" />
              <NutRow label="단백질" value={totals.p} goal={GOAL.proteinG} unit="g" color="#4ECDC4" />
              <NutRow label="탄수화물" value={totals.c} goal={GOAL.carbsG} unit="g" color="#FBBF24" />
              <NutRow label="지방" value={totals.f} goal={GOAL.fatG} unit="g" color="#F87171" />
            </Stack>
          </CardContent>
        </Card>

        <Button
          fullWidth
          variant="contained"
          startIcon={<AddRoundedIcon />}
          sx={{ mt: 2 }}
          onClick={() => setOpen(true)}
        >
          식단 추가
        </Button>

        <Box sx={{ mt: 2, mb: 3 }}>
          {(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as MealType[]).map((mt) => {
            const items = dayMeals.filter((m) => m.mealType === mt);
            if (items.length === 0) return null;
            return (
              <Box key={mt} sx={{ mb: 1.5 }}>
                <Typography variant="overline" color="text.secondary" sx={{ pl: 0.5 }}>
                  {MEAL_LABEL[mt]}
                </Typography>
                <Stack spacing={1} sx={{ mt: 0.5 }}>
                  {items.map((m) => (
                    <Card key={m.id}>
                      <CardContent sx={{ py: 1.2, '&:last-child': { pb: 1.2 } }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={600} noWrap>
                              {m.time} · {m.foodName}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 0.3 }}>
                              <Chip size="small" label={`${m.calories}kcal`} variant="outlined" />
                              <Chip size="small" label={`P ${m.proteinG}g`} variant="outlined" />
                              <Chip size="small" label={`C ${m.carbsG}g`} variant="outlined" />
                              <Chip size="small" label={`F ${m.fatG}g`} variant="outlined" />
                            </Stack>
                          </Box>
                          <IconButton onClick={() => deleteMeal(m.id)}>
                            <DeleteOutlineRoundedIcon />
                          </IconButton>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Box>
            );
          })}
          {dayMeals.length === 0 && (
            <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
              <Typography variant="body2">이 날의 식단이 없어요</Typography>
            </Box>
          )}
        </Box>
      </Box>

      <MealAddDialog
        open={open}
        onClose={() => setOpen(false)}
        onSave={(payload) => {
          addMeal({ ...payload, date });
          setOpen(false);
        }}
      />
    </Box>
  );
}

function NutRow({
  label,
  value,
  goal,
  unit,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
}) {
  const pct = Math.min(100, (value / goal) * 100);
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" fontFamily="monospace">
          {Math.round(value)} / {goal} {unit}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          mt: 0.4,
          height: 6,
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.06)',
          '& .MuiLinearProgress-bar': { bgcolor: color },
        }}
      />
    </Box>
  );
}

function MealAddDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (m: {
    time: string;
    mealType: MealType;
    foodName: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }) => void;
}) {
  const [mealType, setMealType] = useState<MealType>('LUNCH');
  const [time, setTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [foodName, setFoodName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');

  const handleSelectFood = (name: string) => {
    setFoodName(name);
    const found = FOODS.find((x) => x.name === name);
    if (found) {
      setKcal(String(found.kcal));
      setP(String(found.proteinG));
      setC(String(found.carbsG));
      setF(String(found.fatG));
    }
  };

  const handleSave = () => {
    if (!foodName.trim()) return;
    onSave({
      time,
      mealType,
      foodName: foodName.trim(),
      calories: Number(kcal) || 0,
      proteinG: Number(p) || 0,
      carbsG: Number(c) || 0,
      fatG: Number(f) || 0,
    });
    setFoodName('');
    setKcal('');
    setP('');
    setC('');
    setF('');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>식단 추가</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1}>
            <Select
              size="small"
              value={mealType}
              onChange={(e) => setMealType(e.target.value as MealType)}
              sx={{ minWidth: 100 }}
            >
              {(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as MealType[]).map((m) => (
                <MenuItem key={m} value={m}>
                  {MEAL_LABEL[m]}
                </MenuItem>
              ))}
            </Select>
            <TextField
              size="small"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              sx={{ flex: 1 }}
            />
          </Stack>
          <Autocomplete
            freeSolo
            options={FOODS.map((f) => f.name)}
            inputValue={foodName}
            onInputChange={(_, v) => setFoodName(v)}
            onChange={(_, v) => v && handleSelectFood(v as string)}
            renderInput={(params) => (
              <TextField {...params} size="small" label="음식 이름 (검색)" />
            )}
          />
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              label="칼로리"
              type="number"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              onFocus={(e) => e.target.select()}
              sx={{ flex: 1 }}
              placeholder="0"
            />
            <TextField
              size="small"
              label="단백질(g)"
              type="number"
              value={p}
              onChange={(e) => setP(e.target.value)}
              onFocus={(e) => e.target.select()}
              sx={{ flex: 1 }}
              placeholder="0"
            />
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              label="탄수(g)"
              type="number"
              value={c}
              onChange={(e) => setC(e.target.value)}
              onFocus={(e) => e.target.select()}
              sx={{ flex: 1 }}
              placeholder="0"
            />
            <TextField
              size="small"
              label="지방(g)"
              type="number"
              value={f}
              onChange={(e) => setF(e.target.value)}
              onFocus={(e) => e.target.select()}
              sx={{ flex: 1 }}
              placeholder="0"
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={handleSave}>
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}
