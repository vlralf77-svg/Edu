import { createTheme } from '@mui/material/styles';

// FitLog 다크 테마 — 헬스장 조명 환경 고려 (WBS 4.3 원칙)
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#FF6B35', // 에너제틱 오렌지
      light: '#FF8A5F',
      dark: '#D14E1D',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#4ECDC4', // 시원한 틸
      light: '#7FDDD6',
      dark: '#2AA39A',
      contrastText: '#0F1621',
    },
    background: {
      default: '#0F1621',
      paper: '#1A2332',
    },
    success: { main: '#4ADE80' },
    warning: { main: '#FBBF24' },
    error: { main: '#F87171' },
    info: { main: '#60A5FA' },
    text: {
      primary: '#F1F5F9',
      secondary: '#94A3B8',
    },
    divider: 'rgba(255,255,255,0.08)',
  },
  typography: {
    fontFamily:
      '"Baloo 2", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif',
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { fontWeight: 700, textTransform: 'none' },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 12,
          paddingTop: 10,
          paddingBottom: 10,
          fontSize: '1rem',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #FF6B35 0%, #FF8A5F 100%)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 16 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
  },
});
