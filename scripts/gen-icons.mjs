// 우리가족(가족통화) 앱 아이콘/스플래시 생성.
// 컨셉: 부드러운 틸 그라디언트 위에 커다란 하트, 그 안에 전화 수화기.
// "가족과 이어지는 통화" 라는 뜻을 한 눈에 읽히게 단순화.
// 폰트 의존 없이 벡터로만 그린다. sharp 로 SVG → PNG.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('assets', { recursive: true });

const TEAL1 = '#14B8A6';
const TEAL2 = '#0E7C7B';
const CORAL = '#F97316';
const CORAL_D = '#C2410C';
const HEART = '#F43F5E';
const HEART_D = '#BE123C';
const WHITE = '#FFFFFF';

// ---- 부품 ----

// 하트 (0,0 중심), 세로 폭 h, 채움 색
function heart(cx, cy, h, fill, stroke) {
  const s = h / 220;
  return `<g transform="translate(${cx} ${cy}) scale(${s})">
    <path d="M 0 -30
             C -60 -130, -220 -80, -220 20
             C -220 130, -80 200, 0 260
             C 80 200, 220 130, 220 20
             C 220 -80, 60 -130, 0 -30 Z"
          fill="${fill}"
          stroke="${stroke}" stroke-width="8" stroke-linejoin="round"/>
  </g>`;
}

// 전화 수화기 (Material 스타일). 표준 아이콘 경로를 크게 그린다.
// (0,0 기준, 세로 폭 ~ 300)
function phone(cx, cy, rot, scale, color) {
  return `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${scale})">
    <path d="M -110 -140
             C -110 -170, -80 -180, -60 -168
             L 10 -128
             C 30 -117, 36 -90, 24 -70
             L -6 -22
             C -20 0, -20 32, -6 55
             L 24 100
             C 40 128, 68 148, 100 152
             L 130 155
             C 162 158, 190 138, 200 108
             L 214 68
             C 220 42, 200 18, 174 20
             L 138 24
             C 116 26, 96 12, 92 -10
             L 84 -50
             C 78 -80, 90 -110, 118 -122"
          fill="none"
          stroke="${color}" stroke-width="42"
          stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

// 단순한 통화 수화기 (더 아이콘적) — J 형태
// (0,0 중심), 스케일 s
function handset(cx, cy, rot, s, color, strokeColor) {
  return `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${s})">
    <path d="
      M -160 -110
      C -180 -140, -160 -180, -120 -180
      L -70 -180
      C -30 -180, -10 -150, -20 -110
      L -40 -50
      C -46 -30, -60 -20, -80 -22
      L -60 30
      C -20 100, 40 160, 110 200
      C 130 208, 150 200, 156 180
      L 176 130
      C 190 100, 220 90, 250 100
      C 300 118, 310 158, 290 190
      C 250 260, 180 300, 100 280
      C -40 244, -140 140, -180 20
      C -196 -30, -190 -80, -160 -110 Z"
      fill="${color}" stroke="${strokeColor}" stroke-width="10" stroke-linejoin="round"/>
  </g>`;
}

// 가족 실루엣 (어른-어른-아이) — cx는 가운데
function family(cx, cy, scale) {
  const person = (dx, headR, bodyW, bodyH, color) => `
    <g transform="translate(${dx} 0)">
      <circle cx="0" cy="${-bodyH / 2 - headR - 4}" r="${headR}" fill="${color}"
              stroke="rgba(0,0,0,0.12)" stroke-width="3"/>
      <path d="M ${-bodyW / 2} ${bodyH / 2}
               C ${-bodyW / 2} ${-bodyH / 2 + 6}, ${bodyW / 2} ${-bodyH / 2 + 6}, ${bodyW / 2} ${bodyH / 2} Z"
            fill="${color}" stroke="rgba(0,0,0,0.12)" stroke-width="3"/>
    </g>`;
  return `<g transform="translate(${cx} ${cy}) scale(${scale})">
    ${person(-70, 30, 78, 90, '#FFFFFF')}
    ${person(0, 34, 92, 100, '#FFF7ED')}
    ${person(60, 22, 56, 68, '#FDBA74')}
  </g>`;
}

// ---- 메인 아트 ----
function art(scale = 1) {
  return `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <!-- 하트 (뒤쪽) -->
    ${heart(512, 460, 620, HEART, HEART_D)}
    <!-- 수화기 (하트 안쪽, 살짝 기울여서) -->
    ${handset(512, 470, -12, 0.85, WHITE, 'rgba(0,0,0,0.08)')}
    <!-- 가족 실루엣 (하트 아래) -->
    ${family(512, 890, 1.05)}
  </g>`;
}

const bg = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${TEAL1}"/>
    <stop offset="1" stop-color="${TEAL2}"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.35" cy="0.3" r="0.9">
    <stop offset="0" stop-color="rgba(255,255,255,0.28)"/>
    <stop offset="1" stop-color="rgba(255,255,255,0)"/>
  </radialGradient>
</defs>`;

const iconFull = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${bg}
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>
  ${art(1.0)}
</svg>`;

// 적응형 전경 — 안전 여백 확보 위해 살짝 축소
const iconForeground = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${art(0.78)}
</svg>`;

const iconBackground = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${bg}
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>
</svg>`;

const splash = (g1, g2) => `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${g1}"/>
      <stop offset="1" stop-color="${g2}"/>
    </linearGradient>
  </defs>
  <rect width="2732" height="2732" fill="url(#bg)"/>
  <g transform="translate(1366 1366) scale(1.9) translate(-512 -512)">${art(1.0)}</g>
</svg>`;

const out = async (svg, file, size) => {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`assets/${file}`);
  console.log('wrote assets/' + file);
};

await out(iconFull, 'icon-only.png', 1024);
await out(iconForeground, 'icon-foreground.png', 1024);
await out(iconBackground, 'icon-background.png', 1024);
await out(splash(TEAL1, TEAL2), 'splash.png', 2732);
await out(splash('#0F3F3E', '#08201F'), 'splash-dark.png', 2732);
console.log('done');

// 참고: coral 은 splash 배경 대비 강조용으로만 남겨두었다(추후 텍스트 등).
void CORAL; void CORAL_D;
