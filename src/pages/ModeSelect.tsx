import { Box, Stack, Typography, IconButton } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useNavigate, useSearchParams } from 'react-router-dom';

import BigButton from '@/components/common/BigButton';
import type { Difficulty } from '@/store/useGameStore';

const DIFFICULTIES: { key: Difficulty; label: string; desc: string; emoji: string }[] = [
  { key: 'easy', label: '쉬움', desc: '3개 중 고르기', emoji: '🐣' },
  { key: 'normal', label: '보통', desc: '4개 중 고르기', emoji: '🐤' },
  { key: 'hard', label: '어려움', desc: '시간 안에 고르기', emoji: '🦅' },
];

export default function ModeSelect() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const game = params.get('game'); // 'word' | 'shape'

  const isWord = game === 'word';

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <IconButton aria-label="뒤로" onClick={() => navigate('/')}>
          <ArrowBackRoundedIcon sx={{ fontSize: 30 }} />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 800, ml: 1 }}>
          {isWord ? '난이도를 골라요' : '무엇을 배울까요?'}
        </Typography>
      </Stack>

      <Stack
        spacing={2.5}
        sx={{ flex: 1, justifyContent: 'center', maxWidth: 400, width: '100%', mx: 'auto' }}
      >
        {isWord
          ? DIFFICULTIES.map((d) => (
              <BigButton
                key={d.key}
                color="primary"
                onClick={() => navigate(`/word-game?difficulty=${d.key}`)}
                startIcon={<span style={{ fontSize: 28 }}>{d.emoji}</span>}
                sx={{ flexDirection: 'column', gap: 0.3, py: 2 }}
              >
                {d.label}
                <Typography component="span" sx={{ fontSize: '0.85rem', fontWeight: 600, opacity: 0.9 }}>
                  {d.desc}
                </Typography>
              </BigButton>
            ))
          : (
            <>
              <BigButton
                color="secondary"
                onClick={() => navigate('/shape-game?type=color')}
                startIcon={<span style={{ fontSize: 28 }}>🌈</span>}
              >
                색깔 놀이
              </BigButton>
              <BigButton
                color="primary"
                onClick={() => navigate('/shape-game?type=shape')}
                startIcon={<span style={{ fontSize: 28 }}>⭐</span>}
              >
                도형 놀이
              </BigButton>
            </>
          )}
      </Stack>
    </Box>
  );
}
