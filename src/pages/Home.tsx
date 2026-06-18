import { Box, Stack, Typography, IconButton } from '@mui/material';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

import StarBadge from '@/components/common/StarBadge';
import BigButton from '@/components/common/BigButton';
import AdBanner from '@/components/common/AdBanner';
import { useGameStore } from '@/store/useGameStore';

export default function Home() {
  const navigate = useNavigate();
  const stars = useGameStore((s) => s.stars);
  const todayCorrect = useGameStore((s) => s.todayCorrect);
  const streak = useGameStore((s) => s.streak);
  const checkAttendance = useGameStore((s) => s.checkAttendance);

  // 앱 진입 시 출석/연속 출석 체크
  useEffect(() => {
    checkAttendance();
  }, [checkAttendance]);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* 상단 바 */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
        <StarBadge count={stars} />
        <Stack direction="row" spacing={1} alignItems="center">
          {streak > 0 && (
            <Stack
              direction="row"
              alignItems="center"
              sx={{ px: 1.5, py: 0.5, borderRadius: 999, bgcolor: '#FFE8D6' }}
            >
              <LocalFireDepartmentRoundedIcon sx={{ color: '#F97316', fontSize: 22 }} />
              <Typography sx={{ fontWeight: 800, color: '#C2410C', ml: 0.3 }}>
                {streak}일
              </Typography>
            </Stack>
          )}
          <IconButton aria-label="설정" onClick={() => navigate('/settings')}>
            <SettingsRoundedIcon sx={{ fontSize: 30, color: 'text.secondary' }} />
          </IconButton>
        </Stack>
      </Stack>

      {/* 메인 영역 */}
      <Stack
        spacing={4}
        alignItems="center"
        justifyContent="center"
        sx={{ flex: 1, px: 3, textAlign: 'center' }}
      >
        <Box className="tl-float">
          <Typography variant="h2" sx={{ color: 'primary.main', fontSize: '3rem' }}>
            TinyLearn
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontWeight: 700 }}>
            그림으로 배우는 영어 · 색깔 놀이
          </Typography>
        </Box>

        {todayCorrect > 0 && (
          <Typography sx={{ fontWeight: 800, color: 'secondary.main', fontSize: '1.2rem' }}>
            오늘 ★ {todayCorrect}개 획득! 🎉
          </Typography>
        )}

        <Stack spacing={2.5} sx={{ width: '100%', maxWidth: 360 }}>
          <BigButton
            color="primary"
            startIcon={<span style={{ fontSize: 28 }}>🔤</span>}
            onClick={() => navigate('/mode?game=word')}
          >
            영단어 배우기
          </BigButton>
          <BigButton
            color="secondary"
            startIcon={<span style={{ fontSize: 28 }}>🔴</span>}
            onClick={() => navigate('/mode?game=shape')}
          >
            색·도형 놀이
          </BigButton>
        </Stack>
      </Stack>

      {/* 개발·QA용 테스트 페이지 진입 (작게 노출) */}
      <Typography
        onClick={() => navigate('/test')}
        sx={{
          textAlign: 'center',
          fontSize: '0.72rem',
          color: 'text.secondary',
          opacity: 0.6,
          py: 0.5,
          cursor: 'pointer',
        }}
      >
        🧪 테스트 페이지
      </Typography>

      {/* 홈 화면 하단 배너 광고 */}
      <AdBanner />
    </Box>
  );
}
