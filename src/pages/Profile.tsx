import {
  AppBar, Toolbar, IconButton, Typography, Box, Paper, Stack, Avatar, Button, Snackbar,
} from '@mui/material';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function Profile() {
  const profile = useAppStore((s) => s.profile);
  const nav = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!profile) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.peerId);
      setCopied(true);
    } catch { /* noop */ }
  };

  const share = async () => {
    const text = `[가족통화] 저는 ${profile.name} (${profile.role}) 예요. 제 ID: ${profile.peerId}`;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: '가족통화 ID', text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }
    } catch { /* noop */ }
  };

  return (
    <Box>
      <AppBar position="sticky" color="transparent" elevation={0}
        sx={{ bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <IconButton onClick={() => nav(-1)}><ArrowBackIosNewRoundedIcon /></IconButton>
          <Typography variant="h6" fontWeight={800}>내 프로필</Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3, maxWidth: 480, mx: 'auto' }}>
        <Stack spacing={3} alignItems="center">
          <Avatar sx={{ width: 96, height: 96, bgcolor: 'primary.light', fontSize: 48 }}>
            {profile.emoji}
          </Avatar>
          <Box textAlign="center">
            <Typography variant="h5" fontWeight={800}>{profile.name}</Typography>
            <Typography variant="body2" color="text.secondary">{profile.role}</Typography>
          </Box>

          <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', width: '100%' }}>
            <Typography variant="subtitle2" color="text.secondary" textAlign="center" mb={1}>
              내 ID · 가족에게 알려주세요
            </Typography>
            <Box sx={{
              p: 2, bgcolor: 'grey.50', borderRadius: 2, textAlign: 'center',
              fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 700, letterSpacing: 1,
              wordBreak: 'break-all',
            }}>
              {profile.peerId}
            </Box>

            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button
                fullWidth variant="outlined"
                startIcon={<ContentCopyRoundedIcon />}
                onClick={copy}
              >복사</Button>
              <Button
                fullWidth variant="contained"
                startIcon={<IosShareRoundedIcon />}
                onClick={share}
              >공유</Button>
            </Stack>

            <Box sx={{
              display: 'flex', justifyContent: 'center', mt: 3,
              p: 2, bgcolor: 'white', borderRadius: 2,
            }}>
              <QRCodeSVG value={profile.peerId} size={200} level="M" />
            </Box>
            <Typography variant="caption" color="text.secondary" textAlign="center" display="block" mt={1}>
              가족이 QR을 스캔하거나 ID를 입력하면 등록돼요
            </Typography>
          </Paper>

          <Typography variant="caption" color="text.secondary" textAlign="center">
            ⚠️ 이 앱은 유심 없이 데이터·와이파이로 통화합니다.<br />
            등록된 가족만 서로 전화를 걸 수 있어요.
          </Typography>
        </Stack>
      </Box>

      <Snackbar
        open={copied}
        autoHideDuration={1500}
        onClose={() => setCopied(false)}
        message="복사되었습니다"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
