import { Box } from '@mui/material';
import type { ReactNode } from 'react';

// 스틱피겨 동작 패턴 코드
export type MovementArchetype =
  | 'BENCH_PRESS'
  | 'INCLINE_PRESS'
  | 'OVERHEAD_PRESS'
  | 'SQUAT'
  | 'DEADLIFT'
  | 'HIP_THRUST'
  | 'ROW'
  | 'PULLUP'
  | 'BICEPS_CURL'
  | 'TRICEPS_PUSHDOWN'
  | 'LATERAL_RAISE'
  | 'FRONT_RAISE'
  | 'FLY'
  | 'LUNGE'
  | 'LEG_EXT'
  | 'LEG_CURL'
  | 'CALF_RAISE'
  | 'CRUNCH'
  | 'PLANK'
  | 'RUNNING'
  | 'PUSHUP'
  | 'DIPS'
  | 'GENERIC';

// 종목 ID → 동작 패턴 매핑
const ID_MAP: Array<[RegExp, MovementArchetype]> = [
  [/^ex-bench-incline|^ex-chest-press-incline|^ex-bench-incline-db|^ex-bench-incline-smith/, 'INCLINE_PRESS'],
  [/^ex-bench|^ex-chest-press/, 'BENCH_PRESS'],
  [/^ex-db-fly|^ex-cable-fly|^ex-cable-cross|^ex-pec-deck|^ex-chest-fly|^ex-db-pullover/, 'FLY'],
  [/^ex-rear-delt-fly|^ex-cable-reverse-fly|^ex-rear-lat-raise|^ex-face-pull/, 'FLY'],
  [/^ex-dips|^ex-tri-dips-bench/, 'DIPS'],
  [/^ex-pushup/, 'PUSHUP'],
  [/^ex-ohp|^ex-push-press|^ex-shoulder-press|^ex-db-shoulder-press|^ex-barbell-shoulder-press|^ex-kb-shoulder-press/, 'OVERHEAD_PRESS'],
  [/^ex-side-lat-raise|^ex-db-side-raise|^ex-cable-side-raise|^ex-bentover-cable-side-raise|^ex-bentover-db-side-raise|^ex-upright-row/, 'LATERAL_RAISE'],
  [/^ex-db-front-raise|^ex-barbell-front-raise|^ex-ezbar-front-raise|^ex-cable-front-raise/, 'FRONT_RAISE'],
  [/^ex-shrug/, 'OVERHEAD_PRESS'],
  [/^ex-squat|^ex-front-squat|^ex-goblet-squat|^ex-air-squat|^ex-jump-squat|^ex-sumo-squat|^ex-box-squat|^ex-fixed-box-squat|^ex-smith-squat|^ex-hack-squat|^ex-v-squat|^ex-reverse-v-squat|^ex-db-squat/, 'SQUAT'],
  [/^ex-lunge|^ex-split-squat|^ex-bulgarian-split/, 'LUNGE'],
  [/^ex-deadlift|^ex-rdl|^ex-rack-pull|^ex-back-extension|^ex-hyper|^ex-cable-pull-through/, 'DEADLIFT'],
  [/^ex-hip-thrust/, 'HIP_THRUST'],
  [/^ex-hip-abduction|^ex-hip-adduction/, 'HIP_THRUST'],
  [/^ex-leg-press/, 'SQUAT'],
  [/^ex-leg-ext/, 'LEG_EXT'],
  [/^ex-leg-curl/, 'LEG_CURL'],
  [/^ex-calf/, 'CALF_RAISE'],
  [/^ex-barbell-row|^ex-pendlay-row|^ex-db-row|^ex-t-bar-row|^ex-seated-row|^ex-smith-row|^ex-mid-row|^ex-high-row|^ex-low-row|^ex-chest-supported-tbar-row|^ex-inverted-row/, 'ROW'],
  [/^ex-pullup|^ex-chinup|^ex-lat-pulldown|^ex-cable-arm-pulldown/, 'PULLUP'],
  [/^ex-barbell-curl|^ex-ezbar-curl|^ex-db-curl|^ex-hammer-curl|^ex-preacher-curl|^ex-cable-curl|^ex-concentration-curl|^ex-spider-curl|^ex-wrist-curl|^ex-reverse-wrist-curl/, 'BICEPS_CURL'],
  [/^ex-close-grip-bench|^ex-tri-pushdown|^ex-overhead-ext|^ex-skull-crusher|^ex-tri-kickback/, 'TRICEPS_PUSHDOWN'],
  [/^ex-plank|^ex-side-plank/, 'PLANK'],
  [/^ex-crunch|^ex-russian-twist|^ex-cable-woodchop|^ex-ab-wheel/, 'CRUNCH'],
  [/^ex-leg-raise|^ex-hanging-leg-raise|^ex-hanging-knee-raise|^ex-mountain-climber/, 'CRUNCH'],
  [/^ex-running|^ex-cycling|^ex-rowing|^ex-jump-rope|^ex-elliptical|^ex-stair|^ex-treadmill/, 'RUNNING'],
  [/^ex-burpee/, 'PUSHUP'],
  [/^ex-clean-jerk|^ex-snatch|^ex-thruster|^ex-turkish-getup|^ex-kb-swing/, 'DEADLIFT'],
];

export function idToArchetype(exerciseId: string): MovementArchetype {
  for (const [re, arch] of ID_MAP) {
    if (re.test(exerciseId)) return arch;
  }
  return 'GENERIC';
}

const CUES: Record<MovementArchetype, string[]> = {
  BENCH_PRESS: [
    '벤치에 누워 어깨를 뒤로 조이고 견갑을 고정',
    '바를 명치~유두 라인에 천천히 내렸다가 폭발적으로 밀기',
    '팔꿈치 각도 45°, 손목·팔꿈치 일직선 유지',
  ],
  INCLINE_PRESS: [
    '벤치 각도 30~45°, 대흉근 상부 자극에 집중',
    '바를 쇄골 바로 아래로 내리고 상방향으로 밀기',
    '팔꿈치를 몸에 너무 붙이지 말 것',
  ],
  OVERHEAD_PRESS: [
    '코어를 조이고 갈비를 뽑지 않기',
    '바를 이마 앞에서 정수리 위로 밀며 머리 앞으로 살짝 이동',
    '락아웃에서 승모가 위로 올라오지 않도록 견갑 안정',
  ],
  SQUAT: [
    '발은 어깨너비, 발끝은 15~30° 바깥',
    '가슴 세우고 무릎이 발끝 방향으로 굽혀지도록 앉기',
    '고관절 힘으로 밀어 올리며 무릎 잠그지 않기',
  ],
  DEADLIFT: [
    '바는 발등 위, 정강이에 살짝 닿을 정도',
    '어깨는 바 살짝 앞, 등은 중립 유지 (라운딩 금지)',
    '다리로 밀어내며 힙을 뒤로 → 앞으로 밀어 상체 세우기',
  ],
  HIP_THRUST: [
    '어깨는 벤치, 발은 무릎 아래에 배치',
    '턱은 당기고 갈비 눌러 코어 유지',
    '엉덩이로 밀어 올리며 최고점에서 골반 스퀴즈',
  ],
  ROW: [
    '등을 곧게 유지하고 무릎 살짝 굽힘',
    '팔꿈치를 갈비 옆으로 당기며 견갑을 조이기',
    '바를 배꼽 방향으로 당기고 상체 흔들지 않기',
  ],
  PULLUP: [
    '데드행에서 시작, 견갑 하강 → 팔꿈치 아래·뒤로',
    '가슴을 봉에 가깝게 올려 광배 스퀴즈',
    '내려올 때 컨트롤, 튕기지 말 것',
  ],
  BICEPS_CURL: [
    '팔꿈치는 몸통 옆에 고정',
    '상완이 흔들리지 않게 이두만 사용',
    '최고점에서 스퀴즈, 천천히 내리기',
  ],
  TRICEPS_PUSHDOWN: [
    '팔꿈치를 몸에 붙이고 상완 고정',
    '전완만 아래로 내리며 삼두 수축',
    '완전히 폈다가 컨트롤하며 되돌리기',
  ],
  LATERAL_RAISE: [
    '팔꿈치 살짝 굽히고 몸통 흔들지 않기',
    '어깨 높이까지 옆으로 올리고 새끼손가락이 조금 위',
    '내릴 때 저항 유지, 반동 금지',
  ],
  FRONT_RAISE: [
    '팔꿈치 거의 편 상태에서 앞으로 어깨 높이까지',
    '몸통 반동 없이, 견갑은 안정',
    '내릴 때도 저항 유지',
  ],
  FLY: [
    '팔꿈치 살짝 굽힌 상태 유지 (움직임 최소)',
    '가슴을 열며 팔을 옆으로 넓게',
    '가운데로 조일 때 대흉근 수축 느끼기',
  ],
  LUNGE: [
    '앞다리 무릎이 발끝을 넘지 않게',
    '뒷다리 무릎이 바닥에 살짝 닿을 정도로 내려가기',
    '상체 세우고 앞다리 힘으로 밀어 올라오기',
  ],
  LEG_EXT: [
    '패드 위치는 발목 살짝 위',
    '무릎만 사용해 앞으로 완전히 뻗기',
    '천천히 내려오며 대퇴사두 스퀴즈',
  ],
  LEG_CURL: [
    '엎드리거나 앉아 무릎만 접기',
    '엉덩이 들썩거리지 않기',
    '햄스트링 스퀴즈 후 천천히 되돌리기',
  ],
  CALF_RAISE: [
    '발볼로 힘껏 밀어 올리기 (뒷꿈치 최대한 위로)',
    '최고점에서 잠시 정지',
    '천천히 뒤꿈치를 내려 스트레치',
  ],
  CRUNCH: [
    '허리는 바닥에 붙이고 상체만 말아 올리기',
    '목이 아니라 복근으로 들어올리기',
    '내려올 때도 복근 수축 유지',
  ],
  PLANK: [
    '팔꿈치는 어깨 아래, 몸은 일직선',
    '엉덩이가 처지거나 뜨지 않게',
    '코어 조이고 호흡 유지',
  ],
  RUNNING: [
    '가슴을 열고 시선은 정면',
    '팔은 자연스럽게 앞뒤로 흔들기',
    '착지 후 굴러가듯 앞으로 나아가기',
  ],
  PUSHUP: [
    '손은 어깨 아래, 몸은 일직선',
    '가슴이 바닥에 살짝 닿을 정도로 내리기',
    '팔꿈치 각도 45°, 코어 조이며 밀어 올리기',
  ],
  DIPS: [
    '어깨가 팔꿈치 라인 아래로 내려가면 STOP',
    '가슴 앞으로 살짝 기울여 대흉근 참여',
    '팔로 밀어 올리며 코어 유지',
  ],
  GENERIC: [
    '천천히 컨트롤된 동작으로 진행',
    '해당 근육에 자극을 느끼며 반복',
  ],
};

export function getCues(exerciseId: string): string[] {
  return CUES[idToArchetype(exerciseId)];
}

// ========== 시각 상수 ==========
const SKIN = '#F5E1CB'; // 살색 톤 다운
const BODY = '#3D4A5C'; // 몸통 옷 색상
const BODY_DARK = '#2A3441';
const ACCENT = '#FF6B35'; // 오렌지 (타겟 근육/포커스)
const GEAR_DARK = '#1A2332'; // 원판·바
const GEAR_METAL = '#B0BEC5'; // 은색 부품
const GROUND = 'rgba(255,255,255,0.08)';

// SVG 그라디언트·필터 defs (모든 도형이 참조)
function SvgDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={BODY} />
        <stop offset="1" stopColor={BODY_DARK} />
      </linearGradient>
      <radialGradient id={`${id}-plate`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#3A4756" />
        <stop offset="1" stopColor={GEAR_DARK} />
      </radialGradient>
      <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor={ACCENT} stopOpacity="0.9" />
        <stop offset="1" stopColor={ACCENT} stopOpacity="0" />
      </radialGradient>
      <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2" />
      </filter>
    </defs>
  );
}

// ==================== 공통 파츠 ====================

// 관절 원 (뼈 연결부)
const Joint = ({ cx, cy, r = 3 }: { cx: number; cy: number; r?: number }) => (
  <circle cx={cx} cy={cy} r={r} fill={BODY} />
);

// 두꺼운 뼈 (사각형/선분)
const Bone = ({
  x1,
  y1,
  x2,
  y2,
  w = 8,
  color = BODY,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w?: number;
  color?: string;
}) => (
  <line
    x1={x1}
    y1={y1}
    x2={x2}
    y2={y2}
    stroke={color}
    strokeWidth={w}
    strokeLinecap="round"
  />
);

// 머리 + 목
const Head = ({ cx, cy, r = 10, id }: { cx: number; cy: number; r?: number; id: string }) => (
  <>
    <circle cx={cx} cy={cy} r={r} fill={SKIN} stroke={BODY_DARK} strokeWidth={1.5} />
    {/* 머리카락 살짝 */}
    <path
      d={`M ${cx - r * 0.9} ${cy - r * 0.3} Q ${cx} ${cy - r * 1.3} ${cx + r * 0.9} ${cy - r * 0.3}`}
      fill={BODY_DARK}
    />
    <SvgDefs id={id} />
  </>
);

// 몸통 (사다리꼴 – 어깨 넓고 허리 좁게)
const Torso = ({
  cx,
  cyTop,
  cyBottom,
  wShoulder = 34,
  wHip = 26,
  id,
}: {
  cx: number;
  cyTop: number;
  cyBottom: number;
  wShoulder?: number;
  wHip?: number;
  id: string;
}) => {
  const l1 = cx - wShoulder / 2;
  const r1 = cx + wShoulder / 2;
  const l2 = cx - wHip / 2;
  const r2 = cx + wHip / 2;
  return (
    <path
      d={`M ${l1} ${cyTop} L ${r1} ${cyTop} L ${r2} ${cyBottom} L ${l2} ${cyBottom} Z`}
      fill={`url(#${id}-body)`}
      stroke={BODY_DARK}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  );
};

// 바벨 (플레이트 붙은 봉)
const Barbell = ({
  x1,
  x2,
  y,
  plate = 10,
  className,
  id,
}: {
  x1: number;
  x2: number;
  y: number;
  plate?: number;
  className?: string;
  id: string;
}) => (
  <g className={className}>
    <line x1={x1} y1={y} x2={x2} y2={y} stroke={GEAR_METAL} strokeWidth={4} strokeLinecap="round" />
    <rect
      x={x1 - 3}
      y={y - plate * 1.1}
      width={6}
      height={plate * 2.2}
      fill={`url(#${id}-plate)`}
      rx={2}
    />
    <rect
      x={x2 - 3}
      y={y - plate * 1.1}
      width={6}
      height={plate * 2.2}
      fill={`url(#${id}-plate)`}
      rx={2}
    />
    <circle cx={x1} cy={y} r={plate} fill={`url(#${id}-plate)`} stroke={BODY_DARK} strokeWidth={1.5} />
    <circle cx={x2} cy={y} r={plate} fill={`url(#${id}-plate)`} stroke={BODY_DARK} strokeWidth={1.5} />
    {/* 원판 하이라이트 */}
    <circle cx={x1 - 3} cy={y - 3} r={2.5} fill="rgba(255,255,255,0.25)" />
    <circle cx={x2 - 3} cy={y - 3} r={2.5} fill="rgba(255,255,255,0.25)" />
  </g>
);

// 덤벨 (한쪽만)
const Dumbbell = ({ cx, cy, size = 7 }: { cx: number; cy: number; size?: number }) => (
  <g>
    <rect x={cx - 3} y={cy - 2} width={6} height={4} fill={GEAR_METAL} rx={1} />
    <circle cx={cx - 5} cy={cy} r={size} fill={GEAR_DARK} stroke={BODY_DARK} strokeWidth={1} />
    <circle cx={cx + 5} cy={cy} r={size} fill={GEAR_DARK} stroke={BODY_DARK} strokeWidth={1} />
  </g>
);

// 근육 타겟 글로우 (peak 순간에 커짐)
const MuscleGlow = ({
  cx,
  cy,
  r = 14,
  className,
  id,
}: {
  cx: number;
  cy: number;
  r?: number;
  className?: string;
  id: string;
}) => (
  <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-glow)`} className={className} />
);

// 방향 화살표 (모션 힌트)
const MotionArrow = ({
  x,
  y,
  direction,
  size = 10,
}: {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  size?: number;
}) => {
  const angle = { up: 0, right: 90, down: 180, left: 270 }[direction];
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path
        d={`M 0 ${-size} L ${-size * 0.6} ${size * 0.4} L 0 0 L ${size * 0.6} ${size * 0.4} Z`}
        fill={ACCENT}
      />
    </g>
  );
};

// 지면
const Ground = ({ y = 195 }: { y?: number }) => (
  <line x1="10" y1={y} x2="230" y2={y} stroke={GROUND} strokeWidth={3} strokeLinecap="round" />
);

// 벤치
const Bench = ({
  x,
  y,
  w = 140,
  h = 8,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
}) => (
  <g>
    <rect x={x} y={y} width={w} height={h} fill="#4A5568" rx={2} stroke={BODY_DARK} strokeWidth={1} />
    <rect x={x + 6} y={y + h} width={6} height={h * 3} fill="#374151" />
    <rect x={x + w - 12} y={y + h} width={6} height={h * 3} fill="#374151" />
  </g>
);

// 스틱피겨 컨테이너
export default function ExerciseAnimation({
  archetype,
}: {
  archetype: MovementArchetype;
}) {
  const R = renderArchetype(archetype);
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        py: 1.5,
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <svg viewBox="0 0 240 210" width={260} height={228} xmlns="http://www.w3.org/2000/svg">
        {R}
      </svg>
    </Box>
  );
}

function renderArchetype(a: MovementArchetype): ReactNode {
  switch (a) {
    case 'BENCH_PRESS': return <BenchPressFigure />;
    case 'INCLINE_PRESS': return <InclinePressFigure />;
    case 'OVERHEAD_PRESS': return <OverheadPressFigure />;
    case 'SQUAT': return <SquatFigure />;
    case 'DEADLIFT': return <DeadliftFigure />;
    case 'HIP_THRUST': return <HipThrustFigure />;
    case 'ROW': return <RowFigure />;
    case 'PULLUP': return <PullupFigure />;
    case 'BICEPS_CURL': return <BicepsCurlFigure />;
    case 'TRICEPS_PUSHDOWN': return <TricepsPushdownFigure />;
    case 'LATERAL_RAISE': return <LateralRaiseFigure />;
    case 'FRONT_RAISE': return <FrontRaiseFigure />;
    case 'FLY': return <FlyFigure />;
    case 'LUNGE': return <LungeFigure />;
    case 'LEG_EXT': return <LegExtFigure />;
    case 'LEG_CURL': return <LegCurlFigure />;
    case 'CALF_RAISE': return <CalfRaiseFigure />;
    case 'CRUNCH': return <CrunchFigure />;
    case 'PLANK': return <PlankFigure />;
    case 'RUNNING': return <RunningFigure />;
    case 'PUSHUP': return <PushupFigure />;
    case 'DIPS': return <DipsFigure />;
    default: return <GenericFigure />;
  }
}

// ==================== 개별 스틱피겨 (풍부 버전) ====================

function BenchPressFigure() {
  const id = 'bp';
  return (
    <>
      <style>{`
        @keyframes ${id}-upperArm { 0%,100% { transform: rotate(-8deg); } 50% { transform: rotate(52deg); } }
        @keyframes ${id}-forearm { 0%,100% { transform: rotate(80deg); } 50% { transform: rotate(2deg); } }
        @keyframes ${id}-bar     { 0%,100% { transform: translateY(0); }  50% { transform: translateY(38px); } }
        @keyframes ${id}-glow    { 0%,100% { transform: scale(0.6); opacity: 0.2; } 50% { transform: scale(1.4); opacity: 0.9; } }
        .${id}-ua-l { animation: ${id}-upperArm 1.8s ease-in-out infinite; transform-origin: 120px 90px; }
        .${id}-ua-r { animation: ${id}-upperArm 1.8s ease-in-out infinite; transform-origin: 140px 90px; }
        .${id}-fa-l { animation: ${id}-forearm  1.8s ease-in-out infinite; transform-origin: 100px 60px; }
        .${id}-fa-r { animation: ${id}-forearm  1.8s ease-in-out infinite; transform-origin: 160px 60px; }
        .${id}-bar  { animation: ${id}-bar      1.8s ease-in-out infinite; }
        .${id}-glow { animation: ${id}-glow     1.8s ease-in-out infinite; transform-origin: 130px 90px; }
      `}</style>
      <Head cx={40} cy={95} r={11} id={id} />

      <Bench x={40} y={112} />

      {/* 다리 (누워 무릎 굽힘) */}
      <Bone x1={155} y1={100} x2={190} y2={135} w={10} />
      <Bone x1={190} y1={135} x2={200} y2={175} w={10} />
      <Joint cx={190} cy={135} r={5} />
      {/* 발 */}
      <line x1="195" y1="175" x2="215" y2="175" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />

      {/* 몸통 (누운 자세 - 옆으로) */}
      <path
        d={`M 55 95 L 155 95 L 158 105 L 55 105 Z`}
        fill={`url(#${id}-body)`}
        stroke={BODY_DARK}
        strokeWidth={1.5}
      />

      {/* 근육 타겟 글로우 (가슴 부위) */}
      <MuscleGlow cx={130} cy={90} r={20} className={`${id}-glow`} id={id} />

      {/* 팔 (양쪽 겹쳐 그려서 두꺼워 보임) */}
      <g className={`${id}-ua-r`}>
        <Bone x1={140} y1={90} x2={160} y2={60} w={9} />
        <Joint cx={160} cy={60} r={4} />
        <g className={`${id}-fa-r`}>
          <Bone x1={160} y1={60} x2={160} y2={30} w={8} />
        </g>
      </g>
      <g className={`${id}-ua-l`}>
        <Bone x1={120} y1={90} x2={100} y2={60} w={9} color="#334155" />
        <Joint cx={100} cy={60} r={4} />
        <g className={`${id}-fa-l`}>
          <Bone x1={100} y1={60} x2={100} y2={30} w={8} color="#334155" />
        </g>
      </g>

      {/* 바벨 (움직임) */}
      <g className={`${id}-bar`}>
        <Barbell x1={100} x2={160} y={30} id={id} />
        <MotionArrow x={130} y={-2} direction="up" size={9} />
      </g>
    </>
  );
}

function InclinePressFigure() {
  const id = 'ip';
  return (
    <>
      <style>{`
        @keyframes ${id}-arm { 0%,100% { transform: rotate(-15deg); } 50% { transform: rotate(45deg); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.7); opacity: 0.3; } 50% { transform: scale(1.4); opacity: 0.85; } }
        .${id}-arm-l { animation: ${id}-arm 1.8s ease-in-out infinite; transform-origin: 130px 100px; }
        .${id}-arm-r { animation: ${id}-arm 1.8s ease-in-out infinite; transform-origin: 130px 100px; }
        .${id}-glow  { animation: ${id}-glow 1.8s ease-in-out infinite; transform-origin: 125px 90px; }
      `}</style>
      <SvgDefs id={id} />

      {/* 인클라인 벤치 */}
      <polygon points="30,180 175,80 185,90 40,190" fill="#4A5568" stroke={BODY_DARK} strokeWidth={1.5} />

      {/* 다리 */}
      <Bone x1={50} y1={168} x2={70} y2={195} w={9} />
      <Bone x1={70} y1={195} x2={90} y2={195} w={8} />

      {/* 몸통 (기울어짐) */}
      <path
        d={`M 68 158 L 155 90 L 160 100 L 74 168 Z`}
        fill={`url(#${id}-body)`}
        stroke={BODY_DARK}
        strokeWidth={1.5}
      />
      <Head cx={162} cy={82} r={11} id={id + '2'} />

      <MuscleGlow cx={125} cy={90} r={22} className={`${id}-glow`} id={id} />

      {/* 팔 */}
      <g className={`${id}-arm-r`}>
        <Bone x1={130} y1={100} x2={160} y2={50} w={9} />
        <Joint cx={160} cy={50} r={4} />
        <Barbell x1={135} x2={185} y={50} plate={9} id={id} />
      </g>
    </>
  );
}

function OverheadPressFigure() {
  const id = 'ohp';
  return (
    <>
      <style>{`
        @keyframes ${id}-ua { 0%,100% { transform: rotate(90deg); } 50% { transform: rotate(0deg); } }
        @keyframes ${id}-fa { 0%,100% { transform: rotate(-90deg); } 50% { transform: rotate(0deg); } }
        @keyframes ${id}-bar { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-50px); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.2; } 50% { transform: scale(1.4); opacity: 0.8; } }
        .${id}-ua-l { animation: ${id}-ua 1.8s ease-in-out infinite; transform-origin: 105px 92px; }
        .${id}-ua-r { animation: ${id}-ua 1.8s ease-in-out infinite; transform-origin: 135px 92px; }
        .${id}-fa-l { animation: ${id}-fa 1.8s ease-in-out infinite; transform-origin: 85px 110px; }
        .${id}-fa-r { animation: ${id}-fa 1.8s ease-in-out infinite; transform-origin: 155px 110px; }
        .${id}-bar  { animation: ${id}-bar 1.8s ease-in-out infinite; }
        .${id}-glow { animation: ${id}-glow 1.8s ease-in-out infinite; transform-origin: 120px 88px; }
      `}</style>

      {/* 지면 */}
      <Ground y={192} />

      {/* 다리 */}
      <Bone x1={110} y1={155} x2={100} y2={192} w={12} />
      <Bone x1={130} y1={155} x2={140} y2={192} w={12} />
      <Joint cx={110} cy={155} r={5} />
      <Joint cx={130} cy={155} r={5} />
      <line x1="93" y1="192" x2="115" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
      <line x1="133" y1="192" x2="155" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />

      {/* 몸통 */}
      <Torso cx={120} cyTop={92} cyBottom={158} wShoulder={38} wHip={28} id={id} />

      <MuscleGlow cx={120} cy={88} r={22} className={`${id}-glow`} id={id} />

      {/* 머리 */}
      <Head cx={120} cy={78} r={11} id={id + '2'} />

      {/* 팔 (양쪽 벌리기) */}
      <g className={`${id}-ua-l`}>
        <Bone x1={105} y1={92} x2={85} y2={110} w={9} />
        <Joint cx={85} cy={110} r={4} />
        <g className={`${id}-fa-l`}>
          <Bone x1={85} y1={110} x2={85} y2={90} w={8} />
        </g>
      </g>
      <g className={`${id}-ua-r`}>
        <Bone x1={135} y1={92} x2={155} y2={110} w={9} />
        <Joint cx={155} cy={110} r={4} />
        <g className={`${id}-fa-r`}>
          <Bone x1={155} y1={110} x2={155} y2={90} w={8} />
        </g>
      </g>

      {/* 바 */}
      <g className={`${id}-bar`}>
        <Barbell x1={70} x2={170} y={95} plate={10} id={id} />
        <MotionArrow x={120} y={55} direction="up" size={9} />
      </g>
    </>
  );
}

function SquatFigure() {
  const id = 'sq';
  return (
    <>
      <style>{`
        @keyframes ${id}-body { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(28px) rotate(-8deg); } }
        @keyframes ${id}-thigh { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(35deg); } }
        @keyframes ${id}-shin { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-40deg); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.2; } 50% { transform: scale(1.3); opacity: 0.8; } }
        .${id}-body { animation: ${id}-body 2s ease-in-out infinite; transform-origin: 120px 130px; }
        .${id}-thigh-l { animation: ${id}-thigh 2s ease-in-out infinite; transform-origin: 108px 128px; }
        .${id}-thigh-r { animation: ${id}-thigh 2s ease-in-out infinite; transform-origin: 132px 128px; }
        .${id}-shin-l { animation: ${id}-shin 2s ease-in-out infinite; transform-origin: 105px 165px; }
        .${id}-shin-r { animation: ${id}-shin 2s ease-in-out infinite; transform-origin: 135px 165px; }
        .${id}-glow { animation: ${id}-glow 2s ease-in-out infinite; transform-origin: 120px 165px; }
      `}</style>

      <Ground y={192} />

      {/* 발 */}
      <line x1="90" y1="192" x2="120" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
      <line x1="120" y1="192" x2="150" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />

      {/* 정강이 */}
      <g className={`${id}-shin-l`}>
        <Bone x1={105} y1={165} x2={105} y2={192} w={11} />
        <Joint cx={105} cy={165} r={5} />
      </g>
      <g className={`${id}-shin-r`}>
        <Bone x1={135} y1={165} x2={135} y2={192} w={11} />
        <Joint cx={135} cy={165} r={5} />
      </g>

      {/* 상체(몸통 + 허벅지) */}
      <g className={`${id}-body`}>
        <g className={`${id}-thigh-l`}>
          <Bone x1={108} y1={128} x2={105} y2={165} w={13} />
        </g>
        <g className={`${id}-thigh-r`}>
          <Bone x1={132} y1={128} x2={135} y2={165} w={13} />
        </g>
        <MuscleGlow cx={120} cy={148} r={20} className={`${id}-glow`} id={id} />
        <Torso cx={120} cyTop={80} cyBottom={130} wShoulder={40} wHip={30} id={id} />
        <Head cx={120} cy={68} r={11} id={id + '2'} />

        {/* 어깨 위 바벨 */}
        <line x1="102" y1="82" x2="138" y2="82" stroke={GEAR_METAL} strokeWidth={3} />
        <Barbell x1={80} x2={160} y={80} plate={10} id={id} />
      </g>

      <MotionArrow x={195} y={140} direction="down" size={8} />
    </>
  );
}

function DeadliftFigure() {
  const id = 'dl';
  return (
    <>
      <style>{`
        @keyframes ${id}-body { 0%,100% { transform: rotate(0deg) translateY(0); } 50% { transform: rotate(-55deg) translateY(10px); } }
        @keyframes ${id}-bar  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(50px); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.7); opacity: 0.25; } 50% { transform: scale(1.3); opacity: 0.8; } }
        .${id}-body { animation: ${id}-body 2s ease-in-out infinite; transform-origin: 120px 155px; }
        .${id}-bar  { animation: ${id}-bar 2s ease-in-out infinite; }
        .${id}-glow-back { animation: ${id}-glow 2s ease-in-out infinite; transform-origin: 120px 130px; }
        .${id}-glow-ham  { animation: ${id}-glow 2s ease-in-out infinite; transform-origin: 120px 170px; }
      `}</style>

      <Ground y={192} />

      {/* 다리 */}
      <Bone x1={110} y1={155} x2={100} y2={192} w={13} />
      <Bone x1={130} y1={155} x2={140} y2={192} w={13} />
      <line x1="93" y1="192" x2="115" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
      <line x1="133" y1="192" x2="155" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
      <MuscleGlow cx={120} cy={170} r={16} className={`${id}-glow-ham`} id={id} />

      {/* 상체 (움직임) */}
      <g className={`${id}-body`}>
        <Torso cx={120} cyTop={95} cyBottom={155} wShoulder={40} wHip={30} id={id} />
        <Head cx={120} cy={85} r={11} id={id + '2'} />
        <MuscleGlow cx={120} cy={125} r={18} className={`${id}-glow-back`} id={id} />
        {/* 팔 아래로 (곧게) */}
        <Bone x1={104} y1={105} x2={100} y2={150} w={9} />
        <Bone x1={136} y1={105} x2={140} y2={150} w={9} />
      </g>

      {/* 바 (움직임) */}
      <g className={`${id}-bar`}>
        <Barbell x1={70} x2={170} y={150} plate={11} id={id} />
        <MotionArrow x={195} y={130} direction="up" size={9} />
      </g>
    </>
  );
}

function HipThrustFigure() {
  const id = 'ht';
  return (
    <>
      <style>{`
        @keyframes ${id}-hips { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-30px); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.25; } 50% { transform: scale(1.4); opacity: 0.85; } }
        .${id}-body { animation: ${id}-hips 1.8s ease-in-out infinite; }
        .${id}-glow { animation: ${id}-glow 1.8s ease-in-out infinite; transform-origin: 130px 135px; }
      `}</style>

      <Ground y={192} />
      {/* 벤치 (어깨) */}
      <rect x="150" y="105" width="80" height="10" fill="#4A5568" rx={2} stroke={BODY_DARK} strokeWidth={1} />

      {/* 발 (고정) */}
      <line x1="25" y1="192" x2="55" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />

      {/* 정강이 (고정) */}
      <Bone x1={40} y1={192} x2={80} y2={150} w={13} />
      <Joint cx={80} cy={150} r={5} />

      {/* 상체·허벅지 (움직임) */}
      <g className={`${id}-body`}>
        <Bone x1={80} y1={150} x2={155} y2={140} w={16} color={BODY} />
        <MuscleGlow cx={130} cy={140} r={22} className={`${id}-glow`} id={id} />
        {/* 상체 */}
        <path
          d={`M 145 128 L 195 118 L 200 128 L 148 138 Z`}
          fill={`url(#${id}-body)`}
          stroke={BODY_DARK}
          strokeWidth={1.5}
        />
        <Head cx={200} cy={112} r={11} id={id + '2'} />

        {/* 어깨 위 바벨 */}
        <Barbell x1={90} x2={155} y={140} plate={9} id={id} />
      </g>

      <MotionArrow x={215} y={70} direction="up" size={8} />
    </>
  );
}

function RowFigure() {
  const id = 'row';
  return (
    <>
      <style>{`
        @keyframes ${id}-ua { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-90deg); } }
        @keyframes ${id}-bar { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-40px); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.25; } 50% { transform: scale(1.4); opacity: 0.85; } }
        .${id}-arm { animation: ${id}-ua 1.5s ease-in-out infinite; transform-origin: 135px 120px; }
        .${id}-bar { animation: ${id}-bar 1.5s ease-in-out infinite; }
        .${id}-glow { animation: ${id}-glow 1.5s ease-in-out infinite; transform-origin: 145px 105px; }
      `}</style>

      <Ground y={192} />

      {/* 다리 (구부린 자세) */}
      <Bone x1={110} y1={145} x2={95} y2={175} w={12} />
      <Bone x1={95} y1={175} x2={90} y2={192} w={11} />
      <Bone x1={120} y1={145} x2={130} y2={175} w={12} />
      <Bone x1={130} y1={175} x2={135} y2={192} w={11} />
      <line x1="80" y1="192" x2="105" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
      <line x1="125" y1="192" x2="150" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />

      {/* 몸통 (앞으로 숙임) */}
      <path
        d={`M 100 145 L 175 105 L 185 118 L 108 155 Z`}
        fill={`url(#${id}-body)`}
        stroke={BODY_DARK}
        strokeWidth={1.5}
      />
      <MuscleGlow cx={145} cy={105} r={20} className={`${id}-glow`} id={id} />
      <Head cx={185} cy={98} r={11} id={id} />

      {/* 팔 */}
      <g className={`${id}-arm`}>
        <Bone x1={135} y1={120} x2={140} y2={160} w={9} />
      </g>

      {/* 바 */}
      <g className={`${id}-bar`}>
        <Barbell x1={100} x2={180} y={165} plate={9} id={id} />
        <MotionArrow x={130} y={140} direction="up" size={8} />
      </g>
    </>
  );
}

function PullupFigure() {
  const id = 'pu';
  return (
    <>
      <style>{`
        @keyframes ${id}-body { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-32px); } }
        @keyframes ${id}-ua { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(45deg); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.25; } 50% { transform: scale(1.5); opacity: 0.85; } }
        .${id}-body { animation: ${id}-body 2s ease-in-out infinite; }
        .${id}-ua-l { animation: ${id}-ua 2s ease-in-out infinite; transform-origin: 92px 40px; }
        .${id}-ua-r { animation: ${id}-ua 2s ease-in-out infinite; transform-origin: 148px 40px; }
        .${id}-glow { animation: ${id}-glow 2s ease-in-out infinite; transform-origin: 120px 90px; }
      `}</style>

      {/* 봉 (고정) */}
      <line x1="40" y1="30" x2="200" y2="30" stroke={GEAR_METAL} strokeWidth={5} strokeLinecap="round" />
      <line x1="40" y1="25" x2="40" y2="10" stroke={GEAR_DARK} strokeWidth={3} />
      <line x1="200" y1="25" x2="200" y2="10" stroke={GEAR_DARK} strokeWidth={3} />

      {/* 손목 (봉 고정) */}
      <circle cx="92" cy="35" r="4" fill={SKIN} />
      <circle cx="148" cy="35" r="4" fill={SKIN} />

      {/* 상완 (몸이 올라올 때 팔꿈치 굽힘) */}
      <g className={`${id}-body`}>
        <g className={`${id}-ua-l`}>
          <Bone x1={92} y1={40} x2={102} y2={85} w={9} />
        </g>
        <g className={`${id}-ua-r`}>
          <Bone x1={148} y1={40} x2={138} y2={85} w={9} />
        </g>
        {/* 몸통 */}
        <Torso cx={120} cyTop={85} cyBottom={145} wShoulder={40} wHip={30} id={id} />
        <Head cx={120} cy={73} r={11} id={id + '2'} />
        <MuscleGlow cx={120} cy={100} r={20} className={`${id}-glow`} id={id} />
        {/* 다리 (꼬임) */}
        <Bone x1={112} y1={145} x2={100} y2={185} w={11} />
        <Bone x1={128} y1={145} x2={140} y2={185} w={11} />
      </g>

      <MotionArrow x={215} y={90} direction="up" size={8} />
    </>
  );
}

function BicepsCurlFigure() {
  const id = 'bc';
  return (
    <>
      <style>{`
        @keyframes ${id}-fa { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-135deg); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.2; } 50% { transform: scale(1.5); opacity: 0.9; } }
        @keyframes ${id}-arrow { 0%,100% { transform: translateY(0); opacity: 0; } 30%,70% { opacity: 1; } 50% { transform: translateY(-30px); } }
        .${id}-fa-l { animation: ${id}-fa 1.4s ease-in-out infinite; transform-origin: 100px 105px; }
        .${id}-fa-r { animation: ${id}-fa 1.4s ease-in-out infinite; transform-origin: 140px 105px; }
        .${id}-glow-l { animation: ${id}-glow 1.4s ease-in-out infinite; transform-origin: 100px 92px; }
        .${id}-glow-r { animation: ${id}-glow 1.4s ease-in-out infinite; transform-origin: 140px 92px; }
        .${id}-arrow { animation: ${id}-arrow 1.4s ease-in-out infinite; }
      `}</style>

      <Ground y={192} />

      {/* 다리 */}
      <Bone x1={112} y1={150} x2={102} y2={192} w={12} />
      <Bone x1={128} y1={150} x2={138} y2={192} w={12} />
      <line x1="95" y1="192" x2="115" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
      <line x1="133" y1="192" x2="153" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />

      {/* 몸통 */}
      <Torso cx={120} cyTop={75} cyBottom={150} wShoulder={40} wHip={30} id={id} />
      <Head cx={120} cy={63} r={11} id={id + '2'} />

      {/* 상완 (고정, 몸통 옆) */}
      <Bone x1={100} y1={80} x2={100} y2={105} w={9} />
      <Bone x1={140} y1={80} x2={140} y2={105} w={9} />
      <MuscleGlow cx={100} cy={92} r={12} className={`${id}-glow-l`} id={id} />
      <MuscleGlow cx={140} cy={92} r={12} className={`${id}-glow-r`} id={id} />

      {/* 전완 (움직임) */}
      <g className={`${id}-fa-r`}>
        <Bone x1={140} y1={105} x2={140} y2={145} w={9} />
        <g>
          <Dumbbell cx={140} cy={148} size={7} />
        </g>
      </g>
      <g className={`${id}-fa-l`}>
        <Bone x1={100} y1={105} x2={100} y2={145} w={9} />
        <g>
          <Dumbbell cx={100} cy={148} size={7} />
        </g>
      </g>

      <g className={`${id}-arrow`}>
        <MotionArrow x={175} y={110} direction="up" size={9} />
      </g>
    </>
  );
}

function TricepsPushdownFigure() {
  const id = 'tp';
  return (
    <>
      <style>{`
        @keyframes ${id}-fa { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(80deg); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.2; } 50% { transform: scale(1.5); opacity: 0.85; } }
        .${id}-fa { animation: ${id}-fa 1.2s ease-in-out infinite; transform-origin: 130px 108px; }
        .${id}-glow { animation: ${id}-glow 1.2s ease-in-out infinite; transform-origin: 128px 90px; }
      `}</style>

      <Ground y={192} />

      {/* 도르래 */}
      <rect x="180" y="15" width="20" height="12" fill="#4A5568" rx={2} />
      <circle cx="190" cy="27" r="6" stroke={GEAR_METAL} strokeWidth={2} fill="none" />
      <line x1="190" y1="33" x2="150" y2="108" stroke={GEAR_METAL} strokeWidth={1.5} />

      {/* 다리 */}
      <Bone x1={112} y1={150} x2={102} y2={192} w={12} />
      <Bone x1={128} y1={150} x2={138} y2={192} w={12} />
      <line x1="95" y1="192" x2="115" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
      <line x1="133" y1="192" x2="153" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />

      <Torso cx={120} cyTop={75} cyBottom={150} wShoulder={40} wHip={30} id={id} />
      <Head cx={120} cy={63} r={11} id={id + '2'} />

      {/* 상완 (고정) */}
      <Bone x1={130} y1={82} x2={130} y2={108} w={9} />
      <MuscleGlow cx={128} cy={90} r={14} className={`${id}-glow`} id={id} />

      {/* 전완 (움직임) */}
      <g className={`${id}-fa`}>
        <Bone x1={130} y1={108} x2={150} y2={148} w={9} />
        {/* 손잡이 */}
        <rect x="145" y="145" width="12" height="4" rx="1" fill={GEAR_METAL} />
      </g>

      <MotionArrow x={165} y={140} direction="down" size={8} />
    </>
  );
}

function LateralRaiseFigure() {
  const id = 'lr';
  return (
    <>
      <style>{`
        @keyframes ${id}-armL { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-88deg); } }
        @keyframes ${id}-armR { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(88deg); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.2; } 50% { transform: scale(1.5); opacity: 0.9; } }
        .${id}-arm-l { animation: ${id}-armL 1.5s ease-in-out infinite; transform-origin: 100px 82px; }
        .${id}-arm-r { animation: ${id}-armR 1.5s ease-in-out infinite; transform-origin: 140px 82px; }
        .${id}-glow-l { animation: ${id}-glow 1.5s ease-in-out infinite; transform-origin: 96px 80px; }
        .${id}-glow-r { animation: ${id}-glow 1.5s ease-in-out infinite; transform-origin: 144px 80px; }
      `}</style>

      <Ground y={192} />

      <Bone x1={112} y1={150} x2={102} y2={192} w={12} />
      <Bone x1={128} y1={150} x2={138} y2={192} w={12} />
      <line x1="95" y1="192" x2="115" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
      <line x1="133" y1="192" x2="153" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />

      <Torso cx={120} cyTop={72} cyBottom={150} wShoulder={40} wHip={30} id={id} />
      <Head cx={120} cy={60} r={11} id={id + '2'} />

      <MuscleGlow cx={96} cy={80} r={14} className={`${id}-glow-l`} id={id} />
      <MuscleGlow cx={144} cy={80} r={14} className={`${id}-glow-r`} id={id} />

      {/* 팔 (좌우 대칭 벌리기) */}
      <g className={`${id}-arm-l`}>
        <Bone x1={100} y1={82} x2={100} y2={135} w={9} />
        <Dumbbell cx={100} cy={140} size={7} />
      </g>
      <g className={`${id}-arm-r`}>
        <Bone x1={140} y1={82} x2={140} y2={135} w={9} />
        <Dumbbell cx={140} cy={140} size={7} />
      </g>

      <MotionArrow x={40} y={100} direction="up" size={8} />
      <MotionArrow x={200} y={100} direction="up" size={8} />
    </>
  );
}

function FrontRaiseFigure() {
  const id = 'fr';
  return (
    <>
      <style>{`
        @keyframes ${id}-arm { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-95deg); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.2; } 50% { transform: scale(1.5); opacity: 0.85; } }
        .${id}-arm { animation: ${id}-arm 1.5s ease-in-out infinite; transform-origin: 120px 82px; }
        .${id}-glow { animation: ${id}-glow 1.5s ease-in-out infinite; transform-origin: 118px 80px; }
      `}</style>

      <Ground y={192} />

      <Bone x1={112} y1={150} x2={102} y2={192} w={12} />
      <Bone x1={128} y1={150} x2={138} y2={192} w={12} />
      <line x1="95" y1="192" x2="115" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
      <line x1="133" y1="192" x2="153" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />

      <Torso cx={120} cyTop={72} cyBottom={150} wShoulder={40} wHip={30} id={id} />
      <Head cx={120} cy={60} r={11} id={id + '2'} />
      <MuscleGlow cx={118} cy={80} r={14} className={`${id}-glow`} id={id} />

      <g className={`${id}-arm`}>
        <Bone x1={120} y1={82} x2={165} y2={130} w={9} />
        <Dumbbell cx={168} cy={132} size={7} />
      </g>

      <MotionArrow x={195} y={80} direction="up" size={8} />
    </>
  );
}

function FlyFigure() {
  const id = 'fly';
  return (
    <>
      <style>{`
        @keyframes ${id}-armL { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-70deg); } }
        @keyframes ${id}-armR { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(70deg); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.5); opacity: 0.15; } 50% { transform: scale(1.4); opacity: 0.9; } }
        .${id}-arm-l { animation: ${id}-armL 1.8s ease-in-out infinite; transform-origin: 120px 105px; }
        .${id}-arm-r { animation: ${id}-armR 1.8s ease-in-out infinite; transform-origin: 120px 105px; }
        .${id}-glow { animation: ${id}-glow 1.8s ease-in-out infinite; transform-origin: 120px 100px; }
      `}</style>

      {/* 벤치 */}
      <Bench x={40} y={120} w={140} />

      {/* 다리 */}
      <Bone x1={155} y1={105} x2={195} y2={140} w={10} />
      <Bone x1={195} y1={140} x2={205} y2={180} w={10} />

      {/* 몸통 (누움) */}
      <path
        d={`M 55 100 L 155 100 L 155 112 L 55 112 Z`}
        fill={`url(#${id}-body)`}
        stroke={BODY_DARK}
        strokeWidth={1.5}
      />
      <Head cx={40} cy={100} r={11} id={id} />

      <MuscleGlow cx={110} cy={98} r={26} className={`${id}-glow`} id={id} />

      {/* 팔 */}
      <g className={`${id}-arm-l`}>
        <Bone x1={120} y1={105} x2={80} y2={65} w={9} />
        <Dumbbell cx={78} cy={62} size={7} />
      </g>
      <g className={`${id}-arm-r`}>
        <Bone x1={120} y1={105} x2={160} y2={65} w={9} />
        <Dumbbell cx={162} cy={62} size={7} />
      </g>
    </>
  );
}

function LungeFigure() {
  const id = 'lg';
  return (
    <>
      <style>{`
        @keyframes ${id}-body { 0%,100% { transform: translateY(0); } 50% { transform: translateY(22px); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.2; } 50% { transform: scale(1.3); opacity: 0.85; } }
        .${id}-body { animation: ${id}-body 2s ease-in-out infinite; }
        .${id}-glow { animation: ${id}-glow 2s ease-in-out infinite; transform-origin: 85px 155px; }
      `}</style>

      <Ground y={192} />
      <g className={`${id}-body`}>
        {/* 앞다리 (굽힘) */}
        <Bone x1={100} y1={130} x2={80} y2={165} w={13} />
        <Bone x1={80} y1={165} x2={78} y2={192} w={12} />
        <line x1="65" y1="192" x2="95" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
        <MuscleGlow cx={85} cy={155} r={16} className={`${id}-glow`} id={id} />

        {/* 뒷다리 (뒤로 뻗음) */}
        <Bone x1={100} y1={130} x2={155} y2={165} w={12} />
        <Bone x1={155} y1={165} x2={185} y2={192} w={11} />
        <line x1="170" y1="192" x2="200" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />

        {/* 몸통 */}
        <Torso cx={100} cyTop={70} cyBottom={130} wShoulder={36} wHip={26} id={id} />
        <Head cx={100} cy={58} r={11} id={id + '2'} />

        {/* 어깨 바벨 */}
        <Barbell x1={65} x2={135} y={70} plate={9} id={id} />
      </g>
    </>
  );
}

function LegExtFigure() {
  const id = 'le';
  return (
    <>
      <style>{`
        @keyframes ${id}-shin { 0%,100% { transform: rotate(80deg); } 50% { transform: rotate(0deg); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.2; } 50% { transform: scale(1.5); opacity: 0.9; } }
        .${id}-shin { animation: ${id}-shin 1.4s ease-in-out infinite; transform-origin: 130px 130px; }
        .${id}-glow { animation: ${id}-glow 1.4s ease-in-out infinite; transform-origin: 100px 125px; }
      `}</style>

      {/* 머신 프레임 */}
      <rect x="30" y="130" width="110" height="12" fill="#4A5568" rx={2} stroke={BODY_DARK} strokeWidth={1} />
      <rect x="20" y="70" width="15" height="70" fill="#374151" />
      <rect x="20" y="65" width="30" height="8" fill="#374151" />

      {/* 몸통 (앉음) */}
      <Torso cx={55} cyTop={75} cyBottom={130} wShoulder={34} wHip={30} id={id} />
      <Head cx={55} cy={63} r={11} id={id + '2'} />

      {/* 팔 */}
      <Bone x1={40} y1={85} x2={30} y2={120} w={9} />
      <Bone x1={70} y1={85} x2={80} y2={120} w={9} />

      {/* 허벅지 */}
      <Bone x1={60} y1={130} x2={130} y2={130} w={13} />
      <MuscleGlow cx={100} cy={125} r={18} className={`${id}-glow`} id={id} />

      {/* 정강이 (움직임) */}
      <g className={`${id}-shin`}>
        <Bone x1={130} y1={130} x2={160} y2={130} w={11} />
        <circle cx={162} cy={130} r={6} fill={GEAR_METAL} />
      </g>

      <MotionArrow x={195} y={100} direction="up" size={8} />
    </>
  );
}

function LegCurlFigure() {
  const id = 'lc';
  return (
    <>
      <style>{`
        @keyframes ${id}-shin { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-95deg); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.2; } 50% { transform: scale(1.5); opacity: 0.9; } }
        .${id}-shin { animation: ${id}-shin 1.4s ease-in-out infinite; transform-origin: 130px 105px; }
        .${id}-glow { animation: ${id}-glow 1.4s ease-in-out infinite; transform-origin: 100px 95px; }
      `}</style>

      {/* 벤치 */}
      <rect x="20" y="100" width="140" height="12" fill="#4A5568" rx={2} stroke={BODY_DARK} strokeWidth={1} />

      {/* 머리 · 몸통 (엎드림) */}
      <Head cx={30} cy={95} r={11} id={id} />
      <rect x="42" y="88" width="80" height="12" fill={`url(#${id}-body)`} stroke={BODY_DARK} strokeWidth={1.5} rx={3} />

      {/* 허벅지 */}
      <Bone x1={120} y1={95} x2={135} y2={100} w={13} />
      <MuscleGlow cx={110} cy={95} r={16} className={`${id}-glow`} id={id} />

      {/* 정강이 (움직임) */}
      <g className={`${id}-shin`}>
        <Bone x1={130} y1={105} x2={185} y2={105} w={11} />
        <circle cx={190} cy={105} r={6} fill={GEAR_METAL} />
      </g>

      <MotionArrow x={200} y={70} direction="up" size={8} />
    </>
  );
}

function CalfRaiseFigure() {
  const id = 'cr';
  return (
    <>
      <style>{`
        @keyframes ${id}-body { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-18px); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.2; } 50% { transform: scale(1.5); opacity: 0.9; } }
        .${id}-body { animation: ${id}-body 1.2s ease-in-out infinite; }
        .${id}-glow-l { animation: ${id}-glow 1.2s ease-in-out infinite; transform-origin: 110px 170px; }
        .${id}-glow-r { animation: ${id}-glow 1.2s ease-in-out infinite; transform-origin: 130px 170px; }
      `}</style>

      <Ground y={192} />
      {/* 발판 */}
      <rect x="90" y="187" width="60" height="8" fill="#4A5568" rx={2} />

      <g className={`${id}-body`}>
        <Head cx={120} cy={45} r={11} id={id + '2'} />
        <Torso cx={120} cyTop={55} cyBottom={130} wShoulder={40} wHip={30} id={id} />

        {/* 다리 */}
        <Bone x1={112} y1={130} x2={110} y2={180} w={11} />
        <Bone x1={128} y1={130} x2={130} y2={180} w={11} />
        <MuscleGlow cx={110} cy={170} r={12} className={`${id}-glow-l`} id={id} />
        <MuscleGlow cx={130} cy={170} r={12} className={`${id}-glow-r`} id={id} />

        {/* 발 (뒤꿈치 든 상태) */}
        <line x1="108" y1="187" x2="128" y2="187" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />

        {/* 어깨 바벨 */}
        <Barbell x1={80} x2={160} y={60} plate={9} id={id} />
      </g>

      <MotionArrow x={175} y={140} direction="up" size={8} />
    </>
  );
}

function CrunchFigure() {
  const id = 'cn';
  return (
    <>
      <style>{`
        @keyframes ${id}-body { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(45deg); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.2; } 50% { transform: scale(1.5); opacity: 0.9; } }
        .${id}-body { animation: ${id}-body 1.4s ease-in-out infinite; transform-origin: 130px 155px; }
        .${id}-glow { animation: ${id}-glow 1.4s ease-in-out infinite; transform-origin: 110px 145px; }
      `}</style>

      <Ground y={185} />

      {/* 다리 (무릎 굽힘) */}
      <Bone x1={130} y1={155} x2={170} y2={135} w={13} />
      <Bone x1={170} y1={135} x2={195} y2={185} w={12} />
      <line x1="180" y1="185" x2="210" y2="185" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />

      {/* 상체 (움직임) */}
      <g className={`${id}-body`}>
        <MuscleGlow cx={110} cy={145} r={20} className={`${id}-glow`} id={id} />
        <path
          d={`M 130 155 L 130 145 L 60 145 L 60 155 Z`}
          fill={`url(#${id}-body)`}
          stroke={BODY_DARK}
          strokeWidth={1.5}
        />
        <Head cx={50} cy={145} r={11} id={id} />
        {/* 팔 (머리 뒤) */}
        <Bone x1={55} y1={140} x2={40} y2={130} w={8} />
      </g>
    </>
  );
}

function PlankFigure() {
  const id = 'pl';
  return (
    <>
      <style>{`
        @keyframes ${id}-shake { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.9); opacity: 0.4; } 50% { transform: scale(1.2); opacity: 0.9; } }
        .${id}-body { animation: ${id}-shake 2s ease-in-out infinite; }
        .${id}-glow { animation: ${id}-glow 2s ease-in-out infinite; transform-origin: 130px 145px; }
      `}</style>

      <Ground y={185} />

      <g className={`${id}-body`}>
        {/* 몸통 (수평 판자) */}
        <rect x="60" y="140" width="140" height="12" fill={`url(#${id}-body)`} stroke={BODY_DARK} strokeWidth={1.5} rx={3} />
        <MuscleGlow cx={130} cy={145} r={24} className={`${id}-glow`} id={id} />

        {/* 머리 */}
        <Head cx={210} cy={140} r={11} id={id} />

        {/* 팔 (팔꿈치 지지) */}
        <Bone x1={80} y1={145} x2={80} y2={178} w={9} />
        <line x1="70" y1="183" x2="95" y2="183" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />

        {/* 다리 */}
        <Bone x1={175} y1={145} x2={175} y2={178} w={11} />
        <line x1="163" y1="183" x2="188" y2="183" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
      </g>
    </>
  );
}

function RunningFigure() {
  const id = 'run';
  return (
    <>
      <style>{`
        @keyframes ${id}-legL { 0%,100% { transform: rotate(-30deg); } 50% { transform: rotate(40deg); } }
        @keyframes ${id}-legR { 0%,100% { transform: rotate(40deg); } 50% { transform: rotate(-30deg); } }
        @keyframes ${id}-armL { 0%,100% { transform: rotate(40deg); } 50% { transform: rotate(-30deg); } }
        @keyframes ${id}-armR { 0%,100% { transform: rotate(-30deg); } 50% { transform: rotate(40deg); } }
        @keyframes ${id}-body { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .${id}-body { animation: ${id}-body 0.55s ease-in-out infinite; }
        .${id}-leg-l { animation: ${id}-legL 0.55s ease-in-out infinite; transform-origin: 120px 138px; }
        .${id}-leg-r { animation: ${id}-legR 0.55s ease-in-out infinite; transform-origin: 120px 138px; }
        .${id}-arm-l { animation: ${id}-armL 0.55s ease-in-out infinite; transform-origin: 120px 90px; }
        .${id}-arm-r { animation: ${id}-armR 0.55s ease-in-out infinite; transform-origin: 120px 90px; }
      `}</style>

      <Ground y={188} />

      <g className={`${id}-body`}>
        <Head cx={120} cy={70} r={11} id={id + '2'} />
        <Torso cx={120} cyTop={80} cyBottom={138} wShoulder={32} wHip={26} id={id} />
        <g className={`${id}-arm-l`}>
          <Bone x1={120} y1={90} x2={115} y2={125} w={8} color="#334155" />
          <Bone x1={115} y1={125} x2={130} y2={140} w={7} color="#334155" />
        </g>
        <g className={`${id}-arm-r`}>
          <Bone x1={120} y1={90} x2={125} y2={125} w={8} />
          <Bone x1={125} y1={125} x2={110} y2={140} w={7} />
        </g>
        <g className={`${id}-leg-l`}>
          <Bone x1={120} y1={138} x2={110} y2={175} w={10} color="#334155" />
          <Bone x1={110} y1={175} x2={100} y2={185} w={9} color="#334155" />
        </g>
        <g className={`${id}-leg-r`}>
          <Bone x1={120} y1={138} x2={130} y2={175} w={10} />
          <Bone x1={130} y1={175} x2={140} y2={185} w={9} />
        </g>
      </g>
    </>
  );
}

function PushupFigure() {
  const id = 'push';
  return (
    <>
      <style>{`
        @keyframes ${id}-body { 0%,100% { transform: translateY(0); } 50% { transform: translateY(18px); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.2; } 50% { transform: scale(1.4); opacity: 0.85; } }
        .${id}-body { animation: ${id}-body 1.6s ease-in-out infinite; }
        .${id}-glow { animation: ${id}-glow 1.6s ease-in-out infinite; transform-origin: 140px 130px; }
      `}</style>

      <Ground y={185} />

      <g className={`${id}-body`}>
        <Head cx={210} cy={130} r={11} id={id + '2'} />
        <rect x="60" y="128" width="150" height="14" fill={`url(#${id}-body)`} stroke={BODY_DARK} strokeWidth={1.5} rx={3} />
        <MuscleGlow cx={140} cy={128} r={24} className={`${id}-glow`} id={id} />

        {/* 팔 */}
        <Bone x1={80} y1={135} x2={80} y2={178} w={10} />
        <line x1="72" y1="183" x2="92" y2="183" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />

        {/* 다리 */}
        <Bone x1={190} y1={135} x2={190} y2={178} w={11} />
        <line x1="175" y1="183" x2="205" y2="183" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
      </g>
    </>
  );
}

function DipsFigure() {
  const id = 'dips';
  return (
    <>
      <style>{`
        @keyframes ${id}-body { 0%,100% { transform: translateY(0); } 50% { transform: translateY(28px); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.6); opacity: 0.2; } 50% { transform: scale(1.5); opacity: 0.9; } }
        .${id}-body { animation: ${id}-body 1.6s ease-in-out infinite; }
        .${id}-glow { animation: ${id}-glow 1.6s ease-in-out infinite; transform-origin: 120px 100px; }
      `}</style>

      {/* 딥스 바 */}
      <line x1="55" y1="70" x2="55" y2="192" stroke={GEAR_DARK} strokeWidth={4} />
      <line x1="185" y1="70" x2="185" y2="192" stroke={GEAR_DARK} strokeWidth={4} />
      <line x1="45" y1="70" x2="75" y2="70" stroke={GEAR_METAL} strokeWidth={5} strokeLinecap="round" />
      <line x1="165" y1="70" x2="195" y2="70" stroke={GEAR_METAL} strokeWidth={5} strokeLinecap="round" />

      {/* 몸 (움직임) */}
      <g className={`${id}-body`}>
        {/* 팔 */}
        <Bone x1={65} y1={70} x2={90} y2={115} w={9} />
        <Bone x1={175} y1={70} x2={150} y2={115} w={9} />
        {/* 몸통 */}
        <Torso cx={120} cyTop={95} cyBottom={148} wShoulder={40} wHip={30} id={id} />
        <Head cx={120} cy={85} r={11} id={id + '2'} />
        <MuscleGlow cx={120} cy={100} r={22} className={`${id}-glow`} id={id} />
        {/* 무릎 접힘 */}
        <Bone x1={115} y1={148} x2={140} y2={175} w={11} />
        <Bone x1={140} y1={175} x2={135} y2={195} w={10} />
      </g>
    </>
  );
}

function GenericFigure() {
  const id = 'gn';
  return (
    <>
      <style>{`
        @keyframes ${id}-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes ${id}-glow { 0%,100% { transform: scale(0.7); opacity: 0.3; } 50% { transform: scale(1.4); opacity: 0.85; } }
        .${id}-body { animation: ${id}-pulse 1.6s ease-in-out infinite; transform-origin: 120px 130px; }
        .${id}-glow { animation: ${id}-glow 1.6s ease-in-out infinite; transform-origin: 120px 120px; }
      `}</style>

      <Ground y={192} />

      <g className={`${id}-body`}>
        <Head cx={120} cy={55} r={12} id={id + '2'} />
        <Torso cx={120} cyTop={68} cyBottom={135} wShoulder={40} wHip={28} id={id} />
        <MuscleGlow cx={120} cy={100} r={22} className={`${id}-glow`} id={id} />
        {/* 팔 */}
        <Bone x1={104} y1={75} x2={80} y2={125} w={9} />
        <Bone x1={136} y1={75} x2={160} y2={125} w={9} />
        {/* 다리 */}
        <Bone x1={112} y1={135} x2={100} y2={188} w={11} />
        <Bone x1={128} y1={135} x2={140} y2={188} w={11} />
        <line x1="90" y1="192" x2="115" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
        <line x1="130" y1="192" x2="155" y2="192" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
      </g>
    </>
  );
}
