import {
  Box, Typography, Stack, Avatar, IconButton, Paper,
} from '@mui/material';
import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded';
import CallRoundedIcon from '@mui/icons-material/CallRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCallStore } from '../store/useCallStore';
import {
  answerIncoming, rejectIncoming, hangup, toggleMute,
} from '../components/CallProvider';
import { tapHaptic } from '../services/notify';

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Call() {
  const status = useCallStore((s) => s.status);
  const remoteName = useCallStore((s) => s.remoteName);
  const remoteEmoji = useCallStore((s) => s.remoteEmoji);
  const remoteId = useCallStore((s) => s.remoteId);
  const duration = useCallStore((s) => s.durationSec);
  const muted = useCallStore((s) => s.muted);
  const lastError = useCallStore((s) => s.lastError);
  const nav = useNavigate();

  // 통화 상태가 idle 이면 홈으로
  useEffect(() => {
    if (status === 'idle') nav('/', { replace: true });
  }, [status, nav]);

  const bgcolor =
    status === 'incoming' ? 'primary.dark'
    : status === 'active' ? 'primary.main'
    : status === 'ended' ? 'grey.700'
    : 'primary.dark';

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor, color: 'white',
      display: 'flex', flexDirection: 'column',
      p: 3,
    }}>
      {/* 상단: 상태 & 이름 */}
      <Stack alignItems="center" spacing={1} sx={{ mt: 6 }}>
        <Typography variant="body1" sx={{ opacity: 0.85 }}>
          {status === 'calling' && '전화 거는 중…'}
          {status === 'incoming' && '가족에게서 전화가 왔어요'}
          {status === 'active' && '통화 중'}
          {status === 'ended' && '통화 종료'}
        </Typography>
        <Typography variant="h3" fontWeight={800}>
          {remoteName ?? '알 수 없음'}
        </Typography>
        {remoteId && (
          <Typography variant="caption" sx={{ opacity: 0.7, fontFamily: 'monospace' }}>
            {remoteId}
          </Typography>
        )}
        {status === 'active' && (
          <Typography variant="h5" sx={{ opacity: 0.9, mt: 1, fontVariantNumeric: 'tabular-nums' }}>
            {formatDuration(duration)}
          </Typography>
        )}
      </Stack>

      {/* 가운데: 아바타 */}
      <Box sx={{
        flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Avatar
          className={status === 'incoming' ? 'fc-ring fc-shake' : status === 'calling' ? 'fc-ring' : undefined}
          sx={{
            width: 200, height: 200, fontSize: 100,
            bgcolor: 'rgba(255,255,255,0.16)',
          }}
        >
          {remoteEmoji ?? '👤'}
        </Avatar>
      </Box>

      {lastError && (
        <Paper elevation={0} sx={{
          p: 1.5, mb: 2, bgcolor: 'rgba(0,0,0,0.25)', color: 'white', textAlign: 'center',
        }}>
          <Typography variant="body2">{lastError}</Typography>
        </Paper>
      )}

      {/* 하단: 액션 */}
      <Box sx={{ pb: 4 }}>
        {status === 'incoming' ? (
          <Stack direction="row" justifyContent="space-around" alignItems="center">
            <Stack alignItems="center" spacing={1}>
              <IconButton
                size="large"
                onClick={() => { void tapHaptic(); rejectIncoming(); }}
                sx={{
                  width: 80, height: 80, bgcolor: 'error.main',
                  '&:hover': { bgcolor: 'error.dark' },
                  color: 'white',
                }}
              >
                <CallEndRoundedIcon sx={{ fontSize: 40 }} />
              </IconButton>
              <Typography variant="caption">거절</Typography>
            </Stack>
            <Stack alignItems="center" spacing={1}>
              <IconButton
                size="large"
                onClick={() => { void tapHaptic(); void answerIncoming(); }}
                sx={{
                  width: 80, height: 80, bgcolor: 'success.main',
                  '&:hover': { bgcolor: 'success.dark' },
                  color: 'white',
                }}
              >
                <CallRoundedIcon sx={{ fontSize: 40 }} />
              </IconButton>
              <Typography variant="caption">받기</Typography>
            </Stack>
          </Stack>
        ) : status === 'active' ? (
          <Stack direction="row" justifyContent="space-around" alignItems="center">
            <Stack alignItems="center" spacing={1}>
              <IconButton
                onClick={() => { void tapHaptic(); toggleMute(); }}
                sx={{
                  width: 64, height: 64,
                  bgcolor: muted ? 'error.main' : 'rgba(255,255,255,0.2)',
                  color: 'white',
                  '&:hover': { bgcolor: muted ? 'error.dark' : 'rgba(255,255,255,0.3)' },
                }}
              >
                {muted ? <MicOffRoundedIcon /> : <MicRoundedIcon />}
              </IconButton>
              <Typography variant="caption">{muted ? '음소거 해제' : '음소거'}</Typography>
            </Stack>
            <Stack alignItems="center" spacing={1}>
              <IconButton
                onClick={() => { void tapHaptic(); hangup(); }}
                sx={{
                  width: 80, height: 80, bgcolor: 'error.main',
                  color: 'white',
                  '&:hover': { bgcolor: 'error.dark' },
                }}
              >
                <CallEndRoundedIcon sx={{ fontSize: 40 }} />
              </IconButton>
              <Typography variant="caption">종료</Typography>
            </Stack>
            <Stack alignItems="center" spacing={1}>
              <IconButton
                sx={{
                  width: 64, height: 64,
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                }}
                disabled
              >
                <VolumeUpRoundedIcon />
              </IconButton>
              <Typography variant="caption">스피커</Typography>
            </Stack>
          </Stack>
        ) : (
          // calling / ended
          <Stack alignItems="center">
            <IconButton
              onClick={() => { void tapHaptic(); hangup(); }}
              sx={{
                width: 80, height: 80, bgcolor: 'error.main',
                color: 'white',
                '&:hover': { bgcolor: 'error.dark' },
              }}
            >
              <CallEndRoundedIcon sx={{ fontSize: 40 }} />
            </IconButton>
            <Typography variant="caption" sx={{ mt: 1 }}>
              {status === 'calling' ? '취소' : '닫기'}
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
