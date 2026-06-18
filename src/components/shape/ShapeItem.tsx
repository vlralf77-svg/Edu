import { Box } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import type { ShapeItem as ShapeItemType } from '@/data/shapeData';
import ShapeIcon from './ShapeIcon';

export type ItemFeedback = 'idle' | 'correct' | 'wrong';

interface Props {
  item: ShapeItemType;
  feedback: ItemFeedback;
  selected: boolean;
  onClick: () => void;
}

/** 터치 가능한 색·도형 아이템 (정답 시 초록 테두리, 오답 시 흔들림) */
export default function ShapeItemTile({ item, feedback, selected, onClick }: Props) {
  return (
    <Box
      onClick={onClick}
      className={feedback === 'wrong' ? 'tl-shake' : feedback === 'correct' ? 'tl-pop' : undefined}
      sx={{
        position: 'relative',
        aspectRatio: '1 / 1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 5,
        cursor: 'pointer',
        p: 1,
        bgcolor: '#fff',
        border: '4px solid',
        borderColor: feedback === 'correct' ? '#22C55E' : 'transparent',
        boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
        opacity: selected && feedback === 'correct' ? 0.85 : 1,
        transition: 'border-color 0.15s ease',
      }}
    >
      <ShapeIcon type={item.type} color={item.colorHex} size="78%" />
      {feedback === 'correct' && (
        <CheckCircleRoundedIcon
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            color: '#22C55E',
            fontSize: 28,
            bgcolor: '#fff',
            borderRadius: '50%',
          }}
        />
      )}
    </Box>
  );
}
