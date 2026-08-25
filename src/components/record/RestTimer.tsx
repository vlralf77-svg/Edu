import { useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, Slide, Stack, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { formatSeconds } from '../../utils/format';

export default function RestTimer({
  startedAt,
  initialSeconds,
  onDismiss,
}: {
  startedAt: number;
  initialSeconds: number;
  onDismiss: () => void;
}) {
  const [total, setTotal] = useState(initialSeconds);
  const [now, setNow] = useState(Date.now());
  const beeped = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const elapsed = Math.floor((now - startedAt) / 1000);
  const remain = Math.max(0, total - elapsed);
  const done = remain === 0;

  useEffect(() => {
    if (done && !beeped.current) {
      beeped.current = true;
      try {
        // 짧은 비프 (Web Audio, 브라우저·Capacitor 웹뷰 호환)
        const Ctx = (window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext) as typeof AudioContext | undefined;
        if (Ctx) {
          const ctx = new Ctx();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = 880;
          o.connect(g);
          g.connect(ctx.destination);
          g.gain.value = 0.05;
          o.start();
          setTimeout(() => {
            o.stop();
            void ctx.close();
          }, 220);
        }
        if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
      } catch {
        /* ignore */
      }
    }
  }, [done]);

  return (
    <Slide direction="up" in mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          left: 12,
          right: 12,
          bottom: 'calc(80px + env(safe-area-inset-bottom))',
          zIndex: 30,
          bgcolor: done ? 'success.main' : 'primary.main',
          color: 'primary.contrastText',
          borderRadius: 3,
          px: 2,
          py: 1.5,
          boxShadow: 8,
          transition: 'background-color 0.2s',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              {done ? '휴식 완료 - 다음 세트!' : '휴식 중'}
            </Typography>
            <Typography variant="h5" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatSeconds(remain)}{' '}
              <Typography component="span" variant="caption">
                / {formatSeconds(total)}
              </Typography>
            </Typography>
          </Box>
          <IconButton
            size="small"
            sx={{ color: 'inherit' }}
            onClick={() => setTotal((t) => Math.max(15, t - 15))}
          >
            <RemoveRoundedIcon />
          </IconButton>
          <IconButton
            size="small"
            sx={{ color: 'inherit' }}
            onClick={() => setTotal((t) => t + 15)}
          >
            <AddRoundedIcon />
          </IconButton>
          <Button
            size="small"
            variant="contained"
            color="inherit"
            sx={{ color: 'text.primary', bgcolor: 'background.paper' }}
            onClick={onDismiss}
          >
            건너뛰기
          </Button>
          <IconButton size="small" sx={{ color: 'inherit' }} onClick={onDismiss}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </Box>
    </Slide>
  );
}
