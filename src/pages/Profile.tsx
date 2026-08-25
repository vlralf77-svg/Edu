import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import { useAppStore } from '../store/useAppStore';
import type { GoalType, Experience } from '../types';
import { todayISO } from '../utils/format';

const GOAL_LABEL: Record<GoalType, string> = {
  BULK: '벌크업',
  CUT: '컷팅',
  MAINTAIN: '유지',
  STRENGTH: '스트렝스',
};
const EXP_LABEL: Record<Experience, string> = {
  BEGINNER: '초급',
  INTERMEDIATE: '중급',
  ADVANCED: '상급',
};

export default function Profile() {
  const nav = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const body = useAppStore((s) => s.bodyRecords);
  const upsertBody = useAppStore((s) => s.upsertBody);
  const deleteBody = useAppStore((s) => s.deleteBody);
  const resetAll = useAppStore((s) => s.resetAll);

  const [bodyOpen, setBodyOpen] = useState(false);

  return (
    <Box>
      <PageHeader title="마이" subtitle="프로필·신체 기록·설정" />

      {/* 프로필 카드 */}
      <Box sx={{ px: 2 }}>
        <Card>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              프로필
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <TextField
                label="닉네임"
                size="small"
                value={profile.nickname}
                onChange={(e) => updateProfile({ nickname: e.target.value })}
              />
              <TextField
                label="키 (cm)"
                size="small"
                type="number"
                value={profile.heightCm ?? ''}
                onChange={(e) =>
                  updateProfile({
                    heightCm: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
              <Stack direction="row" spacing={1}>
                <Select
                  size="small"
                  value={profile.goalType ?? ''}
                  onChange={(e) => updateProfile({ goalType: e.target.value as GoalType })}
                  displayEmpty
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="" disabled>
                    목표
                  </MenuItem>
                  {(Object.keys(GOAL_LABEL) as GoalType[]).map((g) => (
                    <MenuItem key={g} value={g}>
                      {GOAL_LABEL[g]}
                    </MenuItem>
                  ))}
                </Select>
                <Select
                  size="small"
                  value={profile.experience ?? ''}
                  onChange={(e) =>
                    updateProfile({ experience: e.target.value as Experience })
                  }
                  displayEmpty
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="" disabled>
                    경력
                  </MenuItem>
                  {(Object.keys(EXP_LABEL) as Experience[]).map((x) => (
                    <MenuItem key={x} value={x}>
                      {EXP_LABEL[x]}
                    </MenuItem>
                  ))}
                </Select>
              </Stack>
              <TextField
                label="기본 휴식 시간 (초)"
                size="small"
                type="number"
                value={profile.defaultRestSec}
                onChange={(e) =>
                  updateProfile({
                    defaultRestSec: Math.max(15, parseInt(e.target.value, 10) || 90),
                  })
                }
              />
            </Stack>
          </CardContent>
        </Card>

        {/* 루틴 관리 */}
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="overline" color="text.secondary">
                루틴 관리
              </Typography>
              <Button size="small" onClick={() => nav('/routines/new')}>
                새 루틴
              </Button>
            </Stack>
            <Button
              fullWidth
              variant="outlined"
              sx={{ mt: 1 }}
              onClick={() => nav('/record')}
            >
              루틴 목록 보기
            </Button>
          </CardContent>
        </Card>

        {/* 신체 기록 */}
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="overline" color="text.secondary">
                신체 기록
              </Typography>
              <Button
                size="small"
                startIcon={<AddRoundedIcon />}
                onClick={() => setBodyOpen(true)}
              >
                추가
              </Button>
            </Stack>
            {body.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                기록이 없어요
              </Typography>
            ) : (
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {[...body]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 8)
                  .map((b) => (
                    <Stack
                      key={b.date}
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{ py: 0.5 }}
                    >
                      <Typography variant="body2" sx={{ minWidth: 90 }}>
                        {b.date}
                      </Typography>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {b.weightKg ? `${b.weightKg}kg` : '—'}
                        {b.bodyFatPct ? ` · 체지방 ${b.bodyFatPct}%` : ''}
                        {b.skeletalMuscleKg ? ` · 골격근 ${b.skeletalMuscleKg}kg` : ''}
                      </Typography>
                      <IconButton size="small" onClick={() => deleteBody(b.date)}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* 위험 영역 */}
        <Card sx={{ mt: 2, mb: 3, border: '1px solid rgba(248,113,113,0.3)' }}>
          <CardContent>
            <Typography variant="overline" color="error.main">
              데이터 초기화
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              모든 운동/식단/신체 기록을 삭제하고 기본 루틴만 남깁니다.
            </Typography>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              sx={{ mt: 1.5 }}
              onClick={() => {
                if (window.confirm('정말 모든 데이터를 초기화할까요?')) resetAll();
              }}
            >
              초기화
            </Button>
          </CardContent>
        </Card>
      </Box>

      <BodyAddDialog
        open={bodyOpen}
        onClose={() => setBodyOpen(false)}
        onSave={(rec) => {
          upsertBody(rec);
          setBodyOpen(false);
        }}
      />
    </Box>
  );
}

function BodyAddDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (rec: {
    date: string;
    weightKg?: number;
    bodyFatPct?: number;
    skeletalMuscleKg?: number;
  }) => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [w, setW] = useState('');
  const [bf, setBf] = useState('');
  const [sm, setSm] = useState('');

  const handleSave = () => {
    onSave({
      date,
      weightKg: w ? parseFloat(w) : undefined,
      bodyFatPct: bf ? parseFloat(bf) : undefined,
      skeletalMuscleKg: sm ? parseFloat(sm) : undefined,
    });
    setW('');
    setBf('');
    setSm('');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>신체 기록 추가</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField
            size="small"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <TextField
            size="small"
            label="체중 (kg)"
            type="number"
            value={w}
            onChange={(e) => setW(e.target.value)}
          />
          <TextField
            size="small"
            label="체지방률 (%)"
            type="number"
            value={bf}
            onChange={(e) => setBf(e.target.value)}
          />
          <TextField
            size="small"
            label="골격근량 (kg)"
            type="number"
            value={sm}
            onChange={(e) => setSm(e.target.value)}
          />
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
