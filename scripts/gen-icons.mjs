// TinyLearn(티니런) 앱 아이콘/스플래시 소스 PNG 생성 스크립트.
// sharp로 SVG를 래스터화하여 assets/ 에 @capacitor/assets 표준 파일을 만든다.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('assets', { recursive: true });

const PURPLE = '#7F77DD';
const PURPLE_DARK = '#5B53B8';
const TEAL = '#1D9E75';
const STAR = '#FFD24D';
const STAR_EDGE = '#F4B400';

// 100단위 좌표의 5각 별 폴리곤 (ShapeIcon과 동일 형태)
const STAR_POINTS = '50,5 61,38 96,38 68,59 79,92 50,72 21,92 32,59 4,38 39,38';

// 별을 (cx,cy) 중심, size 폭으로 그리는 그룹
const starGroup = (cx, cy, size, fill = STAR, edge = STAR_EDGE, sw = 3) => {
  const s = size / 100;
  const tx = cx - size / 2;
  const ty = cy - size / 2;
  return `<g transform="translate(${tx} ${ty}) scale(${s})">
    <polygon points="${STAR_POINTS}" fill="${fill}" stroke="${edge}" stroke-width="${sw}" stroke-linejoin="round"/>
  </g>`;
};

// 하단 색·도형 3종 (빨강 원 / 파랑 세모 / 초록 네모)
const shapesRow = (cx, cy, gap, r) => `
  <circle cx="${cx - gap}" cy="${cy}" r="${r}" fill="#EF4444" stroke="#fff" stroke-width="6"/>
  <polygon points="${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}" fill="#3B82F6" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
  <rect x="${cx + gap - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" rx="10" fill="${TEAL}" stroke="#fff" stroke-width="6"/>
`;

// 전체 아이콘(배경 포함) — 1024
const iconFull = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${PURPLE}"/>
      <stop offset="1" stop-color="${PURPLE_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  ${starGroup(512, 430, 460)}
  ${shapesRow(512, 780, 175, 60)}
</svg>`;

// 적응형 아이콘 전경(투명 배경, 안전영역 안에 배치) — 1024
const iconForeground = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${starGroup(512, 430, 360)}
  ${shapesRow(512, 700, 135, 46)}
</svg>`;

// 적응형 아이콘 배경(단색 그라데이션) — 1024
const iconBackground = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${PURPLE}"/>
      <stop offset="1" stop-color="${PURPLE_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
</svg>`;

// 스플래시 — 2732 정사각, 중앙 로고(별)
const splash = (bg1, bg2) => `
<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bg1}"/>
      <stop offset="1" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <rect width="2732" height="2732" fill="url(#bg)"/>
  ${starGroup(1366, 1230, 760)}
  ${shapesRow(1366, 1720, 300, 95)}
</svg>`;

const out = async (svg, file, size) => {
  let img = sharp(Buffer.from(svg)).resize(size, size);
  await img.png().toFile(`assets/${file}`);
  console.log('wrote assets/' + file);
};

await out(iconFull, 'icon-only.png', 1024);
await out(iconForeground, 'icon-foreground.png', 1024);
await out(iconBackground, 'icon-background.png', 1024);
await out(splash(PURPLE, PURPLE_DARK), 'splash.png', 2732);
await out(splash('#3A3550', '#23203A'), 'splash-dark.png', 2732);
console.log('done');
