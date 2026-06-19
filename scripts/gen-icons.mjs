// 티니런 앱 아이콘/스플래시 생성.
// 참조 디자인: 초록 배경 + '가'(흰 블록)·'A'(노란 블록) 글자 블록 + 별 + 연필.
// 글자는 폰트 의존 없이 벡터 획으로 그린다. sharp로 SVG → PNG.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('assets', { recursive: true });

const GREEN1 = '#36C880';
const GREEN2 = '#1C9E63';
const INK = '#2E2A4D';
const BLOCK_W = '#FFFDF5';
const BLOCK_Y = '#FFC53D';

const star5 = '50,5 61,38 96,38 68,59 79,92 50,72 21,92 32,59 4,38 39,38';

// 글자 블록: (cx,cy) 중심, rot 회전, fill 배경, 내부에 획(strokes) 그리기
function block(cx, cy, rot, fill, strokes) {
  const S = 290; // 블록 한 변
  const h = S / 2;
  const pad = 54;
  const m = (v) => -h + pad + (v / 100) * (S - 2 * pad); // 0~100 → 블록 로컬좌표
  const paths = strokes
    .map(
      (st) =>
        `<path d="${st
          .map((p, i) => `${i ? 'L' : 'M'} ${m(p[0]).toFixed(1)} ${m(p[1]).toFixed(1)}`)
          .join(' ')}" fill="none" stroke="${INK}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})">
    <rect x="${-h}" y="${-h}" width="${S}" height="${S}" rx="56" fill="${fill}"
      stroke="rgba(0,0,0,0.06)" stroke-width="2"/>
    ${paths}
  </g>`;
}

// '가' = ㄱ + ㅏ
const GA = [
  [[14, 30], [50, 30], [42, 60]], // ㄱ
  [[64, 14], [64, 88]], // ㅏ 세로
  [[64, 50], [90, 50]], // ㅏ 가지
];
// 'A'
const A = [
  [[20, 88], [50, 14]],
  [[50, 14], [80, 88]],
  [[33, 58], [67, 58]],
];

// 연필 (가로 기준 로컬좌표) — 회전·이동해서 배치
function pencil(cx, cy, rot, scale = 1) {
  return `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${scale})">
    <rect x="-30" y="-34" width="34" height="68" rx="12" fill="#F2A0B4"/>
    <rect x="0" y="-34" width="250" height="68" rx="6" fill="#F4A93B"/>
    <rect x="0" y="-34" width="250" height="20" rx="6" fill="#F7BC5E"/>
    <rect x="250" y="-34" width="22" height="68" fill="#EDEDED"/>
    <polygon points="272,-34 272,34 348,0" fill="#F3D6A6"/>
    <polygon points="322,-14 322,14 348,0" fill="#3B3650"/>
  </g>`;
}

// 메인 그림 (1024 캔버스 중심 좌표 기준) — scale 로 크기 조절
function art(scale = 1) {
  return `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <!-- 별 -->
    <g transform="translate(232 232) scale(1.7)">
      <polygon points="${star5}" fill="#FFE49B" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
    </g>
    <!-- 연필 -->
    ${pencil(250, 720, -32, 1.0)}
    <!-- 글자 블록 -->
    ${block(430, 470, -8, BLOCK_W, GA)}
    ${block(648, 560, 9, BLOCK_Y, A)}
  </g>`;
}

const bgGreen = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${GREEN1}"/><stop offset="1" stop-color="${GREEN2}"/>
</linearGradient></defs>`;

const iconFull = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${bgGreen}<rect width="1024" height="1024" fill="url(#bg)"/>${art(0.94)}</svg>`;

const iconForeground = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${art(0.82)}</svg>`;

const iconBackground = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${bgGreen}<rect width="1024" height="1024" fill="url(#bg)"/></svg>`;

const splash = (g1, g2) => `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${g1}"/><stop offset="1" stop-color="${g2}"/>
  </linearGradient></defs>
  <rect width="2732" height="2732" fill="url(#bg)"/>
  <g transform="translate(1366 1366) scale(2.4) translate(-512 -512)">${art(1)}</g>
</svg>`;

const out = async (svg, file, size) => {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`assets/${file}`);
  console.log('wrote assets/' + file);
};

await out(iconFull, 'icon-only.png', 1024);
await out(iconForeground, 'icon-foreground.png', 1024);
await out(iconBackground, 'icon-background.png', 1024);
await out(splash(GREEN1, GREEN2), 'splash.png', 2732);
await out(splash('#1F3A2E', '#142620'), 'splash-dark.png', 2732);
console.log('done');
