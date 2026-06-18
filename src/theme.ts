import { createTheme } from '@mui/material/styles';

// TinyLearn 테마 — Primary: #7F77DD 퍼플, Secondary: #1D9E75 틸
export const theme = createTheme({
  palette: {
    primary: {
      main: '#7F77DD',
      light: '#A39DEA',
      dark: '#5B53B8',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#1D9E75',
      light: '#4FBF98',
      dark: '#137254',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FFF8E7', // 따뜻한 크림색 배경
      paper: '#FFFFFF',
    },
    warning: {
      main: '#FFC53D', // 별 색상
    },
    text: {
      primary: '#3A3A52',
      secondary: '#6E6E87',
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
  shape: {
    borderRadius: 20,
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: false },
      styleOverrides: {
        root: {
          borderRadius: 24,
          paddingTop: 12,
          paddingBottom: 12,
          fontSize: '1.1rem',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 28 },
      },
    },
  },
});
