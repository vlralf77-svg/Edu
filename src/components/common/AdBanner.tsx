import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { Capacitor } from '@capacitor/core';
import { showBanner, hideBanner } from '@/utils/admob';

/**
 * 화면 하단 배너 광고 영역.
 * 네이티브에서는 AdMob 배너를 표시하고, 웹에서는 플레이스홀더를 보여준다.
 * 마운트 시 노출, 언마운트 시 숨김 처리.
 */
export default function AdBanner() {
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative) {
      void showBanner();
      return () => {
        void hideBanner();
      };
    }
  }, [isNative]);

  // 네이티브 배너는 웹뷰 위에 오버레이되므로 높이 확보용 스페이서만 렌더
  if (isNative) {
    return <Box sx={{ height: 60, flexShrink: 0 }} />;
  }

  // 웹 미리보기용 플레이스홀더
  return (
    <Box
      sx={{
        height: 60,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#EDEBF7',
        borderTop: '1px dashed #C9C4E8',
      }}
    >
      <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
        광고 영역 (배너) · 실제 기기에서 표시됩니다
      </Typography>
    </Box>
  );
}
