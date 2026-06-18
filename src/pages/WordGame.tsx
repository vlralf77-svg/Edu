import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Stack, IconButton, LinearProgress } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useNavigate, useSearchParams } from 'react-router-dom';

import WordCard from '@/components/word/WordCard';
import ChoiceButton, { type ChoiceState } from '@/components/word/ChoiceButton';
import ProgressBar from '@/components/common/ProgressBar';
import { getWordsByLevel, type WordItem } from '@/data/wordData';
import { useTTS } from '@/hooks/useTTS';
import { useSound } from '@/hooks/useSound';
import { useGameStore, type Difficulty } from '@/store/useGameStore';

const QUESTION_COUNT = 10;
const HARD_TIME = 8; // 어려움 모드 제한 시간(초)

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const levelOf = (d: Difficulty): 1 | 2 | 3 =>
  d === 'easy' ? 1 : d === 'normal' ? 2 : 3;
const choiceCountOf = (d: Difficulty): number => (d === 'easy' ? 3 : 4);

interface Question {
  item: WordItem;
  choices: string[];
}

export default function WordGame() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const difficulty = (params.get('difficulty') as Difficulty) || 'easy';

  const { speak } = useTTS();
  const { play } = useSound();
  const addStar = useGameStore((s) => s.addStar);
  const addCorrect = useGameStore((s) => s.addCorrect);
  const markWord = useGameStore((s) => s.markWord);

  // 문제 세트 생성 (난이도별 레벨 필터 + 보기 구성)
  const questions = useMemo<Question[]>(() => {
    const level = levelOf(difficulty);
    const count = choiceCountOf(difficulty);
    const pool = getWordsByLevel(level);
    const picked = shuffle(pool).slice(0, QUESTION_COUNT);

    return picked.map((item) => {
      const distractors = shuffle([
        ...item.distractors,
        ...pool.map((p) => p.word).filter((wd) => wd !== item.word),
      ])
        .filter((v, i, self) => self.indexOf(v) === i && v !== item.word)
        .slice(0, count - 1);
      return { item, choices: shuffle([item.word, ...distractors]) };
    });
  }, [difficulty]);

  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [popping, setPopping] = useState(false);
  const [reveal, setReveal] = useState(false); // 정답 시 한글 전환
  const [timeLeft, setTimeLeft] = useState(HARD_TIME);
  const timerRef = useRef<number | null>(null);

  const current = questions[index];
  const isHard = difficulty === 'hard';

  const goNext = useRef<() => void>(() => {});

  // 다음 문제 또는 결과 화면 이동
  goNext.current = () => {
    if (index + 1 >= questions.length) {
      navigate('/result', {
        state: { game: 'word', correct: correctCount, total: questions.length },
        replace: true,
      });
    } else {
      setIndex((i) => i + 1);
      setPicked(null);
      setReveal(false);
      setTimeLeft(HARD_TIME);
    }
  };

  // 정답/오답 처리
  const handleAnswer = (choice: string | null) => {
    if (picked !== null) return; // 이미 선택함
    if (timerRef.current) window.clearInterval(timerRef.current);

    const answer = current.item.word;
    setPicked(choice ?? '__timeout__');

    if (choice === answer) {
      play('correct');
      setReveal(true); // 카드를 한글로 전환
      // 정답 시 한국어 뜻을 읽어줌 (효과음과 겹치지 않게 약간 지연)
      window.setTimeout(() => speak(current.item.ko, 'ko-KR'), 350);
      setPopping(true);
      setCorrectCount((c) => c + 1);
      addStar(1);
      addCorrect(1);
      markWord(current.item.id);
    } else {
      play('wrong');
    }

    // 정답이면 한글 발음을 들을 시간을 더 준다
    window.setTimeout(
      () => {
        setPopping(false);
        goNext.current();
      },
      choice === answer ? 1900 : 1300,
    );
  };

  // 어려움 모드 타이머
  useEffect(() => {
    if (!isHard || picked !== null) return;
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(timerRef.current!);
          handleAnswer(null); // 시간 초과 = 오답
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isHard, picked]);

  if (!current) return null;

  const stateOf = (choice: string): ChoiceState => {
    if (picked === null) return 'idle';
    if (choice === current.item.word) return 'correct';
    if (choice === picked) return 'wrong';
    return 'idle';
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <IconButton aria-label="뒤로" onClick={() => navigate('/')}>
          <ArrowBackRoundedIcon sx={{ fontSize: 30 }} />
        </IconButton>
        <Box sx={{ flex: 1, ml: 1 }}>
          <ProgressBar current={index + 1} total={questions.length} />
        </Box>
      </Stack>

      {isHard && (
        <Box sx={{ mb: 1 }}>
          <LinearProgress
            variant="determinate"
            value={(timeLeft / HARD_TIME) * 100}
            color={timeLeft <= 3 ? 'error' : 'secondary'}
            sx={{ height: 8, borderRadius: 999 }}
          />
        </Box>
      )}

      <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, gap: 4 }}>
        <WordCard item={current.item} popping={popping} reveal={reveal} />

        <Stack spacing={1.5} sx={{ width: '100%', maxWidth: 360 }}>
          {current.choices.map((choice) => (
            <ChoiceButton
              key={choice}
              label={choice}
              state={stateOf(choice)}
              disabled={picked !== null}
              onClick={() => handleAnswer(choice)}
            />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
