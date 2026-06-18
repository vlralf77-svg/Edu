import { Box, Typography } from '@mui/material';
import StarRoundedIcon from '@mui/icons-material/StarRounded';

interface Props {
  count: number;
  size?: number;
}

/** 별 개수를 보여주는 배지 */
export default function StarBadge({ count, size = 28 }: Props) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.5,
        py: 0.5,
        borderRadius: 999,
        bgcolor: '#FFF3CD',
        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
      }}
    >
      <StarRoundedIcon sx={{ color: 'warning.main', fontSize: size }} />
      <Typography sx={{ fontWeight: 800, fontSize: size * 0.7, color: '#B7791F' }}>
        {count}
      </Typography>
    </Box>
  );
}
