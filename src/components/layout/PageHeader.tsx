import { Box, IconButton, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

export default function PageHeader({
  title,
  subtitle,
  showBack = false,
  right,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: ReactNode;
}) {
  const nav = useNavigate();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 2,
        pt: 2,
        pb: 1.5,
        gap: 1,
      }}
    >
      {showBack && (
        <IconButton onClick={() => nav(-1)} size="small">
          <ArrowBackRoundedIcon />
        </IconButton>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h5" fontWeight={800} noWrap>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" noWrap>
            {subtitle}
          </Typography>
        )}
      </Box>
      {right}
    </Box>
  );
}
