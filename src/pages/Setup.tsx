import { useState } from 'react';
import {
  Box, Typography, TextField, MenuItem, Button, Paper, Stack, Avatar,
} from '@mui/material';
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded';
import { useAppStore, generatePeerId, FamilyRole } from '../store/useAppStore';

const ROLES: FamilyRole[] = ['엄마', '아빠', '아들', '딸', '할머니', '할아버지', '형', '누나', '오빠', '언니', '동생', '기타'];
const EMOJIS = ['👩', '👨', '👦', '👧', '👵', '👴', '🧒', '👶', '🐻', '🐰', '🐱', '🐶'];

export default function Setup() {
  const setProfile = useAppStore((s) => s.setProfile);
  const [name, setName] = useState('');
  const [role, setRole] = useState<FamilyRole>('엄마');
  const [emoji, setEmoji] = useState('👩');

  const submit = () => {
    if (!name.trim()) return;
    setProfile({
      peerId: generatePeerId(),
      name: name.trim(),
      role,
      emoji,
    });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 480, mx: 'auto' }}>
      <Stack spacing={3} alignItems="center" sx={{ mt: 3 }}>
        <Avatar sx={{ width: 84, height: 84, bgcolor: 'primary.main' }}>
          <PhoneInTalkRoundedIcon sx={{ fontSize: 44 }} />
        </Avatar>
        <Typography variant="h4" fontWeight={800} textAlign="center">
          가족통화
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center">
          유심 없이 데이터·와이파이만으로<br />
          가족과 무료 통화하세요
        </Typography>

        <Paper elevation={0} sx={{ p: 3, width: '100%', bgcolor: 'background.paper' }}>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            내 프로필 만들기
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="이름 또는 별명"
              value={name}
              onChange={(e) => setName(e.target.value)}
              inputProps={{ maxLength: 20 }}
              autoFocus
            />
            <TextField
              select label="가족 내 호칭"
              value={role}
              onChange={(e) => setRole(e.target.value as FamilyRole)}
            >
              {ROLES.map((r) => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </TextField>
            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>프로필 이모지</Typography>
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
            <Button
              variant="contained" size="large"
              disabled={!name.trim()}
              onClick={submit}
              sx={{ py: 1.5, fontSize: '1.1rem' }}
            >
              시작하기
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
