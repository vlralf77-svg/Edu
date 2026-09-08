import {
  AppBar, Toolbar, Typography, IconButton, Box, Paper, Stack, Avatar,
  List, ListItem, ListItemAvatar, ListItemText, Button, Chip, Fab, Divider,
} from '@mui/material';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import CircleIcon from '@mui/icons-material/Circle';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useCallStore } from '../store/useCallStore';
import { startCallTo } from '../components/CallProvider';
import { tapHaptic } from '../services/notify';

export default function Home() {
  const profile = useAppStore((s) => s.profile);
  const family = useAppStore((s) => s.family);
  const peerReady = useCallStore((s) => s.peerReady);
  const nav = useNavigate();

  return (
    <Box sx={{ pb: 12 }}>
      <AppBar position="sticky" color="transparent" elevation={0}
        sx={{ bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1 }}>
            우리가족
          </Typography>
          <IconButton onClick={() => { void tapHaptic(); nav('/profile'); }}>
            <QrCode2RoundedIcon />
          </IconButton>
          <IconButton onClick={() => { void tapHaptic(); nav('/profile'); }}>
            <PersonRoundedIcon />
          </IconButton>
          <IconButton onClick={() => { void tapHaptic(); nav('/settings'); }}>
            <SettingsRoundedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2, maxWidth: 560, mx: 'auto' }}>
        {/* 내 상태 카드 */}
        <Paper elevation={0} sx={{
          p: 2, mb: 2, bgcolor: 'primary.main', color: 'primary.contrastText',
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: 'rgba(255,255,255,0.25)', fontSize: 28 }}>
            {profile?.emoji}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>{profile?.role}</Typography>
            <Typography variant="h6" fontWeight={800}>{profile?.name}</Typography>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
              <CircleIcon sx={{ fontSize: 10, color: peerReady ? '#5EEAD4' : '#FCA5A5' }} />
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                {peerReady ? '온라인 · 통화 가능' : '연결 중…'}
              </Typography>
            </Stack>
          </Box>
          <Chip
            size="small"
            label={profile?.peerId}
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontFamily: 'monospace' }}
            onClick={() => nav('/profile')}
          />
        </Paper>

        {/* 가족 목록 */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1, mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={800}>
            우리 가족 ({family.length})
          </Typography>
          <Button
            startIcon={<PersonAddAlt1RoundedIcon />}
            onClick={() => nav('/add')}
            size="small"
          >
            추가
          </Button>
        </Stack>

        {family.length === 0 ? (
          <Paper elevation={0} sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper' }}>
            <Typography variant="h1" sx={{ fontSize: 56, mb: 1 }}>👨‍👩‍👧‍👦</Typography>
            <Typography variant="body1" color="text.secondary" mb={2}>
              등록된 가족이 아직 없어요
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              가족의 ID를 추가하면 데이터/와이파이로<br />무료 통화를 걸 수 있어요.
            </Typography>
            <Button
              variant="contained"
              startIcon={<PersonAddAlt1RoundedIcon />}
              onClick={() => nav('/add')}
            >
              가족 추가하기
            </Button>
          </Paper>
        ) : (
          <Paper elevation={0} sx={{ bgcolor: 'background.paper', overflow: 'hidden' }}>
            <List disablePadding>
              {family.map((m, idx) => (
                <Box key={m.id}>
                  {idx > 0 && <Divider component="li" />}
                  <ListItem
                    secondaryAction={
                      <Fab
                        size="small"
                        color="primary"
                        aria-label={`${m.name} 에게 전화`}
                        disabled={!peerReady}
                        onClick={() => {
                          void tapHaptic();
                          void startCallTo(m.id, m.name, m.emoji);
                        }}
                        sx={{ boxShadow: 'none' }}
                      >
                        <PhoneRoundedIcon />
                      </Fab>
                    }
                    sx={{ py: 1.5 }}
                    onClick={() => nav(`/family/${encodeURIComponent(m.id)}`)}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.contrastText', fontSize: 24 }}>
                        {m.emoji}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography fontWeight={700}>
                          {m.name} <Typography component="span" variant="caption" color="text.secondary">· {m.role}</Typography>
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {m.id}
                        </Typography>
                      }
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </Paper>
        )}

        {!peerReady && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
            네트워크에 연결 중이에요… (Wi-Fi 또는 모바일 데이터 필요)
          </Typography>
        )}
      </Box>
    </Box>
  );
}
