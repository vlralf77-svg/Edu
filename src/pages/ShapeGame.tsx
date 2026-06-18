import { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, IconButton } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useNavigate, useSearchParams } from 'react-router-dom';

import ShapeItemTile, { type ItemFeedback } from '@/components/shape/ShapeItem';
import ProgressBar from '@/components/common/ProgressBar';
import {
  COLORS,
  SHAPES,
  COLOR_HEX,
  COLOR_LABEL_KO,
  SHAPE_LABEL_KO,
  type ShapeItem,
  type ColorName,
  type ShapeType,
} from '@/data/shapeData';
import { useSound } from '@/hooks/useSound';
import { useGameStore } from '@/store/useGameStore';

const ROUND_COUNT = 5;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

type GameType = 'color' | 'shape';

interface Round {
  items: ShapeItem[];
  isCorrect: (item: ShapeItem) => boolean;
  prompt: string;
}

function makeRound(type: GameType): Round {
  const size = 6 + Math.floor(Math.random() * 4); // 6~9개
  const target = type === 'color' ? pick(COLORS) : pick(SHAPES);
  const correctN = 2 + Math.floor(Math.random() * 2); // 정답 2~3개

  const matches = (color: ColorName, shape: ShapeType): boolean =>
    type === 'color' ? color === target : shape === target;

  const items: ShapeItem[] = [];
  // 정답 아이템 먼저 채우기
  for (let i = 0; i < correctN; i++) {
    const color = type === 'color' ? (target as ColorName) : pick(COLORS);
    const shape = type === 'shape' ? (target as ShapeType) : pick(SHAPES);
    items.push({ id: `c${i}-${color}-${shape}`, type: shape, color, colorHex: COLOR_HEX[color] });
  }
  // 나머지는 오답 아이템으로
  let guard = 0;
  while (items.length < size && guard < 200) {
    guard++;
    const color = pick(COLORS);
    const shape = pick(SHAPES);
    if (matches(color, shape)) continue; // 타겟과 겹치면 제외
    items.push({
      id: `d${items.length}-${color}-${shape}`,
      type: shape,
      color,
      colorHex: COLOR_HEX[color],
    });
  }

  const prompt =
    type === 'color'
      ? `${COLOR_LABEL_KO[target as ColorName]} 것을 모두 골라요!`
      : `${SHAPE_LABEL_KO[target as ShapeType]}를 모두 골라요!`;

  return {
    items: shuffle(items),
    isCorrect: (item) => matches(item.color, item.type),
    prompt,
  };
}

export default function ShapeGame() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const type = (params.get('type') as GameType) || 'color';

  const { play } = useSound();
  const addStar = useGameStore((s) => s.addStar);
  const addCorrect = useGameStore((s) => s.addCorrect);

  const rounds = useMemo(
    () => Array.from({ length: ROUND_COUNT }, () => makeRound(type)),
    [type],
  );

  const [roundIdx, setRoundIdx] = useState(0);
  const [correctRounds, setCorrectRounds] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<Record<string, ItemFeedback>>({});
  const [locked, setLocked] = useState(false);

  const round = rounds[roundIdx];
  const totalCorrectInRound = round.items.filter(round.isCorrect).length;

  const handleTap = (item: ShapeItem) => {
    if (locked || selected.has(item.id) || feedback[item.id] === 'correct') return;

    if (round.isCorrect(item)) {
      play('correct');
      const nextSelected = new Set(selected).add(item.id);
      setSelected(nextSelected);
      setFeedback((f) => ({ ...f, [item.id]: 'correct' }));

      // 라운드 내 모든 정답 선택 완료
      if (nextSelected.size >= totalCorrectInRound) {
        setLocked(true);
        play('win');
        addStar(1);
        addCorrect(1);
        setCorrectRounds((c) => c + 1);
        window.setTimeout(() => {
          if (roundIdx + 1 >= rounds.length) {
            navigate('/result', {
              state: { game: 'shape', correct: correctRounds + 1, total: rounds.length },
              replace: true,
            });
          } else {
            setRoundIdx((r) => r + 1);
            setSelected(new Set());
            setFeedback({});
            setLocked(false);
          }
        }, 1000);
      }
    } else {
      // 오답: 흔들림 후 원상복귀
      play('wrong');
      setFeedback((f) => ({ ...f, [item.id]: 'wrong' }));
      window.setTimeout(() => {
        setFeedback((f) => {
          const next = { ...f };
          if (next[item.id] === 'wrong') delete next[item.id];
          return next;
        });
      }, 450);
    }
  };

  // 라운드 바뀔 때 잔여 상태 초기화 보장
  useEffect(() => {
    setSelected(new Set());
    setFeedback({});
    setLocked(false);
  }, [roundIdx]);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <IconButton aria-label="뒤로" onClick={() => navigate('/')}>
          <ArrowBackRoundedIcon sx={{ fontSize: 30 }} />
        </IconButton>
        <Box sx={{ flex: 1, ml: 1 }}>
          <ProgressBar current={roundIdx + 1} total={rounds.length} />
        </Box>
      </Stack>

      <Typography
        variant="h5"
        sx={{ textAlign: 'center', fontWeight: 800, my: 2, color: 'primary.dark' }}
      >
        {round.prompt}
      </Typography>

      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1.5,
          alignContent: 'center',
          maxWidth: 420,
          width: '100%',
          mx: 'auto',
        }}
      >
        {round.items.map((item) => (
          <ShapeItemTile
            key={item.id}
            item={item}
            feedback={feedback[item.id] ?? 'idle'}
            selected={selected.has(item.id)}
            onClick={() => handleTap(item)}
          />
        ))}
      </Box>
    </Box>
  );
}
