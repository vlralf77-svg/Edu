import {
  AppBar, Toolbar, IconButton, Typography, Box, Paper, Stack, TextField,
  MenuItem, Button, Alert,
} from '@mui/material';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAppStore, FamilyRole } from '../store/useAppStore';

const ROLES: FamilyRole[] = ['엄마', '아빠', '아들', '딸', '할머니', '할아버지', '형', '누나', '오빠', '언니', '동생', '기타'];
const EMOJIS = ['👩', '👨', '👦', '👧', '👵', '👴', '🧒', '👶', '🐻', '🐰', '🐱', '🐶'];

export default function AddFamily() {
  const addFamily = useAppStore((s) => s.addFamily);
  const findFamily = useAppStore((s) => s.findFamily);
  const profile = useAppStore((s) => s.profile);
  const nav = useNavigate();

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<FamilyRole>('엄마');
  const [emoji, setEmoji] = useState('👩');
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const trimmedId = id.trim();
    const trimmedName = name.trim();
    if (!trimmedId || !trimmedName) {
      setErr('ID와 이름을 모두 입력해 주세요.'); return;
    }
    if (trimmedId === profile?.peerId) {
      setErr('본인의 ID 는 등록할 수 없어요.'); return;
    }
    if (findFamily(trimmedId)) {
      setErr('이미 등록된 가족이에요.'); return;
    }
    addFamily({
      id: trimmedId, name: trimmedName, role, emoji, addedAt: Date.now(),
    });
    nav('/', { replace: true });
  };

  return (
    <Box>
      <AppBar position="sticky" color="transparent" elevation={0}
        sx={{ bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <IconButton onClick={() => nav(-1)}><ArrowBackIosNewRoundedIcon /></IconButton>
          <Typography variant="h6" fontWeight={800}>가족 추가</Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3, maxWidth: 480, mx: 'auto' }}>
        <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper' }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" mb={0.5}>
                상대방 ID
              </Typography>
              <TextField
                fullWidth
                placeholder="예: fam-a1b2c3d4"
                value={id}
                onChange={(e) => { setId(e.target.value); setErr(null); }}
                inputProps={{ style: { fontFamily: 'monospace' } }}
              />
              <Typography variant="caption" color="text.secondary">
                상대방의 "내 프로필" 화면에서 ID 를 확인·복사할 수 있어요.
              </Typography>
            </Box>

            <TextField
              label="가족 이름 (별명)"
              value={name}
              onChange={(e) => { setName(e.target.value); setErr(null); }}
              inputProps={{ maxLength: 20 }}
            />
            <TextField
              select label="관계"
              value={role}
              onChange={(e) => setRole(e.target.value as FamilyRole)}
            >
              {ROLES.map((r) => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </TextField>

            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>이모지</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {EMOJIS.map((e) => (
                  <Box
                    key={e}
                    onClick={() => setEmoji(e)}
                    sx={{
                      width: 44, height: 44, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, cursor: 'pointer',
                      border: emoji === e ? '3px solid' : '2px solid transparent',
                      borderColor: emoji === e ? 'primary.main' : 'transparent',
                      bgcolor: emoji === e ? 'primary.light' : 'grey.100',
                    }}
                  >{e}</Box>
                ))}
              </Box>
            </Box>

            {err && <Alert severity="error">{err}</Alert>}

            <Button
              variant="contained" size="large"
              onClick={submit}
              sx={{ py: 1.5, fontSize: '1.05rem' }}
            >
              가족 등록하기
            </Button>
          </Stack>
        </Paper>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
          🔒 여기서 등록된 가족만 서로 전화를 걸 수 있어요.
        </Typography>
      </Box>
    </Box>
  );
}
