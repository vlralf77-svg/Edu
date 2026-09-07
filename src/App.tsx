import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';

import Setup from './pages/Setup';
import Home from './pages/Home';
import Profile from './pages/Profile';
import AddFamily from './pages/AddFamily';
import Call from './pages/Call';
import CallProvider from './components/CallProvider';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const profile = useAppStore((s) => s.profile);

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Box>
  );
}
