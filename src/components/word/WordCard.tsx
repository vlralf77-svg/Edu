import { Box, Paper, Typography } from '@mui/material';
import type { WordItem } from '@/data/wordData';
import TTSButton from './TTSButton';

interface Props {
  item: WordItem;
  popping?: boolean;
  /** 정답 후 한글 뜻으로 전환 (스피커도 한국어로 읽음) */
  reveal?: boolean;
}

/**
 * 그림 카드. 평소에는 그림(emoji/이미지)을 보여주고,
 * reveal=true(정답 시)에는 한글 뜻으로 전환한다.
 * 스피커는 상태에 맞는 언어(영어/한국어)로 발음한다.
 */
export default function WordCard({ item, popping, reveal }: Props) {
  return (
    <Box sx={{ position: 'relative', display: 'inline-block' }}>
      <Paper
        elevation={4}
        className={popping ? 'tl-pop' : undefined}
        sx={{
          width: { xs: 220, sm: 260 },
          height: { xs: 220, sm: 260 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          borderRadius: 8,
          bgcolor: reveal ? 'secondary.light' : '#fff',
          transition: 'background-color 0.3s ease',
        }}
      >
        {reveal ? (
          // 정답 후: 한글 뜻 + 작은 그림
          <>
            <Box sx={{ fontSize: { xs: 64, sm: 80 }, lineHeight: 1 }}>
              <span role="img" aria-label={item.word}>
                {item.emoji}
              </span>
            </Box>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: { xs: '2.6rem', sm: '3rem' },
                color: '#fff',
                lineHeight: 1.1,
              }}
            >
              {item.ko}
            </Typography>
          </>
        ) : (
          // 평소: 그림(이미지가 있으면 이미지, 없으면 emoji)
          <Box
            sx={{
              fontSize: { xs: 120, sm: 150 },
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              component="img"
              src={item.image}
              alt={item.word}
              sx={{ width: 150, height: 150, objectFit: 'contain', display: 'none' }}
              onLoad={(e) => {
                const img = e.currentTarget;
                img.style.display = 'block';
                const sib = img.nextElementSibling as HTMLElement | null;
                if (sib) sib.style.display = 'none';
              }}
            />
            <span role="img" aria-label={item.word}>
              {item.emoji}
            </span>
          </Box>
        )}
      </Paper>
      <Box sx={{ position: 'absolute', bottom: -8, right: -8 }}>
        {/* reveal 상태면 한국어, 아니면 영어 발음 */}
        <TTSButton
          text={reveal ? item.ko : item.word}
          lang={reveal ? 'ko-KR' : 'en-US'}
        />
      </Box>
    </Box>
  );
}
