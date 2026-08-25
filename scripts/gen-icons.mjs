// 헬스맨 앱 아이콘/스플래시 생성.
// 오렌지 그라디언트 배경 + 흰색 덤벨(barbell) 로고.
// 안드로이드 adaptive icon: foreground(투명 + 덤벨)·background(오렌지) 분리 렌더.
// 텍스트 없이 순수 벡터 마크만 사용 (Play Store 아이콘 정책 및 폰트 의존 회피).
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('assets', { recursive: true });

// 브랜드 팔레트 (앱 다크 테마와 통일)
const ORANGE1 = '#FF6B35';
const ORANGE2 = '#FF8A5F';
const NAVY1 = '#0F1621';
const NAVY2 = '#1A2332';
const WHITE = '#FFFFFF';

/**
 * 덤벨(바벨) SVG 마크.
 * 원점(0,0) 중심, 폭 ~600 x 높이 ~260 크기, 30° 회전 지원.
 * fill 색상은 파라미터로.
 * 구성: [원판 바깥][원판 안쪽]===[핸들]===[원판 안쪽][원판 바깥]
 */
function dumbbell({ color = WHITE, rotate = -22, scale = 1, cx = 0, cy = 0 } = {}) {
  const s = scale;
  const g = (x) => (x * s).toFixed(1);
  // 좌표계 로컬 → 회전 적용은 transform 으로
  return `
  <g transform="translate(${cx} ${cy}) rotate(${rotate})">
    <!-- 핸들 -->
    <rect x="${g(-160)}" y="${g(-30)}" width="${g(320)}" height="${g(60)}" rx="${g(28)}" fill="${color}"/>
    <!-- 좌측 원판 안쪽 -->
    <rect x="${g(-235)}" y="${g(-80)}" width="${g(70)}" height="${g(160)}" rx="${g(20)}" fill="${color}"/>
    <!-- 좌측 원판 바깥 -->
    <rect x="${g(-315)}" y="${g(-115)}" width="${g(72)}" height="${g(230)}" rx="${g(22)}" fill="${color}"/>
    <!-- 우측 원판 안쪽 -->
    <rect x="${g(165)}" y="${g(-80)}" width="${g(70)}" height="${g(160)}" rx="${g(20)}" fill="${color}"/>
    <!-- 우측 원판 바깥 -->
    <rect x="${g(243)}" y="${g(-115)}" width="${g(72)}" height="${g(230)}" rx="${g(22)}" fill="${color}"/>
  </g>`;
}

// 오렌지 그라디언트 정의 (재사용)
const orangeGrad = `
  <defs>
    <radialGradient id="og" cx="0.5" cy="0.4" r="0.75">
      <stop offset="0" stop-color="${ORANGE2}"/>
      <stop offset="1" stop-color="${ORANGE1}"/>
    </radialGradient>
    <radialGradient id="ng" cx="0.5" cy="0.42" r="0.7">
      <stop offset="0" stop-color="${NAVY2}"/>
      <stop offset="1" stop-color="${NAVY1}"/>
    </radialGradient>
    <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${WHITE}"/>
      <stop offset="1" stop-color="#F0EDE8"/>
    </linearGradient>
  </defs>`;

// 1024x1024 오렌지 배경 + 중앙 덤벨 (레거시 아이콘 / icon-only)
const iconSquareSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  ${orangeGrad}
  <rect width="1024" height="1024" fill="url(#og)"/>
  <g transform="translate(512 512)">
    ${dumbbell({ color: 'url(#dg)', rotate: -22, scale: 1.05 })}
  </g>
  <!-- 살짝의 하이라이트 -->
  <circle cx="330" cy="300" r="180" fill="white" opacity="0.08"/>
</svg>`;

// Adaptive icon foreground: 투명 배경 + 중앙 덤벨 (안전 영역 안에)
// 안드로이드 adaptive icon safe zone: 중심 66% (=~672px in 1024)
const iconForegroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  ${orangeGrad}
  <g transform="translate(512 512)">
    ${dumbbell({ color: 'url(#dg)', rotate: -22, scale: 0.95 })}
  </g>
</svg>`;

// Adaptive icon background: 오렌지 그라디언트 풀필 (원형/사각 마스크에 대응)
const iconBackgroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  ${orangeGrad}
  <rect width="1024" height="1024" fill="url(#og)"/>
</svg>`;

// 스플래시: 다크 네이비 배경 + 중앙 오렌지 덤벨
// 2732x2732 (Capacitor 권장 크기).
const splashSvg = (bg = 'url(#ng)') => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">
  ${orangeGrad}
  <rect width="2732" height="2732" fill="${bg}"/>
  <g transform="translate(1366 1366)">
    ${dumbbell({ color: ORANGE1, rotate: -22, scale: 1.6 })}
  </g>
</svg>`;

async function render(svg, outPath, opts = {}) {
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(opts.width ?? 1024, opts.height ?? 1024)
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log('wrote', outPath);
}

await render(iconSquareSvg, 'assets/icon-only.png');
await render(iconForegroundSvg, 'assets/icon-foreground.png');
await render(iconBackgroundSvg, 'assets/icon-background.png');
await render(splashSvg(), 'assets/splash.png', { width: 2732, height: 2732 });
await render(splashSvg('url(#ng)'), 'assets/splash-dark.png', {
  width: 2732,
  height: 2732,
});

console.log('done.');
