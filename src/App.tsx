import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { useEffect } from 'react';

import Setup from './pages/Setup';
import Home from './pages/Home';
import Profile from './pages/Profile';
import AddFamily from './pages/AddFamily';
import Call from './pages/Call';
import Settings from './pages/Settings';
import CallProvider from './components/CallProvider';
import { useAppStore } from './store/useAppStore';
import { supportsStandby, isStandbyEnabled, enableStandby } from './services/keepAlive';

export default function App() {
  const profile = useAppStore((s) => s.profile);

  // 네이티브에서 프로필이 있는 유저는 대기 모드 상태를 확인하고
  // 최초 1회 자동으로 켜준다 (사용자가 껐다면 유지).
  useEffect(() => {
    if (!profile || !supportsStandby()) return;
    (async () => {
      const already = await isStandbyEnabled();
      const firstTouch = localStorage.getItem('standby.autoprompted') === '1';
      if (!already && !firstTouch) {
        await enableStandby();
        localStorage.setItem('standby.autoprompted', '1');
      }
    })().catch(() => { /* noop */ });
  }, [profile?.peerId]);

  if (!profile) {
    return (
      <Box sx={{ minHeight: '100%', bgcolor: 'background.default' }}>
        <Routes>
          <Route path="*" element={<Setup />} />
        </Routes>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100%', bgcolor: 'background.default' }}>
      <CallProvider />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/add" element={<AddFamily />} />
        <Route path="/call" element={<Call />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Box>
  );
}
