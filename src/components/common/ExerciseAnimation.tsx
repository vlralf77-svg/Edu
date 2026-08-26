import { Box } from '@mui/material';

// 스틱피겨 동작 패턴 코드
export type MovementArchetype =
  | 'BENCH_PRESS' // 벤치프레스 (수평 밀기)
  | 'INCLINE_PRESS' // 인클라인 프레스
  | 'OVERHEAD_PRESS' // 오버헤드 프레스 (수직 밀기)
  | 'SQUAT' // 스쿼트
  | 'DEADLIFT' // 데드리프트 (힙 힌지)
  | 'HIP_THRUST' // 힙 쓰러스트
  | 'ROW' // 로우 (수평 당기기)
  | 'PULLUP' // 풀업 · 랫풀다운 (수직 당기기)
  | 'BICEPS_CURL' // 이두 컬
  | 'TRICEPS_PUSHDOWN' // 삼두 푸시다운
  | 'LATERAL_RAISE' // 사이드 레터럴 레이즈
  | 'FRONT_RAISE' // 프론트 레이즈
  | 'FLY' // 플라이
  | 'LUNGE' // 런지
  | 'LEG_EXT' // 레그 익스텐션
  | 'LEG_CURL' // 레그 컬
  | 'CALF_RAISE' // 카프 레이즈
  | 'CRUNCH' // 크런치
  | 'PLANK' // 플랭크
  | 'RUNNING' // 러닝·유산소
  | 'PUSHUP' // 푸시업
  | 'DIPS' // 딥스
  | 'GENERIC'; // 매핑 안 된 경우 폴백

// 종목 ID → 동작 패턴 매핑.
// 접두어 검색으로 대부분 커버, 개별 예외는 아래에서 처리.
const ID_MAP: Array<[RegExp, MovementArchetype]> = [
  // 인클라인/디클라인 벤치는 인클라인 프레스
  [/^ex-bench-incline|^ex-chest-press-incline|^ex-bench-incline-db|^ex-bench-incline-smith/, 'INCLINE_PRESS'],
  // 벤치프레스 계열 (수평)
  [/^ex-bench|^ex-chest-press|^ex-db-fly|^ex-cable-cross|^ex-cable-fly|^ex-pec-deck|^ex-chest-fly|^ex-db-pullover/, 'BENCH_PRESS'],
  // 플라이 (덤벨/케이블/머신 fly)
  [/^ex-db-fly|^ex-cable-fly|^ex-cable-cross|^ex-pec-deck|^ex-chest-fly/, 'FLY'],
  // 딥스
  [/^ex-dips|^ex-tri-dips-bench/, 'DIPS'],
  // 푸시업
  [/^ex-pushup/, 'PUSHUP'],
  // 오버헤드 프레스
  [/^ex-ohp|^ex-push-press|^ex-shoulder-press|^ex-db-shoulder-press|^ex-barbell-shoulder-press|^ex-kb-shoulder-press/, 'OVERHEAD_PRESS'],
  // 사이드 레터럴 레이즈
  [/^ex-side-lat-raise|^ex-db-side-raise|^ex-cable-side-raise|^ex-bentover-cable-side-raise|^ex-bentover-db-side-raise|^ex-upright-row/, 'LATERAL_RAISE'],
  // 프론트 레이즈
  [/^ex-db-front-raise|^ex-barbell-front-raise|^ex-ezbar-front-raise|^ex-cable-front-raise/, 'FRONT_RAISE'],
  // 리어델트 플라이 → 플라이 애니메이션 (뒤로 벌리는 모션)
  [/^ex-rear-delt-fly|^ex-cable-reverse-fly|^ex-rear-lat-raise|^ex-face-pull/, 'FLY'],
  // 슈러그도 오버헤드 프레스 (수직 움직임)
  [/^ex-shrug/, 'OVERHEAD_PRESS'],
  // 스쿼트 계열
  [/^ex-squat|^ex-front-squat|^ex-goblet-squat|^ex-air-squat|^ex-jump-squat|^ex-sumo-squat|^ex-box-squat|^ex-fixed-box-squat|^ex-smith-squat|^ex-hack-squat|^ex-v-squat|^ex-reverse-v-squat|^ex-db-squat/, 'SQUAT'],
  // 스플릿·불가리안·런지
  [/^ex-lunge|^ex-split-squat|^ex-bulgarian-split/, 'LUNGE'],
  // 데드리프트 · RDL · 스티프
  [/^ex-deadlift|^ex-rdl|^ex-rack-pull|^ex-back-extension|^ex-hyper|^ex-cable-pull-through/, 'DEADLIFT'],
  // 힙 쓰러스트
  [/^ex-hip-thrust/, 'HIP_THRUST'],
  // 힙 어덕션/어브덕션도 힙 쓰러스트 유사 자세
  [/^ex-hip-abduction|^ex-hip-adduction/, 'HIP_THRUST'],
  // 레그 프레스도 스쿼트 패턴 (다리 굽혔다 폄)
  [/^ex-leg-press/, 'SQUAT'],
  // 레그 익스텐션 (앉아서 다리 뻗기)
  [/^ex-leg-ext/, 'LEG_EXT'],
  // 레그 컬 (엎드려 다리 접기)
  [/^ex-leg-curl/, 'LEG_CURL'],
  // 카프 레이즈
  [/^ex-calf/, 'CALF_RAISE'],
  // 로우 계열
  [/^ex-barbell-row|^ex-pendlay-row|^ex-db-row|^ex-t-bar-row|^ex-seated-row|^ex-smith-row|^ex-mid-row|^ex-high-row|^ex-low-row|^ex-chest-supported-tbar-row|^ex-inverted-row/, 'ROW'],
  // 풀업 · 랫풀다운
  [/^ex-pullup|^ex-chinup|^ex-lat-pulldown|^ex-cable-arm-pulldown/, 'PULLUP'],
  // 이두 컬
  [/^ex-barbell-curl|^ex-ezbar-curl|^ex-db-curl|^ex-hammer-curl|^ex-preacher-curl|^ex-cable-curl|^ex-concentration-curl|^ex-spider-curl|^ex-wrist-curl|^ex-reverse-wrist-curl/, 'BICEPS_CURL'],
  // 삼두 계열
  [/^ex-close-grip-bench|^ex-tri-pushdown|^ex-overhead-ext|^ex-skull-crusher|^ex-tri-kickback/, 'TRICEPS_PUSHDOWN'],
  // 코어
  [/^ex-plank|^ex-side-plank/, 'PLANK'],
  [/^ex-crunch|^ex-russian-twist|^ex-cable-woodchop|^ex-ab-wheel/, 'CRUNCH'],
  [/^ex-leg-raise|^ex-hanging-leg-raise|^ex-hanging-knee-raise|^ex-mountain-climber/, 'CRUNCH'],
  // 유산소
  [/^ex-running|^ex-cycling|^ex-rowing|^ex-jump-rope|^ex-elliptical|^ex-stair|^ex-treadmill/, 'RUNNING'],
  // 전신
  [/^ex-burpee/, 'PUSHUP'],
  [/^ex-clean-jerk|^ex-snatch|^ex-thruster|^ex-turkish-getup|^ex-kb-swing/, 'DEADLIFT'],
];

export function idToArchetype(exerciseId: string): MovementArchetype {
  for (const [re, arch] of ID_MAP) {
    if (re.test(exerciseId)) return arch;
  }
  return 'GENERIC';
}

// 아이덤별 자세한 설명 (원리 + 핵심 큐)
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

// SVG 스틱피겨 애니메이션 컴포넌트.
// keyframes 는 인라인 <style> 로 정의해 동적 컴포넌트별로 안전하게 분리.
export default function ExerciseAnimation({
  archetype,
}: {
  archetype: MovementArchetype;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        py: 1,
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 2,
      }}
    >
      <svg viewBox="0 0 240 200" width={240} height={200}>
        {renderArchetype(archetype)}
      </svg>
    </Box>
  );
}

// 각 archetype 별 스틱피겨 keyframes 정의.
// 대칭 팔/다리는 transform-origin 을 관절에 두고 회전.

function renderArchetype(a: MovementArchetype): JSX.Element {
  switch (a) {
    case 'BENCH_PRESS':
      return <BenchPressFigure />;
    case 'INCLINE_PRESS':
      return <InclinePressFigure />;
    case 'OVERHEAD_PRESS':
      return <OverheadPressFigure />;
    case 'SQUAT':
      return <SquatFigure />;
    case 'DEADLIFT':
      return <DeadliftFigure />;
    case 'HIP_THRUST':
      return <HipThrustFigure />;
    case 'ROW':
      return <RowFigure />;
    case 'PULLUP':
      return <PullupFigure />;
    case 'BICEPS_CURL':
      return <BicepsCurlFigure />;
    case 'TRICEPS_PUSHDOWN':
      return <TricepsPushdownFigure />;
    case 'LATERAL_RAISE':
      return <LateralRaiseFigure />;
    case 'FRONT_RAISE':
      return <FrontRaiseFigure />;
    case 'FLY':
      return <FlyFigure />;
    case 'LUNGE':
      return <LungeFigure />;
    case 'LEG_EXT':
      return <LegExtFigure />;
    case 'LEG_CURL':
      return <LegCurlFigure />;
    case 'CALF_RAISE':
      return <CalfRaiseFigure />;
    case 'CRUNCH':
      return <CrunchFigure />;
    case 'PLANK':
      return <PlankFigure />;
    case 'RUNNING':
      return <RunningFigure />;
    case 'PUSHUP':
      return <PushupFigure />;
    case 'DIPS':
      return <DipsFigure />;
    default:
      return <GenericFigure />;
  }
}

// 공통 스타일
const STROKE = '#FF6B35';
const BODY = '#F1F5F9';
const GEAR = '#94A3B8';
const style = { stroke: BODY, strokeWidth: 3, fill: 'none', strokeLinecap: 'round' as const };
const gearStyle = { stroke: GEAR, strokeWidth: 2, fill: GEAR };
const barStyle = { stroke: GEAR, strokeWidth: 4, fill: 'none', strokeLinecap: 'round' as const };

// ==================== 개별 스틱피겨 ====================

function BenchPressFigure() {
  return (
    <>
      <style>{`
        @keyframes bpArm { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(45deg); } }
        @keyframes bpFore { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-40deg); } }
        @keyframes bpBar { 0%,100% { transform: translateY(0); } 50% { transform: translateY(30px); } }
        .bp-arm { animation: bpArm 1.6s ease-in-out infinite; transform-origin: 130px 90px; }
        .bp-fore { animation: bpFore 1.6s ease-in-out infinite; transform-origin: 160px 60px; }
        .bp-bar { animation: bpBar 1.6s ease-in-out infinite; }
      `}</style>
      {/* 벤치 */}
      <rect x="40" y="110" width="140" height="6" fill={GEAR} rx="2" />
      <line x1="60" y1="116" x2="60" y2="150" {...barStyle} />
      <line x1="160" y1="116" x2="160" y2="150" {...barStyle} />
      {/* 몸통 (누운 자세) */}
      <line x1="70" y1="108" x2="150" y2="108" {...style} />
      <circle cx="60" cy="105" r="8" fill={BODY} />
      {/* 다리 */}
      <line x1="150" y1="108" x2="180" y2="140" {...style} />
      <line x1="180" y1="140" x2="180" y2="170" {...style} />
      {/* 팔 (움직임) */}
      <g className="bp-arm">
        <line x1="130" y1="108" x2="160" y2="80" {...style} />
        <g className="bp-fore">
          <line x1="160" y1="80" x2="160" y2="55" {...style} />
        </g>
      </g>
      {/* 바벨 */}
      <g className="bp-bar">
        <line x1="120" y1="55" x2="200" y2="55" {...barStyle} strokeWidth={5} />
        <circle cx="120" cy="55" r="9" {...gearStyle} />
        <circle cx="200" cy="55" r="9" {...gearStyle} />
      </g>
    </>
  );
}

function InclinePressFigure() {
  return (
    <>
      <style>{`
        @keyframes ipArm { 0%,100% { transform: rotate(-10deg); } 50% { transform: rotate(35deg); } }
        .ip-arm { animation: ipArm 1.6s ease-in-out infinite; transform-origin: 120px 100px; }
      `}</style>
      {/* 인클라인 벤치 */}
      <polygon points="40,170 180,90 190,100 50,180" fill={GEAR} />
      {/* 몸통 */}
      <line x1="60" y1="160" x2="150" y2="95" {...style} />
      <circle cx="155" cy="90" r="8" fill={BODY} />
      {/* 다리 */}
      <line x1="60" y1="160" x2="45" y2="185" {...style} />
      {/* 팔 */}
      <g className="ip-arm">
        <line x1="120" y1="100" x2="150" y2="55" {...style} />
        <line x1="150" y1="55" x2="180" y2="55" {...barStyle} strokeWidth={5} />
        <circle cx="150" cy="55" r="7" {...gearStyle} />
        <circle cx="180" cy="55" r="7" {...gearStyle} />
      </g>
    </>
  );
}

function OverheadPressFigure() {
  return (
    <>
      <style>{`
        @keyframes ohpArm { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-140deg); } }
        @keyframes ohpBar { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-40px); } }
        .ohp-arm { animation: ohpArm 1.6s ease-in-out infinite; transform-origin: 120px 90px; }
        .ohp-bar { animation: ohpBar 1.6s ease-in-out infinite; }
      `}</style>
      {/* 다리 */}
      <line x1="120" y1="150" x2="100" y2="190" {...style} />
      <line x1="120" y1="150" x2="140" y2="190" {...style} />
      {/* 몸통 */}
      <line x1="120" y1="90" x2="120" y2="150" {...style} />
      {/* 머리 */}
      <circle cx="120" cy="80" r="10" fill={BODY} />
      {/* 팔 */}
      <g className="ohp-arm">
        <line x1="120" y1="90" x2="80" y2="110" {...style} />
        <line x1="120" y1="90" x2="160" y2="110" {...style} />
      </g>
      {/* 바 */}
      <g className="ohp-bar">
        <line x1="80" y1="110" x2="160" y2="110" {...barStyle} strokeWidth={5} />
        <circle cx="80" cy="110" r="8" {...gearStyle} />
        <circle cx="160" cy="110" r="8" {...gearStyle} />
      </g>
    </>
  );
}

function SquatFigure() {
  return (
    <>
      <style>{`
        @keyframes sqHip { 0%,100% { transform: translateY(0); } 50% { transform: translateY(30px); } }
        @keyframes sqThigh { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(35deg); } }
        @keyframes sqShin { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-35deg); } }
        .sq-body { animation: sqHip 1.8s ease-in-out infinite; }
        .sq-thigh-l { animation: sqThigh 1.8s ease-in-out infinite; transform-origin: 105px 130px; }
        .sq-thigh-r { animation: sqThigh 1.8s ease-in-out infinite; transform-origin: 135px 130px; }
        .sq-shin-l { animation: sqShin 1.8s ease-in-out infinite; transform-origin: 105px 160px; }
        .sq-shin-r { animation: sqShin 1.8s ease-in-out infinite; transform-origin: 135px 160px; }
      `}</style>
      {/* 발 (고정) */}
      <line x1="95" y1="185" x2="115" y2="185" {...style} strokeWidth={4} />
      <line x1="125" y1="185" x2="145" y2="185" {...style} strokeWidth={4} />
      {/* 정강이 */}
      <g className="sq-shin-l">
        <line x1="105" y1="160" x2="105" y2="185" {...style} />
      </g>
      <g className="sq-shin-r">
        <line x1="135" y1="160" x2="135" y2="185" {...style} />
      </g>
      {/* 몸통·허벅지 (같이 움직임) */}
      <g className="sq-body">
        <g className="sq-thigh-l">
          <line x1="105" y1="130" x2="105" y2="160" {...style} />
        </g>
        <g className="sq-thigh-r">
          <line x1="135" y1="130" x2="135" y2="160" {...style} />
        </g>
        <line x1="105" y1="130" x2="135" y2="130" {...style} />
        <line x1="120" y1="130" x2="120" y2="90" {...style} />
        <circle cx="120" cy="80" r="10" fill={BODY} />
        {/* 어깨 바벨 */}
        <line x1="90" y1="90" x2="150" y2="90" {...barStyle} strokeWidth={5} />
        <circle cx="90" cy="90" r="7" {...gearStyle} />
        <circle cx="150" cy="90" r="7" {...gearStyle} />
      </g>
    </>
  );
}

function DeadliftFigure() {
  return (
    <>
      <style>{`
        @keyframes dlBody { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-45deg); } }
        @keyframes dlBar { 0%,100% { transform: translateY(0); } 50% { transform: translateY(40px); } }
        .dl-body { animation: dlBody 1.8s ease-in-out infinite; transform-origin: 120px 155px; }
        .dl-bar { animation: dlBar 1.8s ease-in-out infinite; }
      `}</style>
      {/* 다리 */}
      <line x1="120" y1="155" x2="105" y2="185" {...style} />
      <line x1="120" y1="155" x2="135" y2="185" {...style} />
      {/* 몸통 */}
      <g className="dl-body">
        <line x1="120" y1="155" x2="120" y2="95" {...style} />
        <circle cx="120" cy="85" r="10" fill={BODY} />
        {/* 팔 (아래로) */}
        <line x1="120" y1="105" x2="120" y2="150" {...style} strokeDasharray="0" />
      </g>
      {/* 바 (움직임) */}
      <g className="dl-bar">
        <line x1="80" y1="150" x2="160" y2="150" {...barStyle} strokeWidth={5} />
        <circle cx="80" cy="150" r="9" {...gearStyle} />
        <circle cx="160" cy="150" r="9" {...gearStyle} />
      </g>
    </>
  );
}

function HipThrustFigure() {
  return (
    <>
      <style>{`
        @keyframes htHip { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-25px); } }
        .ht-body { animation: htHip 1.6s ease-in-out infinite; }
      `}</style>
      {/* 벤치 */}
      <rect x="140" y="110" width="80" height="8" fill={GEAR} rx="2" />
      {/* 발 */}
      <line x1="30" y1="180" x2="50" y2="180" {...style} strokeWidth={4} />
      {/* 정강이 */}
      <line x1="40" y1="180" x2="80" y2="150" {...style} />
      {/* 몸통 (움직임) */}
      <g className="ht-body">
        <line x1="80" y1="150" x2="150" y2="130" {...style} />
        <line x1="150" y1="130" x2="180" y2="115" {...style} />
        <circle cx="185" cy="110" r="10" fill={BODY} />
        {/* 어깨 바벨 */}
        <line x1="95" y1="145" x2="130" y2="135" {...barStyle} strokeWidth={5} />
        <circle cx="95" cy="145" r="7" {...gearStyle} />
        <circle cx="130" cy="135" r="7" {...gearStyle} />
      </g>
    </>
  );
}

function RowFigure() {
  return (
    <>
      <style>{`
        @keyframes rowFore { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(90deg); } }
        @keyframes rowBar { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-40px); } }
        .row-arm { animation: rowFore 1.4s ease-in-out infinite; transform-origin: 130px 110px; }
        .row-bar { animation: rowBar 1.4s ease-in-out infinite; }
      `}</style>
      {/* 다리 */}
      <line x1="110" y1="145" x2="90" y2="185" {...style} />
      <line x1="110" y1="145" x2="130" y2="185" {...style} />
      {/* 몸통 (구부린) */}
      <line x1="110" y1="145" x2="150" y2="110" {...style} />
      <circle cx="160" cy="103" r="10" fill={BODY} />
      {/* 팔 */}
      <g className="row-arm">
        <line x1="130" y1="110" x2="150" y2="150" {...style} />
      </g>
      {/* 바 */}
      <g className="row-bar">
        <line x1="115" y1="155" x2="185" y2="155" {...barStyle} strokeWidth={5} />
        <circle cx="115" cy="155" r="8" {...gearStyle} />
        <circle cx="185" cy="155" r="8" {...gearStyle} />
      </g>
    </>
  );
}

function PullupFigure() {
  return (
    <>
      <style>{`
        @keyframes puBody { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-25px); } }
        .pu-body { animation: puBody 1.8s ease-in-out infinite; }
      `}</style>
      {/* 봉 */}
      <line x1="60" y1="30" x2="180" y2="30" {...barStyle} strokeWidth={5} />
      {/* 몸통 (움직임) */}
      <g className="pu-body">
        {/* 팔 */}
        <line x1="100" y1="30" x2="110" y2="80" {...style} />
        <line x1="140" y1="30" x2="130" y2="80" {...style} />
        {/* 몸통 */}
        <line x1="120" y1="80" x2="120" y2="140" {...style} />
        <circle cx="120" cy="70" r="10" fill={BODY} />
        {/* 다리 */}
        <line x1="120" y1="140" x2="105" y2="175" {...style} />
        <line x1="120" y1="140" x2="135" y2="175" {...style} />
      </g>
    </>
  );
}

function BicepsCurlFigure() {
  return (
    <>
      <style>{`
        @keyframes bcFore { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-140deg); } }
        .bc-fore { animation: bcFore 1.4s ease-in-out infinite; transform-origin: 120px 100px; }
      `}</style>
      {/* 다리 */}
      <line x1="120" y1="150" x2="105" y2="190" {...style} />
      <line x1="120" y1="150" x2="135" y2="190" {...style} />
      {/* 몸통 */}
      <line x1="120" y1="70" x2="120" y2="150" {...style} />
      <circle cx="120" cy="60" r="10" fill={BODY} />
      {/* 상완 */}
      <line x1="120" y1="80" x2="120" y2="120" {...style} />
      {/* 전완 (움직임) */}
      <g className="bc-fore">
        <line x1="120" y1="100" x2="140" y2="140" {...style} />
        <circle cx="140" cy="140" r="10" {...gearStyle} />
      </g>
    </>
  );
}

function TricepsPushdownFigure() {
  return (
    <>
      <style>{`
        @keyframes tpFore { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(70deg); } }
        .tp-fore { animation: tpFore 1.2s ease-in-out infinite; transform-origin: 130px 100px; }
      `}</style>
      {/* 케이블 위 도르래 */}
      <line x1="180" y1="20" x2="180" y2="80" stroke={GEAR} strokeWidth="1" />
      <circle cx="180" cy="30" r="6" stroke={GEAR} strokeWidth={2} fill="none" />
      {/* 다리 */}
      <line x1="120" y1="150" x2="105" y2="190" {...style} />
      <line x1="120" y1="150" x2="135" y2="190" {...style} />
      {/* 몸통 */}
      <line x1="120" y1="70" x2="120" y2="150" {...style} />
      <circle cx="120" cy="60" r="10" fill={BODY} />
      {/* 상완 (팔꿈치 고정) */}
      <line x1="120" y1="80" x2="130" y2="100" {...style} />
      {/* 전완 (움직임) */}
      <g className="tp-fore">
        <line x1="130" y1="100" x2="150" y2="140" {...style} />
      </g>
    </>
  );
}

function LateralRaiseFigure() {
  return (
    <>
      <style>{`
        @keyframes lrArm { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-85deg); } }
        .lr-arm-l { animation: lrArm 1.4s ease-in-out infinite; transform-origin: 120px 85px; }
        .lr-arm-r { animation: lrArm 1.4s ease-in-out infinite; transform-origin: 120px 85px; }
      `}</style>
      {/* 다리·몸통 */}
      <line x1="120" y1="150" x2="105" y2="190" {...style} />
      <line x1="120" y1="150" x2="135" y2="190" {...style} />
      <line x1="120" y1="75" x2="120" y2="150" {...style} />
      <circle cx="120" cy="65" r="10" fill={BODY} />
      {/* 팔 (좌우 대칭) */}
      <g className="lr-arm-l" style={{ transform: 'scaleX(-1) rotate(0)', transformOrigin: '120px 85px' }}>
        <line x1="120" y1="85" x2="120" y2="140" {...style} />
        <circle cx="120" cy="140" r="8" {...gearStyle} />
      </g>
      <g className="lr-arm-r">
        <line x1="120" y1="85" x2="120" y2="140" {...style} />
        <circle cx="120" cy="140" r="8" {...gearStyle} />
      </g>
    </>
  );
}

function FrontRaiseFigure() {
  return (
    <>
      <style>{`
        @keyframes frArm { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-90deg); } }
        .fr-arm { animation: frArm 1.4s ease-in-out infinite; transform-origin: 120px 85px; }
      `}</style>
      {/* 다리·몸통 */}
      <line x1="120" y1="150" x2="105" y2="190" {...style} />
      <line x1="120" y1="150" x2="135" y2="190" {...style} />
      <line x1="120" y1="75" x2="120" y2="150" {...style} />
      <circle cx="120" cy="65" r="10" fill={BODY} />
      {/* 팔 */}
      <g className="fr-arm">
        <line x1="120" y1="85" x2="160" y2="130" {...style} />
        <circle cx="160" cy="130" r="8" {...gearStyle} />
      </g>
    </>
  );
}

function FlyFigure() {
  return (
    <>
      <style>{`
        @keyframes flyArmL { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-60deg); } }
        @keyframes flyArmR { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(60deg); } }
        .fly-arm-l { animation: flyArmL 1.6s ease-in-out infinite; transform-origin: 120px 100px; }
        .fly-arm-r { animation: flyArmR 1.6s ease-in-out infinite; transform-origin: 120px 100px; }
      `}</style>
      {/* 몸통 (누운 자세) */}
      <rect x="60" y="115" width="140" height="6" fill={GEAR} rx="2" />
      <line x1="80" y1="108" x2="150" y2="108" {...style} />
      <circle cx="70" cy="105" r="8" fill={BODY} />
      <line x1="150" y1="108" x2="180" y2="140" {...style} />
      {/* 팔 */}
      <g className="fly-arm-l">
        <line x1="120" y1="100" x2="80" y2="70" {...style} />
        <circle cx="80" cy="70" r="8" {...gearStyle} />
      </g>
      <g className="fly-arm-r">
        <line x1="120" y1="100" x2="160" y2="70" {...style} />
        <circle cx="160" cy="70" r="8" {...gearStyle} />
      </g>
    </>
  );
}

function LungeFigure() {
  return (
    <>
      <style>{`
        @keyframes lgBody { 0%,100% { transform: translateY(0); } 50% { transform: translateY(20px); } }
        .lg-body { animation: lgBody 1.8s ease-in-out infinite; }
      `}</style>
      <g className="lg-body">
        {/* 앞다리 (굽힘) */}
        <line x1="90" y1="130" x2="70" y2="170" {...style} />
        <line x1="70" y1="170" x2="70" y2="190" {...style} />
        <line x1="60" y1="190" x2="90" y2="190" {...style} strokeWidth={4} />
        {/* 뒷다리 (뒤로 뻗음) */}
        <line x1="90" y1="130" x2="160" y2="170" {...style} />
        <line x1="160" y1="170" x2="180" y2="190" {...style} />
        <line x1="170" y1="190" x2="195" y2="190" {...style} strokeWidth={4} />
        {/* 몸통 */}
        <line x1="90" y1="130" x2="90" y2="80" {...style} />
        <circle cx="90" cy="70" r="10" fill={BODY} />
        {/* 어깨 바벨 */}
        <line x1="65" y1="80" x2="120" y2="80" {...barStyle} strokeWidth={5} />
        <circle cx="65" cy="80" r="6" {...gearStyle} />
        <circle cx="120" cy="80" r="6" {...gearStyle} />
      </g>
    </>
  );
}

function LegExtFigure() {
  return (
    <>
      <style>{`
        @keyframes leShin { 0%,100% { transform: rotate(90deg); } 50% { transform: rotate(0deg); } }
        .le-shin { animation: leShin 1.4s ease-in-out infinite; transform-origin: 120px 130px; }
      `}</style>
      {/* 벤치 */}
      <rect x="30" y="130" width="100" height="8" fill={GEAR} rx="2" />
      {/* 몸통 (앉음) */}
      <line x1="60" y1="125" x2="60" y2="80" {...style} />
      <circle cx="60" cy="70" r="10" fill={BODY} />
      {/* 팔 */}
      <line x1="60" y1="90" x2="90" y2="120" {...style} />
      {/* 허벅지 */}
      <line x1="60" y1="125" x2="120" y2="130" {...style} />
      {/* 정강이 (움직임) */}
      <g className="le-shin">
        <line x1="120" y1="130" x2="150" y2="130" {...style} />
        <circle cx="150" cy="130" r="8" {...gearStyle} />
      </g>
    </>
  );
}

function LegCurlFigure() {
  return (
    <>
      <style>{`
        @keyframes lcShin { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-90deg); } }
        .lc-shin { animation: lcShin 1.4s ease-in-out infinite; transform-origin: 120px 100px; }
      `}</style>
      {/* 벤치 */}
      <rect x="30" y="100" width="140" height="8" fill={GEAR} rx="2" />
      {/* 몸통 (엎드림) */}
      <circle cx="35" cy="95" r="10" fill={BODY} />
      <line x1="45" y1="95" x2="120" y2="95" {...style} />
      {/* 허벅지 */}
      <line x1="120" y1="100" x2="120" y2="100" {...style} />
      {/* 정강이 (움직임) */}
      <g className="lc-shin">
        <line x1="120" y1="100" x2="170" y2="100" {...style} />
        <circle cx="170" cy="100" r="8" {...gearStyle} />
      </g>
    </>
  );
}

function CalfRaiseFigure() {
  return (
    <>
      <style>{`
        @keyframes crBody { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }
        .cr-body { animation: crBody 1.2s ease-in-out infinite; }
      `}</style>
      <g className="cr-body">
        {/* 몸통·다리 */}
        <circle cx="120" cy="55" r="10" fill={BODY} />
        <line x1="120" y1="65" x2="120" y2="180" {...style} />
        {/* 발 (뒤꿈치 든 상태) */}
        <line x1="115" y1="180" x2="140" y2="180" {...style} strokeWidth={4} />
        {/* 어깨 바벨 */}
        <line x1="95" y1="80" x2="150" y2="80" {...barStyle} strokeWidth={5} />
        <circle cx="95" cy="80" r="7" {...gearStyle} />
        <circle cx="150" cy="80" r="7" {...gearStyle} />
      </g>
      {/* 발판 */}
      <rect x="90" y="180" width="60" height="6" fill={GEAR} rx="2" />
    </>
  );
}

function CrunchFigure() {
  return (
    <>
      <style>{`
        @keyframes cnBody { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(35deg); } }
        .cn-body { animation: cnBody 1.4s ease-in-out infinite; transform-origin: 120px 155px; }
      `}</style>
      {/* 바닥 */}
      <line x1="30" y1="185" x2="210" y2="185" stroke={GEAR} strokeWidth={2} />
      {/* 무릎 */}
      <line x1="120" y1="155" x2="160" y2="140" {...style} />
      <line x1="160" y1="140" x2="180" y2="180" {...style} />
      {/* 상체 (움직임) */}
      <g className="cn-body">
        <line x1="120" y1="155" x2="90" y2="130" {...style} />
        <circle cx="80" cy="123" r="10" fill={BODY} />
        {/* 팔 (머리 뒤) */}
        <line x1="80" y1="115" x2="70" y2="105" {...style} />
      </g>
    </>
  );
}

function PlankFigure() {
  return (
    <>
      <style>{`
        @keyframes plPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.8; } }
        .pl { animation: plPulse 1.8s ease-in-out infinite; }
      `}</style>
      <g className="pl">
        <line x1="30" y1="185" x2="210" y2="185" stroke={GEAR} strokeWidth={2} />
        {/* 몸통 */}
        <line x1="50" y1="140" x2="200" y2="140" {...style} />
        <circle cx="205" cy="135" r="10" fill={BODY} />
        {/* 팔 */}
        <line x1="70" y1="140" x2="70" y2="175" {...style} />
        <line x1="70" y1="175" x2="90" y2="175" {...style} />
        {/* 다리 */}
        <line x1="180" y1="140" x2="180" y2="175" {...style} />
        <line x1="170" y1="175" x2="195" y2="175" {...style} strokeWidth={4} />
      </g>
    </>
  );
}

function RunningFigure() {
  return (
    <>
      <style>{`
        @keyframes runLegL { 0%,100% { transform: rotate(-20deg); } 50% { transform: rotate(30deg); } }
        @keyframes runLegR { 0%,100% { transform: rotate(30deg); } 50% { transform: rotate(-20deg); } }
        @keyframes runArmL { 0%,100% { transform: rotate(30deg); } 50% { transform: rotate(-30deg); } }
        @keyframes runArmR { 0%,100% { transform: rotate(-30deg); } 50% { transform: rotate(30deg); } }
        @keyframes runBody { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .run-body { animation: runBody 0.6s ease-in-out infinite; }
        .run-leg-l { animation: runLegL 0.6s ease-in-out infinite; transform-origin: 120px 140px; }
        .run-leg-r { animation: runLegR 0.6s ease-in-out infinite; transform-origin: 120px 140px; }
        .run-arm-l { animation: runArmL 0.6s ease-in-out infinite; transform-origin: 120px 90px; }
        .run-arm-r { animation: runArmR 0.6s ease-in-out infinite; transform-origin: 120px 90px; }
      `}</style>
      <g className="run-body">
        <circle cx="120" cy="75" r="10" fill={BODY} />
        <line x1="120" y1="85" x2="120" y2="140" {...style} />
        <g className="run-arm-l">
          <line x1="120" y1="90" x2="120" y2="125" {...style} />
        </g>
        <g className="run-arm-r">
          <line x1="120" y1="90" x2="120" y2="125" {...style} />
        </g>
        <g className="run-leg-l">
          <line x1="120" y1="140" x2="120" y2="185" {...style} />
        </g>
        <g className="run-leg-r">
          <line x1="120" y1="140" x2="120" y2="185" {...style} />
        </g>
      </g>
    </>
  );
}

function PushupFigure() {
  return (
    <>
      <style>{`
        @keyframes pushBody { 0%,100% { transform: translateY(0); } 50% { transform: translateY(15px); } }
        .push-body { animation: pushBody 1.6s ease-in-out infinite; }
      `}</style>
      <line x1="30" y1="185" x2="210" y2="185" stroke={GEAR} strokeWidth={2} />
      <g className="push-body">
        {/* 몸통 */}
        <line x1="50" y1="140" x2="190" y2="140" {...style} />
        <circle cx="195" cy="135" r="10" fill={BODY} />
        {/* 팔 */}
        <line x1="70" y1="140" x2="70" y2="180" {...style} />
        {/* 다리 */}
        <line x1="180" y1="140" x2="180" y2="180" {...style} />
      </g>
    </>
  );
}

function DipsFigure() {
  return (
    <>
      <style>{`
        @keyframes dipsBody { 0%,100% { transform: translateY(0); } 50% { transform: translateY(30px); } }
        .dips-body { animation: dipsBody 1.6s ease-in-out infinite; }
      `}</style>
      {/* 딥스 바 */}
      <line x1="60" y1="80" x2="60" y2="180" stroke={GEAR} strokeWidth={3} />
      <line x1="180" y1="80" x2="180" y2="180" stroke={GEAR} strokeWidth={3} />
      <line x1="60" y1="80" x2="80" y2="80" stroke={GEAR} strokeWidth={4} />
      <line x1="180" y1="80" x2="160" y2="80" stroke={GEAR} strokeWidth={4} />
      {/* 몸 (움직임) */}
      <g className="dips-body">
        <line x1="80" y1="80" x2="80" y2="115" {...style} />
        <line x1="160" y1="80" x2="160" y2="115" {...style} />
        <line x1="80" y1="115" x2="120" y2="115" {...style} />
        <line x1="160" y1="115" x2="120" y2="115" {...style} />
        <circle cx="120" cy="105" r="10" fill={BODY} />
        {/* 무릎 접힘 */}
        <line x1="120" y1="125" x2="140" y2="150" {...style} />
        <line x1="140" y1="150" x2="130" y2="175" {...style} />
      </g>
    </>
  );
}

function GenericFigure() {
  return (
    <>
      <style>{`
        @keyframes gnPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        .gn { animation: gnPulse 1.6s ease-in-out infinite; transform-origin: 120px 100px; }
      `}</style>
      <g className="gn">
        <circle cx="120" cy="65" r="12" fill={BODY} />
        <line x1="120" y1="77" x2="120" y2="150" {...style} />
        <line x1="120" y1="95" x2="80" y2="130" {...style} />
        <line x1="120" y1="95" x2="160" y2="130" {...style} />
        <line x1="120" y1="150" x2="95" y2="190" {...style} />
        <line x1="120" y1="150" x2="145" y2="190" {...style} />
      </g>
    </>
  );
}

// 오렌지 컬러 노드가 IDE에서 unused 로 안 뜨도록 참조
void STROKE;
