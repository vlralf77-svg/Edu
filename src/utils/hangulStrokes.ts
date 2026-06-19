// 임의의 한글 문자열(이름·단어)을 자모로 분해하고,
// 음절 블록 레이아웃에 맞춰 0~100 좌표의 획순 배열로 변환한다.
import { jamoStrokes, type Stroke } from '@/data/strokeData';

const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

// 세로형 모음(자음 오른쪽에 위치)
const VERTICAL = new Set(['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅣ']);

type Rect = { x0: number; x1: number; y0: number; y1: number };

// 자모 획을 sub-rect 안으로 매핑 (원본 0~100 → rect)
function mapStrokes(strokes: Stroke[], r: Rect): Stroke[] {
  const sx = (r.x1 - r.x0) / 100;
  const sy = (r.y1 - r.y0) / 100;
  return strokes.map((st) => st.map(([x, y]) => [r.x0 + x * sx, r.y0 + y * sy] as [number, number]));
}

// 한 음절(0~100 블록)에 대한 획 배열
function syllableStrokes(ch: string): Stroke[] {
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) {
    // 완성형 음절이 아니면 자모 자체로 시도
    return jamoStrokes[ch] ? mapStrokes(jamoStrokes[ch], { x0: 12, x1: 88, y0: 8, y1: 92 }) : [];
  }
  const jong = code % 28;
  const jung = Math.floor(code / 28) % 21;
  const cho = Math.floor(code / 28 / 21);

  const choCh = CHO[cho];
  const jungCh = JUNG[jung];
  const jongCh = JONG[jong];
  const hasJong = jong !== 0;
  const vertical = VERTICAL.has(jungCh);

  let choRect: Rect, jungRect: Rect, jongRect: Rect | null = null;

  if (!hasJong) {
    if (vertical) {
      choRect = { x0: 8, x1: 52, y0: 12, y1: 88 };
      jungRect = { x0: 54, x1: 92, y0: 8, y1: 92 };
    } else {
      choRect = { x0: 14, x1: 86, y0: 8, y1: 48 };
      jungRect = { x0: 8, x1: 92, y0: 50, y1: 92 };
    }
  } else {
    if (vertical) {
      choRect = { x0: 8, x1: 50, y0: 8, y1: 56 };
      jungRect = { x0: 54, x1: 92, y0: 8, y1: 56 };
      jongRect = { x0: 12, x1: 88, y0: 62, y1: 94 };
    } else {
      choRect = { x0: 16, x1: 84, y0: 6, y1: 34 };
      jungRect = { x0: 8, x1: 92, y0: 36, y1: 62 };
      jongRect = { x0: 14, x1: 86, y0: 66, y1: 94 };
    }
  }

  const out: Stroke[] = [];
  if (jamoStrokes[choCh]) out.push(...mapStrokes(jamoStrokes[choCh], choRect));
  if (jamoStrokes[jungCh]) out.push(...mapStrokes(jamoStrokes[jungCh], jungRect));
  if (jongRect && jamoStrokes[jongCh]) out.push(...mapStrokes(jamoStrokes[jongCh], jongRect));
  return out;
}

/**
 * 문자열 전체의 획순(0~100 좌표)을 반환.
 * 여러 글자는 가로로 균등 분할한 칸에 배치한다.
 * 지원하지 않는 자모(겹받침/복모음 등)는 해당 획을 생략한다.
 */
export function getStrokesForText(text: string): Stroke[] {
  const chars = [...(text || '')].filter((c) => c.trim() !== '');
  if (chars.length === 0) return [];
  const n = chars.length;
  const out: Stroke[] = [];
  const pad = n > 1 ? 4 : 0;
  chars.forEach((ch, i) => {
    const cell: Rect = { x0: (i * 100) / n + pad, x1: ((i + 1) * 100) / n - pad, y0: 2, y1: 98 };
    const inner = syllableStrokes(ch); // 0~100
    out.push(...mapStrokes(inner, cell));
  });
  return out;
}
