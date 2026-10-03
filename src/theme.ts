import { createTheme } from '@mui/material/styles';

// 가족통화 테마 — 부드러운 틸 계열, 따뜻한 배경
export const theme = createTheme({
  palette: {
    primary: {
      main: '#0EA5A4',
      light: '#5EEAD4',
      dark: '#0F766E',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#F97316',
      light: '#FDBA74',
      dark: '#C2410C',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F6FAFA',
      paper: '#FFFFFF',
    },
    success: { main: '#10B981' },
    error: { main: '#EF4444' },
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
    },
  },
  typography: {
    fontFamily:
      '"Baloo 2", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif',
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 700 },
    button: { fontWeight: 700, textTransform: 'none' },
  },
  shape: { borderRadius: 18 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 22,
          paddingTop: 10,
          paddingBottom: 10,
          fontSize: '1rem',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 22 },
      },
    },
  },
});
