import {
  AppBar, Toolbar, IconButton, Typography, Box, Paper, Stack, Switch,
  Button, Alert, Divider, List, ListItem, ListItemText, ListItemAvatar, Avatar,
  Chip,
} from '@mui/material';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import RingVolumeRoundedIcon from '@mui/icons-material/RingVolumeRounded';
import BatteryChargingFullRoundedIcon from '@mui/icons-material/BatteryChargingFullRounded';
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  supportsStandby, isStandbyEnabled, enableStandby, disableStandby,
  isBatteryOptimized, requestBatteryOptExemption,
} from '../services/keepAlive';
import { useAppStore } from '../store/useAppStore';

export default function Settings() {
  const nav = useNavigate();
  const family = useAppStore((s) => s.family);
  const removeFamily = useAppStore((s) => s.removeFamily);
  const reset = useAppStore((s) => s.reset);

  const native = supportsStandby();
  const [standby, setStandby] = useState(false);
  const [battOpt, setBattOpt] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setStandby(await isStandbyEnabled());
    setBattOpt(await isBatteryOptimized());
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);

  const toggleStandby = async (checked: boolean) => {
    if (checked) {
      await enableStandby();
      // 배터리 최적화 예외도 자연스럽게 요청
      if (await isBatteryOptimized()) {
        await requestBatteryOptExemption();
      }
    } else {
      await disableStandby();
    }
    await refresh();
  };

  return (
    <Box sx={{ pb: 4 }}>
      <AppBar position="sticky" color="transparent" elevation={0}
        sx={{ bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <IconButton onClick={() => nav(-1)}><ArrowBackIosNewRoundedIcon /></IconButton>
          <Typography variant="h6" fontWeight={800}>설정</Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2, maxWidth: 560, mx: 'auto' }}>
        {/* 대기 모드 */}
        <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ bgcolor: standby ? 'success.main' : 'grey.300' }}>
              <RingVolumeRoundedIcon />
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography fontWeight={700}>전화 대기 모드</Typography>
              <Typography variant="body2" color="text.secondary">
                앱을 최소화해도 전화가 오면 벨이 울려요
              </Typography>
            </Box>
            <Switch
              checked={standby}
              onChange={(_, v) => void toggleStandby(v)}
              disabled={!native || loading}
            />
          </Stack>

          {!native && (
            <Alert severity="info" sx={{ mt: 2 }}>
              대기 모드는 안드로이드 앱에서만 지원됩니다. 웹 브라우저에서는 앱을 열어둔 동안만 전화를 받을 수 있어요.
            </Alert>
          )}

          {native && standby && (
            <Alert severity="success" sx={{ mt: 2 }} icon={<BoltRoundedIcon />}>
              대기 중이에요. 상단 알림 표시줄에 <b>"우리가족"</b> 알림이 계속 떠 있으면 정상 작동 중입니다.
            </Alert>
          )}

          {native && standby && battOpt && (
            <Paper elevation={0} sx={{ mt: 2, p: 2, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <BatteryChargingFullRoundedIcon />
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" fontWeight={700}>배터리 최적화가 켜져 있어요</Typography>
                  <Typography variant="caption">
                    폰이 앱을 강제로 종료할 수 있어요. 예외로 설정해 주세요.
                  </Typography>
                </Box>
                <Button size="small" variant="contained" color="warning"
                  onClick={() => void requestBatteryOptExemption()}>
                  설정 열기
                </Button>
              </Stack>
            </Paper>
          )}
        </Paper>

        {/* 안내 */}
        {native && (
          <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              전화가 잘 오게 하려면
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">✓ 위 <b>대기 모드</b>를 켜두기</Typography>
              <Typography variant="body2">✓ 배터리 최적화 예외 허용</Typography>
              <Typography variant="body2">✓ Wi-Fi 또는 데이터 연결 유지</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                ⚠️ 최근 앱 목록에서 "우리가족"을 위로 밀어 완전히 종료하면 전화를 받을 수 없어요.
              </Typography>
            </Stack>
          </Paper>
        )}

        {/* 가족 관리 */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={700}>등록된 가족</Typography>
            <Chip size="small" label={`${family.length}명`} />
          </Stack>
          {family.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              아직 등록된 가족이 없어요.
            </Typography>
          ) : (
            <List disablePadding>
              {family.map((m, idx) => (
                <Box key={m.id}>
                  {idx > 0 && <Divider component="li" />}
                  <ListItem
                    secondaryAction={
                      <IconButton
                        edge="end"
                        color="error"
                        aria-label="가족 삭제"
                        onClick={() => {
                          if (confirm(`${m.name} 을(를) 목록에서 삭제할까요?`)) {
                            removeFamily(m.id);
                          }
                        }}
                      >
                        <PersonRemoveRoundedIcon />
                      </IconButton>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                        {m.emoji}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Typography fontWeight={700}>{m.name}</Typography>}
                      secondary={`${m.role} · ${m.id}`}
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          )}
        </Paper>

        <Button
          fullWidth color="error" startIcon={<DeleteForeverRoundedIcon />}
          sx={{ mt: 3 }}
          onClick={async () => {
            if (!confirm('내 프로필과 가족 목록을 모두 초기화할까요? 되돌릴 수 없어요.')) return;
            await disableStandby();
            reset();
          }}
        >
          내 프로필/가족 목록 전체 초기화
        </Button>
      </Box>
    </Box>
  );
}
