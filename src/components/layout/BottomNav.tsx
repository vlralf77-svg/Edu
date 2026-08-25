import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import FitnessCenterRoundedIcon from '@mui/icons-material/FitnessCenterRounded';
import InsertChartRoundedIcon from '@mui/icons-material/InsertChartRounded';
import RestaurantRoundedIcon from '@mui/icons-material/RestaurantRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { path: '/', label: '홈', icon: <HomeRoundedIcon /> },
  { path: '/record', label: '기록', icon: <FitnessCenterRoundedIcon /> },
  { path: '/analytics', label: '분석', icon: <InsertChartRoundedIcon /> },
  { path: '/meals', label: '식단', icon: <RestaurantRoundedIcon /> },
  { path: '/me', label: '마이', icon: <PersonRoundedIcon /> },
];

export default function BottomNav() {
  const nav = useNavigate();
  const { pathname } = useLocation();

  // 서브 페이지도 상위 탭에 매칭
  const topMatch = (p: string) => {
    if (p === '/') return '/';
    if (pathname.startsWith(p)) return p;
    return null;
  };
  const activePath = tabs.find((t) => topMatch(t.path))?.path ?? '/';

  return (
    <Paper
      elevation={12}
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        borderRadius: 0,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        pb: 'env(safe-area-inset-bottom)',
        bgcolor: 'background.paper',
      }}
    >
      <BottomNavigation
        showLabels
        value={activePath}
        onChange={(_, v) => nav(v)}
        sx={{
          bgcolor: 'transparent',
          height: 68,
          '& .MuiBottomNavigationAction-root': {
            color: 'text.secondary',
            minWidth: 0,
          },
          '& .Mui-selected': { color: 'primary.main' },
        }}
      >
        {tabs.map((t) => (
          <BottomNavigationAction
            key={t.path}
            label={t.label}
            value={t.path}
            icon={t.icon}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
