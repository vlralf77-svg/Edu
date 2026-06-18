import { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Switch,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Divider,
  Snackbar,
  Alert,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import { useNavigate } from 'react-router-dom';

import StarBadge from '@/components/common/StarBadge';
import BigButton from '@/components/common/BigButton';
import { useGameStore } from '@/store/useGameStore';
import { showRewarded } from '@/utils/admob';

const REWARD_STARS = 5;

export default function Settings() {
  const navigate = useNavigate();
  const stars = useGameStore((s) => s.stars);
  const settings = useGameStore((s) => s.settings);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const addStar = useGameStore((s) => s.addStar);

  // 보호자 인증 게이트
  const [gateOpen, setGateOpen] = useState(false);
  const [a] = useState(() => 3 + Math.floor(Math.random() * 6));
  const [b] = useState(() => 2 + Math.floor(Math.random() * 6));
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(false);
  const [loadingAd, setLoadingAd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const openGate = () => {
    setAnswer('');
    setError(false);
    setGateOpen(true);
  };

  const verifyAndShowAd = async () => {
    if (parseInt(answer, 10) !== a + b) {
      setError(true);
      return;
    }
    setGateOpen(false);
    setLoadingAd(true);
    const rewarded = await showRewarded();
    setLoadingAd(false);
    if (rewarded) {
      addStar(REWARD_STARS);
      setToast(`별 ${REWARD_STARS}개를 받았어요! ⭐`);
    } else {
      setToast('광고를 끝까지 봐야 보상을 받을 수 있어요.');
    }
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center">
          <IconButton aria-label="뒤로" onClick={() => navigate('/')}>
            <ArrowBackRoundedIcon sx={{ fontSize: 30 }} />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 800, ml: 1 }}>
            설정 (보호자용)
          </Typography>
        </Stack>
        <StarBadge count={stars} />
      </Stack>

      <Stack spacing={2} sx={{ maxWidth: 480, width: '100%', mx: 'auto', flex: 1 }}>
        {/* 사운드 설정 */}
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <VolumeUpRoundedIcon color="primary" />
              <Typography sx={{ fontWeight: 700 }}>효과음</Typography>
            </Stack>
            <Switch
              checked={settings.soundEnabled}
              onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
            />
          </Stack>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <RecordVoiceOverRoundedIcon color="primary" />
              <Typography sx={{ fontWeight: 700 }}>발음 읽어주기 (TTS)</Typography>
            </Stack>
            <Switch
              checked={settings.ttsEnabled}
              onChange={(e) => updateSettings({ ttsEnabled: e.target.checked })}
            />
          </Stack>
        </Paper>

        {/* 보상형 광고 영역 */}
        <Paper sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
            <CardGiftcardRoundedIcon color="secondary" />
            <Typography sx={{ fontWeight: 800 }}>광고 보고 별 받기</Typography>
          </Stack>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem', mb: 2 }}>
            짧은 광고를 시청하면 별 {REWARD_STARS}개를 드려요. 별 5개로 힌트 1회를
            사용할 수 있어요. (보호자 확인이 필요합니다)
          </Typography>
          <BigButton
            color="secondary"
            fullWidth
            disabled={loadingAd}
            onClick={openGate}
          >
            {loadingAd ? '광고 준비 중…' : '보호자 확인 후 광고 보기'}
          </BigButton>
        </Paper>

        <Typography
          sx={{ color: 'text.secondary', fontSize: '0.78rem', textAlign: 'center', mt: 'auto', pt: 2 }}
        >
          TinyLearn은 Google 패밀리 정책을 준수합니다. 게임 플레이 중에는
          광고가 표시되지 않으며, 광고는 비개인화(COPPA)로 제공됩니다.
        </Typography>
      </Stack>

      {/* 보호자 인증 다이얼로그 (간단한 덧셈) */}
      <Dialog open={gateOpen} onClose={() => setGateOpen(false)}>
        <DialogTitle sx={{ fontWeight: 800 }}>보호자 확인</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            다음 문제를 풀어 보호자임을 확인해 주세요.
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
            {a} + {b} = ?
          </Typography>
          <TextField
            autoFocus
            fullWidth
            type="number"
            inputMode="numeric"
            value={answer}
            error={error}
            helperText={error ? '답이 맞지 않아요. 다시 확인해 주세요.' : ' '}
            onChange={(e) => {
              setAnswer(e.target.value);
              setError(false);
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setGateOpen(false)}>취소</Button>
          <Button variant="contained" onClick={verifyAndShowAd}>
            확인
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setToast(null)} sx={{ fontWeight: 700 }}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
