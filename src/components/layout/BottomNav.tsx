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

  // 서브 페이지도 상위 탭에 매칭.
  // - 홈('/') 은 정확히 일치해야 함
  // - 나머지는 pathname.startsWith(tab.path)
  // - /routines/... 는 루틴이 기록 탭에서 시작하므로 기록 탭으로 매핑
  const matches = (tabPath: string) => {
    if (tabPath === '/') return pathname === '/';
    if (tabPath === '/record' && pathname.startsWith('/routines')) return true;
    return pathname === tabPath || pathname.startsWith(tabPath + '/');
  };
  const activePath = tabs.find((t) => matches(t.path))?.path ?? '/';

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
