import { IconButton } from '@mui/material';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import { useTTS } from '@/hooks/useTTS';

interface Props {
  text: string;
  lang?: string; // 'en-US' | 'ko-KR' 등
  size?: number;
}

/** 스피커 아이콘 — 터치 시 발음 재생 (언어 지정 가능) */
export default function TTSButton({ text, lang = 'en-US', size = 40 }: Props) {
  const { speak } = useTTS();
  return (
    <IconButton
      aria-label={`${text} 발음 듣기`}
      onClick={() => speak(text, lang)}
      sx={{
        bgcolor: 'secondary.main',
        color: '#fff',
        width: size + 16,
        height: size + 16,
        boxShadow: '0 4px 0 rgba(0,0,0,0.12)',
        '&:hover': { bgcolor: 'secondary.dark' },
        '&:active': { transform: 'translateY(2px)' },
      }}
    >
      <VolumeUpRoundedIcon sx={{ fontSize: size }} />
    </IconButton>
  );
}
