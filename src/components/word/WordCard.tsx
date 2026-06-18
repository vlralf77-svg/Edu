import { Box, Paper } from '@mui/material';
import type { WordItem } from '@/data/wordData';
import TTSButton from './TTSButton';

interface Props {
  item: WordItem;
  popping?: boolean;
}

/**
 * 그림 카드. image 리소스가 있으면 표시하고,
 * 없으면 emoji로 대체 렌더링한다. 우측 하단 스피커로 발음 재생.
 */
export default function WordCard({ item, popping }: Props) {
  return (
    <Box sx={{ position: 'relative', display: 'inline-block' }}>
      <Paper
        elevation={4}
        className={popping ? 'tl-pop' : undefined}
        sx={{
          width: { xs: 220, sm: 260 },
          height: { xs: 220, sm: 260 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          bgcolor: '#fff',
          fontSize: { xs: 120, sm: 150 },
          lineHeight: 1,
        }}
      >
        <Box
          component="img"
          src={item.image}
          alt={item.word}
          sx={{ width: '70%', height: '70%', objectFit: 'contain', display: 'none' }}
          onLoad={(e) => {
            // 이미지 로드 성공 시 emoji 대신 이미지 표시
            const img = e.currentTarget;
            img.style.display = 'block';
            const sib = img.nextElementSibling as HTMLElement | null;
            if (sib) sib.style.display = 'none';
          }}
        />
        <span role="img" aria-label={item.word}>
          {item.emoji}
        </span>
      </Paper>
      <Box sx={{ position: 'absolute', bottom: -8, right: -8 }}>
        <TTSButton text={item.word} />
      </Box>
    </Box>
  );
}
