import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function AppShell() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          pb: 'calc(72px + env(safe-area-inset-bottom))',
        }}
      >
        <Outlet />
      </Box>
      <BottomNav />
    </Box>
  );
}
