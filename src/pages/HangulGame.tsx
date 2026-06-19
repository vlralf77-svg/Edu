import { useRef, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Button,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import { useNavigate } from 'react-router-dom';

import TraceBoard, { type TraceBoardHandle } from '@/components/hangul/TraceBoard';
import { consonants, vowels, type HangulItem } from '@/data/hangulData';
import { useTTS } from '@/hooks/useTTS';
import { useSound } from '@/hooks/useSound';

type Kind = 'consonant' | 'vowel';

export default function HangulGame() {
  const navigate = useNavigate();
  const { speak } = useTTS();
  const { play } = useSound();

  const [kind, setKind] = useState<Kind>('consonant');
  const [index, setIndex] = useState(0);
  const boardRef = useRef<TraceBoardHandle>(null);

  const list: HangulItem[] = kind === 'consonant' ? consonants : vowels;
  const current = list[index];

  const changeKind = (k: Kind | null) => {
    if (!k) return;
    setKind(k);
    setIndex(0);
  };

  const select = (i: number) => {
    setIndex(i);
    play('tap');
    // 글자 선택 시 발음도 들려줌
    speak(list[i].name, 'ko-KR');
  };

  const pronounce = () => speak(current.name, 'ko-KR');

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
      {/* 헤더 */}
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <IconButton aria-label="뒤로" onClick={() => navigate('/')}>
          <ArrowBackRoundedIcon sx={{ fontSize: 30 }} />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 800, ml: 1 }}>
          한글 배우기
        </Typography>
      </Stack>

      {/* 자음 / 모음 전환 */}
      <Stack alignItems="center" sx={{ mb: 1 }}>
        <ToggleButtonGroup
          value={kind}
          exclusive
          onChange={(_, v) => changeKind(v)}
          sx={{
            '& .MuiToggleButton-root': {
              px: 3,
              py: 1,
              fontWeight: 800,
              fontSize: '1.05rem',
              borderRadius: 999,
            },
            '& .Mui-selected': { bgcolor: 'primary.main', color: '#fff' },
            '& .Mui-selected:hover': { bgcolor: 'primary.dark' },
          }}
        >
          <ToggleButton value="consonant">자음 (ㄱㄴㄷ)</ToggleButton>
          <ToggleButton value="vowel">모음 (ㅏㅑㅓ)</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* 따라쓰기 보드 + 발음 */}
      <Stack alignItems="center" spacing={1.5} sx={{ my: 1 }}>
        <Typography sx={{ fontWeight: 800, color: 'text.secondary' }}>
          따라 써 보세요!
        </Typography>
        <Box sx={{ position: 'relative' }}>
          <TraceBoard ref={boardRef} char={current.char} size={260} />
          {/* 발음 버튼 */}
          <IconButton
            aria-label={`${current.name} 발음 듣기`}
            onClick={pronounce}
            sx={{
              position: 'absolute',
              bottom: -10,
              right: -10,
              bgcolor: 'secondary.main',
              color: '#fff',
              width: 56,
              height: 56,
              boxShadow: '0 4px 0 rgba(0,0,0,0.12)',
              '&:hover': { bgcolor: 'secondary.dark' },
              '&:active': { transform: 'translateY(2px)' },
            }}
          >
            <VolumeUpRoundedIcon sx={{ fontSize: 32 }} />
          </IconButton>
        </Box>

        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: 'primary.dark' }}>
          {current.char} <span style={{ color: '#6E6E87' }}>· {current.name}</span>
        </Typography>

        <Button
          variant="outlined"
          startIcon={<RestartAltRoundedIcon />}
          onClick={() => boardRef.current?.clear()}
          sx={{ borderRadius: 999, fontWeight: 700 }}
        >
          지우기
        </Button>
      </Stack>

      {/* 글자 선택 그리드 */}
      <Box
        sx={{
          mt: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 1,
          maxWidth: 420,
          width: '100%',
          mx: 'auto',
        }}
      >
        {list.map((item, i) => (
          <Box
            key={item.char}
            onClick={() => select(i)}
            sx={{
              aspectRatio: '1 / 1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              fontWeight: 800,
              borderRadius: 3,
              cursor: 'pointer',
              bgcolor: i === index ? 'primary.main' : '#fff',
              color: i === index ? '#fff' : 'text.primary',
              boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
            }}
          >
            {item.char}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
