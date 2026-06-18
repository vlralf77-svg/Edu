import { Button } from '@mui/material';

export type ChoiceState = 'idle' | 'correct' | 'wrong';

interface Props {
  label: string;
  state: ChoiceState;
  disabled?: boolean;
  onClick: () => void;
}

/** 영단어 보기 버튼 (정답/오답 상태별 색상·애니메이션) */
export default function ChoiceButton({ label, state, disabled, onClick }: Props) {
  const colorByState =
    state === 'correct'
      ? { bg: '#22C55E', border: '#16A34A' }
      : state === 'wrong'
        ? { bg: '#EF4444', border: '#DC2626' }
        : { bg: '#FFFFFF', border: '#E0DCF5' };

  const textColor = state === 'idle' ? 'text.primary' : '#fff';

  return (
    <Button
      fullWidth
      disableElevation
      disabled={disabled}
      onClick={onClick}
      className={state === 'wrong' ? 'tl-shake' : state === 'correct' ? 'tl-pop' : undefined}
      sx={{
        minHeight: 72,
        fontSize: '1.5rem',
        fontWeight: 800,
        borderRadius: 6,
        bgcolor: colorByState.bg,
        color: textColor,
        border: '3px solid',
        borderColor: colorByState.border,
        textTransform: 'lowercase',
        '&:hover': { bgcolor: colorByState.bg },
        '&.Mui-disabled': { color: textColor, opacity: state === 'idle' ? 0.5 : 1 },
      }}
    >
      {label}
    </Button>
  );
}
