import { Box } from '@mui/material';

// 자극 근육 부위 코드
export type MuscleRegion =
  | 'CHEST' // 대흉근
  | 'FRONT_DELT' // 전면삼각근
  | 'SIDE_DELT' // 측면삼각근
  | 'REAR_DELT' // 후면삼각근
  | 'BICEPS' // 이두근
  | 'FOREARM' // 전완
  | 'ABS' // 복근
  | 'OBLIQUE' // 복사근
  | 'QUAD' // 대퇴사두근
  | 'ADDUCTOR' // 내전근
  | 'CALF' // 비복근
  | 'TRAP' // 승모근
  | 'LAT' // 광배근
  | 'ERECTOR' // 척추기립근
  | 'TRICEPS' // 삼두근
  | 'GLUTE' // 둔근
  | 'HAMSTRING'; // 햄스트링

// 한글 근육명 → Region 매핑 (부분 일치 지원)
const MUSCLE_KEYWORDS: [string, MuscleRegion][] = [
  ['대흉근', 'CHEST'],
  ['가슴', 'CHEST'],
  ['전면삼각', 'FRONT_DELT'],
  ['측면삼각', 'SIDE_DELT'],
  ['후면삼각', 'REAR_DELT'],
  ['삼각근', 'FRONT_DELT'],
  ['이두', 'BICEPS'],
  ['상완근', 'BICEPS'],
  ['전완', 'FOREARM'],
  ['복근', 'ABS'],
  ['복직근', 'ABS'],
  ['하복부', 'ABS'],
  ['복사근', 'OBLIQUE'],
  ['대퇴사두', 'QUAD'],
  ['내전근', 'ADDUCTOR'],
  ['비복근', 'CALF'],
  ['승모근', 'TRAP'],
  ['광배근', 'LAT'],
  ['척추기립', 'ERECTOR'],
  ['삼두', 'TRICEPS'],
  ['둔근', 'GLUTE'],
  ['중둔근', 'GLUTE'],
  ['햄스트링', 'HAMSTRING'],
];

export function nameToRegions(name?: string | string[]): MuscleRegion[] {
  if (!name) return [];
  const arr = Array.isArray(name) ? name : [name];
  const out = new Set<MuscleRegion>();
  for (const s of arr) {
    for (const [kw, region] of MUSCLE_KEYWORDS) {
      if (s.includes(kw)) out.add(region);
    }
  }
  return Array.from(out);
}

// 앞뒤 실루엣의 각 근육 영역 SVG 좌표 (200x360 캔버스 기준)
// 완벽한 해부학이 아닌 인식 가능한 심볼릭 다이어그램.

export default function MuscleBodyDiagram({
  primary,
  secondary = [],
}: {
  primary: MuscleRegion[];
  secondary?: MuscleRegion[];
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
      <BodySilhouette side="front" primary={primary} secondary={secondary} />
      <BodySilhouette side="back" primary={primary} secondary={secondary} />
    </Box>
  );
}

function BodySilhouette({
  side,
  primary,
  secondary,
}: {
  side: 'front' | 'back';
  primary: MuscleRegion[];
  secondary: MuscleRegion[];
}) {
  const P = new Set(primary);
  const S = new Set(secondary);
  const BODY = '#2A3441';
  const OUTLINE = 'rgba(255,255,255,0.15)';
  const PRIMARY = '#FF6B35';
  const SECONDARY = 'rgba(255,107,53,0.35)';

  const fillFor = (r: MuscleRegion) =>
    P.has(r) ? PRIMARY : S.has(r) ? SECONDARY : BODY;

  const parts = side === 'front' ? frontParts(fillFor) : backParts(fillFor);

  return (
    <Box>
      <svg viewBox="0 0 200 360" width={140} height={252} xmlns="http://www.w3.org/2000/svg">
        {/* 본체 실루엣 (몸통·다리·팔 통합) */}
        <path d={SILHOUETTE} fill={BODY} stroke={OUTLINE} strokeWidth={1.5} />
        {parts}
        {/* 관절 강조(선) — 미묘한 구조감 */}
        <path
          d="M 100 62 L 100 82"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={1}
          fill="none"
        />
      </svg>
      <Box sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 11, mt: 0.5 }}>
        {side === 'front' ? '앞' : '뒤'}
      </Box>
    </Box>
  );
}

// 통합 실루엣 path — 머리+목+어깨+몸통+다리+팔의 부드러운 아웃라인
const SILHOUETTE = `
M 100 12
C 84 12 76 26 76 40 C 76 52 82 60 88 62
L 88 68
C 74 70 62 76 55 88 C 48 100 46 116 46 130
L 46 190
C 46 200 48 208 54 214
L 60 260
C 62 288 66 320 72 344
C 74 348 78 348 82 348
C 88 348 90 344 90 340
L 92 240
L 96 240
L 96 340
C 96 344 98 348 100 348
C 102 348 104 344 104 340
L 104 240
L 108 240
L 110 340
C 110 344 112 348 118 348
C 122 348 126 348 128 344
C 134 320 138 288 140 260
L 146 214
C 152 208 154 200 154 190
L 154 130
C 154 116 152 100 145 88
C 138 76 126 70 112 68
L 112 62
C 118 60 124 52 124 40
C 124 26 116 12 100 12 Z
`;

// 앞면 근육 오버레이
function frontParts(fill: (r: MuscleRegion) => string) {
  return (
    <>
      {/* 전면삼각근 (좌·우 어깨 앞) */}
      <path
        d="M 56 90 Q 50 88 48 100 Q 46 116 54 122 Q 60 118 66 110 Q 62 96 56 90 Z"
        fill={fill('FRONT_DELT')}
      />
      <path
        d="M 144 90 Q 150 88 152 100 Q 154 116 146 122 Q 140 118 134 110 Q 138 96 144 90 Z"
        fill={fill('FRONT_DELT')}
      />
      {/* 대흉근 (좌·우 가슴) */}
      <path
        d="M 70 96 Q 66 116 78 132 Q 92 138 100 128 L 100 108 Q 84 92 70 96 Z"
        fill={fill('CHEST')}
      />
      <path
        d="M 130 96 Q 134 116 122 132 Q 108 138 100 128 L 100 108 Q 116 92 130 96 Z"
        fill={fill('CHEST')}
      />
      {/* 복근 (중앙 6팩) */}
      <g fill={fill('ABS')}>
        <rect x="88" y="140" width="24" height="12" rx="3" />
        <rect x="88" y="156" width="24" height="12" rx="3" />
        <rect x="88" y="172" width="24" height="12" rx="3" />
        <rect x="88" y="188" width="24" height="10" rx="3" />
      </g>
      {/* 복사근 (양옆) */}
      <path d="M 70 140 Q 68 168 82 192 L 86 192 L 86 140 Z" fill={fill('OBLIQUE')} />
      <path d="M 130 140 Q 132 168 118 192 L 114 192 L 114 140 Z" fill={fill('OBLIQUE')} />
      {/* 이두근 (팔 앞) */}
      <ellipse cx="52" cy="140" rx="9" ry="20" fill={fill('BICEPS')} />
      <ellipse cx="148" cy="140" rx="9" ry="20" fill={fill('BICEPS')} />
      {/* 전완 */}
      <ellipse cx="55" cy="180" rx="7" ry="18" fill={fill('FOREARM')} />
      <ellipse cx="145" cy="180" rx="7" ry="18" fill={fill('FOREARM')} />
      {/* 대퇴사두근 */}
      <path
        d="M 78 210 Q 72 260 82 300 L 96 300 L 96 210 Q 88 208 78 210 Z"
        fill={fill('QUAD')}
      />
      <path
        d="M 122 210 Q 128 260 118 300 L 104 300 L 104 210 Q 112 208 122 210 Z"
        fill={fill('QUAD')}
      />
      {/* 내전근 (허벅지 안쪽) */}
      <path d="M 96 214 L 100 214 L 100 275 L 96 275 Z" fill={fill('ADDUCTOR')} />
      <path d="M 100 214 L 104 214 L 104 275 L 100 275 Z" fill={fill('ADDUCTOR')} />
      {/* 종아리 앞(비복근은 뒤가 주지만 실루엣에 표시) */}
      <ellipse cx="86" cy="325" rx="6" ry="14" fill={fill('CALF')} />
      <ellipse cx="114" cy="325" rx="6" ry="14" fill={fill('CALF')} />
    </>
  );
}

// 뒷면 근육 오버레이
function backParts(fill: (r: MuscleRegion) => string) {
  return (
    <>
      {/* 승모근 (목 아래 삼각형) */}
      <path
        d="M 82 70 Q 100 76 118 70 L 128 96 L 100 106 L 72 96 Z"
        fill={fill('TRAP')}
      />
      {/* 후면삼각근 (어깨 뒤) */}
      <path
        d="M 56 92 Q 50 92 48 104 Q 48 118 58 124 Q 66 118 68 108 Q 62 96 56 92 Z"
        fill={fill('REAR_DELT')}
      />
      <path
        d="M 144 92 Q 150 92 152 104 Q 152 118 142 124 Q 134 118 132 108 Q 138 96 144 92 Z"
        fill={fill('REAR_DELT')}
      />
      {/* 광배근 (등 날개) */}
      <path
        d="M 68 100 Q 60 130 68 168 L 96 168 L 100 108 Q 82 96 68 100 Z"
        fill={fill('LAT')}
      />
      <path
        d="M 132 100 Q 140 130 132 168 L 104 168 L 100 108 Q 118 96 132 100 Z"
        fill={fill('LAT')}
      />
      {/* 척추기립근 (중앙 세로 두 갈래) */}
      <rect x="94" y="112" width="4" height="80" rx="2" fill={fill('ERECTOR')} />
      <rect x="102" y="112" width="4" height="80" rx="2" fill={fill('ERECTOR')} />
      {/* 삼두근 (팔 뒤) */}
      <ellipse cx="52" cy="140" rx="9" ry="22" fill={fill('TRICEPS')} />
      <ellipse cx="148" cy="140" rx="9" ry="22" fill={fill('TRICEPS')} />
      {/* 전완 */}
      <ellipse cx="55" cy="180" rx="7" ry="18" fill={fill('FOREARM')} />
      <ellipse cx="145" cy="180" rx="7" ry="18" fill={fill('FOREARM')} />
      {/* 둔근 */}
      <path
        d="M 76 198 Q 70 214 84 234 L 100 232 L 100 200 Q 88 196 76 198 Z"
        fill={fill('GLUTE')}
      />
      <path
        d="M 124 198 Q 130 214 116 234 L 100 232 L 100 200 Q 112 196 124 198 Z"
        fill={fill('GLUTE')}
      />
      {/* 햄스트링 (허벅지 뒤) */}
      <path
        d="M 78 236 Q 72 275 82 300 L 96 300 L 96 236 Q 88 234 78 236 Z"
        fill={fill('HAMSTRING')}
      />
      <path
        d="M 122 236 Q 128 275 118 300 L 104 300 L 104 236 Q 112 234 122 236 Z"
        fill={fill('HAMSTRING')}
      />
      {/* 종아리 뒤 (비복근) */}
      <ellipse cx="86" cy="325" rx="7" ry="16" fill={fill('CALF')} />
      <ellipse cx="114" cy="325" rx="7" ry="16" fill={fill('CALF')} />
    </>
  );
}
