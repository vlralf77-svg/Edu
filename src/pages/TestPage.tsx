import { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Paper,
  Button,
  TextField,
  Divider,
  Chip,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

import ShapeIcon from '@/components/shape/ShapeIcon';
import WordCard from '@/components/word/WordCard';
import StarBadge from '@/components/common/StarBadge';
import { COLORS, SHAPES, COLOR_HEX, COLOR_LABEL_KO, SHAPE_LABEL_KO } from '@/data/shapeData';
import { wordData } from '@/data/wordData';
import { useTTS } from '@/hooks/useTTS';
import { useSound } from '@/hooks/useSound';
import { useGameStore } from '@/store/useGameStore';

/** 개발·QA용 테스트 페이지 — 앱의 핵심 기능을 한 곳에서 점검 */
export default function TestPage() {
  const navigate = useNavigate();
  const { speak, supported: ttsSupported } = useTTS();
  const { play } = useSound();

  const stars = useGameStore((s) => s.stars);
  const streak = useGameStore((s) => s.streak);
  const todayCorrect = useGameStore((s) => s.todayCorrect);
  const addStar = useGameStore((s) => s.addStar);
  const spendStars = useGameStore((s) => s.spendStars);

  const [ttsText, setTtsText] = useState('apple');
  const [sampleWord, setSampleWord] = useState(wordData[0]);

  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Paper sx={{ p: 2.5 }}>
      <Typography sx={{ fontWeight: 800, mb: 1.5, color: 'primary.dark' }}>{title}</Typography>
      {children}
    </Paper>
  );

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, pb: 6 }}>
      {/* 헤더 */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center">
          <IconButton aria-label="뒤로" onClick={() => navigate('/')}>
            <ArrowBackRoundedIcon sx={{ fontSize: 30 }} />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 800, ml: 1 }}>
            🧪 테스트 페이지
          </Typography>
        </Stack>
        <StarBadge count={stars} />
      </Stack>

      <Stack spacing={2} sx={{ maxWidth: 560, width: '100%', mx: 'auto' }}>
        {/* 환경 정보 */}
        <Section title="환경 / 플랫폼">
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`platform: ${platform}`} color="primary" />
            <Chip label={`native: ${isNative ? 'yes' : 'no (web)'}`} />
            <Chip label={`TTS: ${ttsSupported ? '지원' : '미지원'}`} color={ttsSupported ? 'success' : 'default'} />
            <Chip label={`mode: ${import.meta.env.MODE}`} />
          </Stack>
          <Typography sx={{ mt: 1.5, fontSize: '0.8rem', color: 'text.secondary' }}>
            웹에서는 AdMob 배너가 플레이스홀더로, 보상형 광고는 즉시 보상으로 동작합니다.
          </Typography>
        </Section>

        {/* TTS 테스트 */}
        <Section title="🔊 TTS (발음) 테스트">
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              placeholder="영단어 입력"
            />
            <Button variant="contained" onClick={() => speak(ttsText)}>
              발음 듣기
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
            {['apple', 'dog', 'star', 'banana', 'fish'].map((w) => (
              <Button key={w} size="small" variant="outlined" onClick={() => speak(w)}>
                {w}
              </Button>
            ))}
          </Stack>
        </Section>

        {/* 효과음 테스트 */}
        <Section title="🎵 효과음 (Web Audio) 테스트">
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" color="success" onClick={() => play('correct')}>
              정답음
            </Button>
            <Button variant="contained" color="error" onClick={() => play('wrong')}>
              오답음
            </Button>
            <Button variant="contained" color="warning" onClick={() => play('win')}>
              승리음
            </Button>
            <Button variant="outlined" onClick={() => play('tap')}>
              탭음
            </Button>
          </Stack>
        </Section>

        {/* 도형/색 미리보기 */}
        <Section title="🔺 도형 · 색깔 미리보기">
          <Typography sx={{ fontSize: '0.85rem', mb: 1, color: 'text.secondary' }}>
            도형 5종 (각 빨강)
          </Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            {SHAPES.map((s) => (
              <Stack key={s} alignItems="center">
                <ShapeIcon type={s} color={COLOR_HEX.red} size={56} />
                <Typography sx={{ fontSize: '0.75rem' }}>{SHAPE_LABEL_KO[s]}</Typography>
              </Stack>
            ))}
          </Stack>
          <Typography sx={{ fontSize: '0.85rem', mb: 1, color: 'text.secondary' }}>
            색깔 6종 (별 모양)
          </Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            {COLORS.map((c) => (
              <Stack key={c} alignItems="center">
                <ShapeIcon type="star" color={COLOR_HEX[c]} size={56} />
                <Typography sx={{ fontSize: '0.75rem' }}>{COLOR_LABEL_KO[c]}</Typography>
              </Stack>
            ))}
          </Stack>
        </Section>

        {/* 단어 카드 미리보기 */}
        <Section title="🃏 단어 카드 미리보기">
          <Stack alignItems="center" spacing={2}>
            <WordCard item={sampleWord} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="center">
              {wordData.slice(0, 8).map((wd) => (
                <Button
                  key={wd.id}
                  size="small"
                  variant={wd.id === sampleWord.id ? 'contained' : 'outlined'}
                  onClick={() => setSampleWord(wd)}
                >
                  {wd.emoji} {wd.word}
                </Button>
              ))}
            </Stack>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
              총 단어 수: {wordData.length}개
            </Typography>
          </Stack>
        </Section>

        {/* 스토어 상태 테스트 */}
        <Section title="💾 스토어 / 보상 상태">
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            <Chip label={`별: ${stars}`} color="warning" />
            <Chip label={`연속출석: ${streak}일`} />
            <Chip label={`오늘 정답: ${todayCorrect}`} />
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" onClick={() => addStar(1)}>
              별 +1
            </Button>
            <Button variant="contained" onClick={() => addStar(5)}>
              별 +5
            </Button>
            <Button variant="outlined" onClick={() => spendStars(5)} disabled={stars < 5}>
              힌트 사용 (별 -5)
            </Button>
          </Stack>
        </Section>

        {/* 화면 이동 */}
        <Section title="🚀 화면 바로가기">
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" onClick={() => navigate('/')}>홈</Button>
            <Button variant="contained" onClick={() => navigate('/word-game?difficulty=easy')}>
              영단어(쉬움)
            </Button>
            <Button variant="contained" onClick={() => navigate('/word-game?difficulty=hard')}>
              영단어(어려움/타이머)
            </Button>
            <Button variant="contained" color="secondary" onClick={() => navigate('/shape-game?type=color')}>
              색깔 게임
            </Button>
            <Button variant="contained" color="secondary" onClick={() => navigate('/shape-game?type=shape')}>
              도형 게임
            </Button>
            <Button variant="contained" onClick={() => navigate('/hangul')}>
              한글 배우기
            </Button>
            <Button variant="outlined" onClick={() => navigate('/settings')}>설정</Button>
            <Button
              variant="outlined"
              onClick={() =>
                navigate('/result', { state: { game: 'word', correct: 8, total: 10 } })
              }
            >
              결과 화면(샘플)
            </Button>
          </Stack>
        </Section>

        <Divider />
        <Typography sx={{ textAlign: 'center', fontSize: '0.75rem', color: 'text.secondary' }}>
          이 페이지는 개발·QA용입니다. (경로: <code>/test</code>)
        </Typography>
      </Stack>
    </Box>
  );
}
