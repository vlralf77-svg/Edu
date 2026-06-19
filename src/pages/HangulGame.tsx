import { useMemo, useRef, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useNavigate } from 'react-router-dom';

import StrokeBoard, { type StrokeBoardHandle } from '@/components/hangul/StrokeBoard';
import { consonants, vowels } from '@/data/hangulData';
import { jamoStrokes, type Stroke } from '@/data/strokeData';
import { getStrokesForText } from '@/utils/hangulStrokes';
import { wordData } from '@/data/wordData';
import { useTTS } from '@/hooks/useTTS';
import { useSound } from '@/hooks/useSound';
import { useGameStore } from '@/store/useGameStore';

type Mode = 'consonant' | 'vowel' | 'name' | 'word';

const basicWords = wordData.slice(0, 100);

export default function HangulGame() {
  const navigate = useNavigate();
  const { speak } = useTTS();
  const { play } = useSound();

  const childName = useGameStore((s) => s.childName);
  const setChildName = useGameStore((s) => s.setChildName);
  const addStar = useGameStore((s) => s.addStar);
  const addCorrect = useGameStore((s) => s.addCorrect);

  const [mode, setMode] = useState<Mode>('consonant');
  const [index, setIndex] = useState(0);
  const boardRef = useRef<StrokeBoardHandle>(null);

  const [nameOpen, setNameOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const view = useMemo(() => {
    if (mode === 'consonant') {
      const it = consonants[index] ?? consonants[0];
      return { trace: it.char, speak: it.name, label: `${it.char} · ${it.name}`, picture: '', count: consonants.length, strokes: jamoStrokes[it.char] ?? [] };
    }
    if (mode === 'vowel') {
      const it = vowels[index] ?? vowels[0];
      return { trace: it.char, speak: it.name, label: `${it.char} · ${it.name}`, picture: '', count: vowels.length, strokes: jamoStrokes[it.char] ?? [] };
    }
    if (mode === 'word') {
      const it = basicWords[index] ?? basicWords[0];
      return { trace: it.ko, speak: it.ko, label: it.ko, picture: it.emoji, count: basicWords.length, strokes: getStrokesForText(it.ko) };
    }
    // name
    return { trace: childName, speak: childName, label: childName, picture: '', count: 0, strokes: getStrokesForText(childName) as Stroke[] };
  }, [mode, index, childName]);

  const changeMode = (m: Mode | null) => {
    if (!m) return;
    setMode(m);
    setIndex(0);
  };

  const speakItem = (i: number) => {
    const t =
      mode === 'consonant' ? consonants[i].name
      : mode === 'vowel' ? vowels[i].name
      : basicWords[i].ko;
    speak(t, 'ko-KR');
  };

  const go = (delta: number) => {
    if (view.count === 0) return;
    const next = (index + delta + view.count) % view.count;
    setIndex(next);
    play('tap');
    speakItem(next);
  };
  const select = (i: number) => {
    setIndex(i);
    play('tap');
    speakItem(i);
  };

  const pronounce = () => view.speak && speak(view.speak, 'ko-KR');

  // "다 썼어요" — 충분히 썼으면 별 보상, 부족하면 시범 재생
  const onDone = () => {
    const cov = boardRef.current?.coverage() ?? 0;
    if (cov >= 0.03) {
      play('win');
      addStar(1);
      addCorrect(1);
      setToast('잘 썼어요! ⭐');
      window.setTimeout(() => boardRef.current?.clear(), 900);
    } else {
      setToast('이렇게 써요! 순서대로 따라 써 볼까요?');
      boardRef.current?.playDemo();
    }
  };

  const openNameDialog = () => {
    setNameInput(childName);
    setNameOpen(true);
  };
  const saveName = () => {
    setChildName(nameInput);
    setNameOpen(false);
  };

  const gridItems = mode === 'consonant' ? consonants : mode === 'vowel' ? vowels : mode === 'word' ? basicWords : [];

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

      {/* 모드 전환 */}
      <Stack alignItems="center" sx={{ mb: 1 }}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, v) => changeMode(v)}
          sx={{
            flexWrap: 'wrap',
            justifyContent: 'center',
            '& .MuiToggleButton-root': {
              px: 2.2,
              py: 0.8,
              fontWeight: 800,
              fontSize: '0.98rem',
              borderRadius: '999px !important',
              border: '2px solid #E0DCF5 !important',
              m: 0.4,
            },
            '& .Mui-selected': { bgcolor: 'primary.main', color: '#fff' },
            '& .Mui-selected:hover': { bgcolor: 'primary.dark' },
          }}
        >
          <ToggleButton value="consonant">자음</ToggleButton>
          <ToggleButton value="vowel">모음</ToggleButton>
          <ToggleButton value="name">이름</ToggleButton>
          <ToggleButton value="word">단어</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {mode === 'name' && !childName ? (
        <Stack alignItems="center" spacing={2} sx={{ flex: 1, justifyContent: 'center', px: 3, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '3rem' }}>✍️</Typography>
          <Typography sx={{ fontWeight: 800 }}>부모님이 아이 이름을 저장해 주세요.</Typography>
          <Typography sx={{ color: 'text.secondary' }}>저장하면 내 이름을 따라 쓸 수 있어요!</Typography>
          <Button variant="contained" size="large" startIcon={<EditRoundedIcon />} onClick={openNameDialog}>
            이름 저장하기
          </Button>
        </Stack>
      ) : (
        <>
          <Stack alignItems="center" spacing={1.2} sx={{ my: 1 }}>
            <Typography sx={{ fontWeight: 800, color: 'text.secondary' }}>
              {mode === 'word' ? '그림을 보고 순서대로 따라 써요!' : '번호 순서대로 따라 써요!'}
            </Typography>

            <Stack direction="row" alignItems="center" spacing={1.2}>
              {view.count > 0 && (
                <IconButton onClick={() => go(-1)} aria-label="이전" sx={{ bgcolor: '#EEEBFA' }}>
                  <ChevronLeftRoundedIcon sx={{ fontSize: 32 }} />
                </IconButton>
              )}

              {mode === 'word' && (
                <Box
                  sx={{
                    width: 90,
                    height: 90,
                    borderRadius: 4,
                    bgcolor: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 52,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
                    flexShrink: 0,
                  }}
                >
                  <span role="img" aria-label={view.label}>{view.picture}</span>
                </Box>
              )}

              <Box sx={{ position: 'relative' }}>
                <StrokeBoard
                  ref={boardRef}
                  char={view.trace || ' '}
                  strokes={view.strokes}
                  size={mode === 'word' ? 210 : 240}
                />
                <IconButton
                  aria-label="발음 듣기"
                  onClick={pronounce}
                  sx={{
                    position: 'absolute',
                    bottom: -10,
                    right: -10,
                    bgcolor: 'secondary.main',
                    color: '#fff',
                    width: 52,
                    height: 52,
                    boxShadow: '0 4px 0 rgba(0,0,0,0.12)',
                    '&:hover': { bgcolor: 'secondary.dark' },
                    '&:active': { transform: 'translateY(2px)' },
                  }}
                >
                  <VolumeUpRoundedIcon sx={{ fontSize: 30 }} />
                </IconButton>
              </Box>

              {view.count > 0 && (
                <IconButton onClick={() => go(1)} aria-label="다음" sx={{ bgcolor: '#EEEBFA' }}>
                  <ChevronRightRoundedIcon sx={{ fontSize: 32 }} />
                </IconButton>
              )}
            </Stack>

            <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: 'primary.dark' }}>
              {view.label}
            </Typography>

            {/* 동작 버튼 */}
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" useFlexGap>
              <Button
                variant="outlined"
                startIcon={<PlayCircleRoundedIcon />}
                onClick={() => boardRef.current?.playDemo()}
                sx={{ borderRadius: 999, fontWeight: 700 }}
              >
                시범 보기
              </Button>
              <Button
                variant="outlined"
                startIcon={<RestartAltRoundedIcon />}
                onClick={() => boardRef.current?.clear()}
                sx={{ borderRadius: 999, fontWeight: 700 }}
              >
                지우기
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<CheckCircleRoundedIcon />}
                onClick={onDone}
                sx={{ borderRadius: 999, fontWeight: 800 }}
              >
                다 썼어요
              </Button>
              {mode === 'name' && (
                <Button
                  variant="outlined"
                  startIcon={<EditRoundedIcon />}
                  onClick={openNameDialog}
                  sx={{ borderRadius: 999, fontWeight: 700 }}
                >
                  이름 바꾸기
                </Button>
              )}
            </Stack>
          </Stack>

          {gridItems.length > 0 && (
            <Box
              sx={{
                mt: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 1,
                maxWidth: 420,
                width: '100%',
                mx: 'auto',
                maxHeight: mode === 'word' ? '30vh' : 'none',
                overflowY: mode === 'word' ? 'auto' : 'visible',
                pb: 1,
              }}
            >
              {gridItems.map((item: any, i) => (
                <Box
                  key={item.id ?? item.char}
                  onClick={() => select(i)}
                  sx={{
                    aspectRatio: '1 / 1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: mode === 'word' ? '1.7rem' : '1.8rem',
                    fontWeight: 800,
                    borderRadius: 3,
                    cursor: 'pointer',
                    bgcolor: i === index ? 'primary.main' : '#fff',
                    color: i === index ? '#fff' : 'text.primary',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                  }}
                >
                  {mode === 'word' ? item.emoji : item.char}
                </Box>
              ))}
            </Box>
          )}
        </>
      )}

      {/* 이름 입력 다이얼로그 (부모용) */}
      <Dialog open={nameOpen} onClose={() => setNameOpen(false)}>
        <DialogTitle sx={{ fontWeight: 800 }}>아이 이름 저장</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, color: 'text.secondary', fontSize: '0.9rem' }}>
            아이의 한글 이름을 입력하세요. (최대 10자)
          </Typography>
          <TextField
            autoFocus
            fullWidth
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="예: 김민준"
            inputProps={{ maxLength: 10 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNameOpen(false)}>취소</Button>
          <Button variant="contained" onClick={saveName} disabled={!nameInput.trim()}>
            저장
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={toast?.startsWith('잘') ? 'success' : 'info'}
          onClose={() => setToast(null)}
          sx={{ fontWeight: 800 }}
        >
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
