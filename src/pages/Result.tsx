import { Box, Stack, Typography, Paper } from '@mui/material';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { useNavigate, useLocation } from 'react-router-dom';

import BigButton from '@/components/common/BigButton';
import Confetti from '@/components/common/Confetti';
import AdBanner from '@/components/common/AdBanner';

interface ResultState {
  game?: 'word' | 'shape';
  correct?: number;
  total?: number;
}

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();
  const { game = 'word', correct = 0, total = 0 } = (location.state ?? {}) as ResultState;

  const replayPath = game === 'word' ? '/mode?game=word' : '/mode?game=shape';
  const allCorrect = total > 0 && correct === total;

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {correct > 0 && <Confetti />}

      <Stack
        spacing={3}
        alignItems="center"
        justifyContent="center"
        sx={{ flex: 1, px: 3, textAlign: 'center', zIndex: 10 }}
      >
        <Typography variant="h3" sx={{ color: 'primary.main' }}>
          {allCorrect ? '참 잘했어요! 🎉' : '잘했어요! 👏'}
        </Typography>

        <Paper
          elevation={4}
          className="tl-pop"
          sx={{
            px: 5,
            py: 4,
            borderRadius: 8,
            minWidth: 260,
          }}
        >
          <Typography sx={{ color: 'text.secondary', fontWeight: 700, mb: 1 }}>
            맞힌 문제
          </Typography>
          <Typography variant="h2" sx={{ color: 'secondary.main', mb: 2 }}>
            {correct} / {total}
          </Typography>

          <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
            <StarRoundedIcon sx={{ color: 'warning.main', fontSize: 44 }} />
            <Typography variant="h4" sx={{ color: '#B7791F', fontWeight: 800 }}>
              +{correct}
            </Typography>
          </Stack>
        </Paper>

        <Stack spacing={2} sx={{ width: '100%', maxWidth: 320, pt: 1 }}>
          <BigButton color="primary" onClick={() => navigate(replayPath, { replace: true })}>
            다시 하기
          </BigButton>
          <BigButton
            color="secondary"
            variant="outlined"
            sx={{ bgcolor: '#fff', boxShadow: 'none' }}
            onClick={() => navigate('/', { replace: true })}
          >
            홈으로
          </BigButton>
        </Stack>
      </Stack>

      {/* 결과 화면 하단 배너 광고 */}
      <AdBanner />
    </Box>
  );
}
