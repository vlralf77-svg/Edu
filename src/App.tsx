import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';

import Home from './pages/Home';
import ModeSelect from './pages/ModeSelect';
import WordGame from './pages/WordGame';
import ShapeGame from './pages/ShapeGame';
import Result from './pages/Result';
import Settings from './pages/Settings';
import TestPage from './pages/TestPage';

export default function App() {
  return (
    <Box
      sx={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mode" element={<ModeSelect />} />
        <Route path="/word-game" element={<WordGame />} />
        <Route path="/shape-game" element={<ShapeGame />} />
        <Route path="/result" element={<Result />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Box>
  );
}
