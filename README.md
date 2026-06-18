# TinyLearn — 유아·아동 교육 게임 앱

2~8세 아이들을 위한 교육 게임 앱입니다. **영단어 그림 매칭**과 **색·도형 인지 퍼즐** 두 가지 모드를 제공합니다.

## 기술 스택

| 항목 | 기술 |
|---|---|
| 프론트엔드 | React + Vite + TypeScript + MUI |
| 상태관리 | Zustand (persist → localStorage) |
| 모바일 패키징 | Capacitor |
| TTS | Web Speech API (`speechSynthesis`) |
| 사운드 피드백 | Web Audio API (합성음) |
| 광고 | `@capacitor-community/admob` |

## 주요 기능

- **영단어 게임**: 그림(이모지/이미지) 카드 → 영단어 보기 선택 → 정답 시 TTS 발음. 난이도 3단계(쉬움 3지선다 / 보통 4지선다 / 어려움 타이머).
- **색·도형 게임**: "파란 것을 모두 골라요" 형태의 지시 → 터치 선택. 정답 초록 테두리 + 효과음, 오답 흔들림 애니메이션.
- **보상 시스템**: 정답당 별 1개, 별 5개로 힌트 1회, 연속 출석 보너스(3일마다 +3).
- **광고 (Google 패밀리 정책 준수)**: 홈·결과 화면 하단 배너, 보호자 인증(덧셈) 후 보상형 광고. 게임 플레이 중 광고 없음. COPPA 비개인화 광고.

## 개발

```bash
npm install
npm run dev        # 브라우저 미리보기 (http://localhost:5173)
npm run build      # 타입체크 + 프로덕션 빌드 (dist/)
npm run preview    # 빌드 결과 미리보기
```

> 웹 미리보기에서는 AdMob 네이티브 플러그인이 동작하지 않으므로 배너는 플레이스홀더로,
> 보상형 광고는 즉시 보상 지급으로 시뮬레이션됩니다. TTS·효과음은 웹에서도 동작합니다.

## 폴더 구조

```
src/
├── assets/             # (public/assets 에 이미지·사운드 배치)
├── components/
│   ├── common/         # BigButton, StarBadge, ProgressBar, Confetti, AdBanner
│   ├── word/           # WordCard, ChoiceButton, TTSButton
│   └── shape/          # ShapeItem, ShapeIcon, ColorFilter
├── pages/              # Home, ModeSelect, WordGame, ShapeGame, Result, Settings
├── store/useGameStore.ts   # Zustand — 별, 진도, 출석, 설정
├── data/               # wordData.ts, shapeData.ts
├── hooks/              # useTTS.ts, useSound.ts
└── utils/admob.ts      # AdMob 초기화·배너·보상형 유틸
```

## 모바일 빌드 & 스토어 등록

자세한 절차는 [`docs/BUILD.md`](docs/BUILD.md) 를 참고하세요.

## 광고 설정

1. `.env.example` 을 `.env` 로 복사하고 AdMob 콘솔의 실제 광고 단위 ID를 입력합니다.
2. 개발 빌드에서는 Google 테스트 광고 ID가 자동 사용됩니다.
3. 프로덕션 빌드(`npm run build`)에서만 `.env` 의 ID가 사용됩니다.

## 라이선스/리소스 메모

- 그림: 현재 이모지로 렌더링. `public/assets/images/<word>.png` 에 이미지를 두면 자동으로 대체됩니다(상업 라이선스 확인 필수).
- 효과음: Web Audio API 합성음 사용(별도 에셋 불필요).
- [Google Play Family Policy](https://support.google.com/googleplay/android-developer/answer/9893335) 준수.
