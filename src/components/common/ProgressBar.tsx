import { Box, LinearProgress, Typography } from '@mui/material';

interface Props {
  current: number; // 1-based 현재 문제 번호
  total: number;
}

/** 퀴즈 진행률 표시 (예: 3/10) */
export default function ProgressBar({ current, total }: Props) {
  const value = Math.min(100, ((current - 1) / total) * 100);
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
        <Typography sx={{ fontWeight: 700, color: 'text.secondary' }}>
          {current}/{total}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={value}
        sx={{
          height: 14,
          borderRadius: 999,
          bgcolor: '#E9E6FB',
          '& .MuiLinearProgress-bar': {
            borderRadius: 999,
            backgroundColor: 'primary.main',
          },
        }}
      />
    </Box>
  );
}
