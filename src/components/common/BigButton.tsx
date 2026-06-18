import { Button, ButtonProps } from '@mui/material';

/** 아이 손가락에도 잘 눌리는 큰 둥근 버튼 */
export default function BigButton(props: ButtonProps) {
  const { sx, variant = 'contained', ...rest } = props;
  return (
    <Button
      variant={variant}
      sx={{
        minHeight: 64,
        fontSize: '1.3rem',
        fontWeight: 800,
        borderRadius: 999,
        px: 4,
        boxShadow: '0 6px 0 rgba(0,0,0,0.12)',
        transition: 'transform 0.08s ease',
        '&:active': { transform: 'translateY(3px)', boxShadow: '0 3px 0 rgba(0,0,0,0.12)' },
        ...sx,
      }}
      {...rest}
    />
  );
}
