import { Box, Typography } from '@mui/material';
import { COLOR_HEX, COLOR_LABEL_KO, type ColorName } from '@/data/shapeData';

interface Props {
  colors: ColorName[];
  selected: ColorName | null;
  onSelect: (c: ColorName) => void;
}

/** 색상 선택 필터 칩 (색 게임 시작 전 색 고르기) */
export default function ColorFilter({ colors, selected, onSelect }: Props) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
      {colors.map((c) => (
        <Box
          key={c}
          onClick={() => onSelect(c)}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer',
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: COLOR_HEX[c],
              border: '4px solid',
              borderColor: selected === c ? 'primary.main' : '#fff',
              boxShadow: '0 3px 8px rgba(0,0,0,0.15)',
            }}
          />
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
            {COLOR_LABEL_KO[c]}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
