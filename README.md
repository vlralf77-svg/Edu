# FitLog — 헬스 운동 기록·분석·코칭 앱 (MVP)

작업지시서(WBS v1.0) Phase 1 핵심 UX를 웹·모바일 하이브리드 앱으로 구현한 MVP입니다.
번핏의 "10초 룰" 기록 UX, 1RM 기반 강도 색상 코드, 분석 대시보드, 신체·식단 기록,
데이터 기반 코칭 카드를 하나의 앱에서 제공합니다.

## 스택

| 항목 | 기술 |
|---|---|
| 프론트엔드 | React 18 + Vite + TypeScript + MUI 6 |
| 상태관리 | Zustand (persist → localStorage) |
| 라우팅 | React Router (HashRouter) |
| 차트 | 내장 SVG (라인·레이더·캘린더 히트맵) |
| 모바일 패키징 | Capacitor (Android/iOS) |

## 구현 범위 (Phase 1 MVP)

### 화면
- **홈**: 오늘 요약 카드, 진행 중 세션 이어하기, 최근 운동, AI 코치 카드(규칙형), 이번 달 캘린더 히트맵, 빠른 시작 루틴
- **기록**: 프리 모드 / 루틴 시작 / 최근 세션 히스토리
- **세션 편집기**: 실시간 시간·볼륨, 종목별 세트 카드, **이전 세트 자동 참조 + 복사**, 세트 타입(일반/워밍업/드롭/실패), **1RM 대비 강도 % + 6단계 색상 배지**, 휴식 타이머(비프+진동, ±15초, 건너뛰기), 완료 시 컨디션 이모지·메모
- **종목 선택 다이얼로그**: 부위 필터·검색·다중 선택
- **루틴 편집기**: 종목 선택 → 세트/횟수/휴식 설정 후 저장
- **분석**: 기간 선택(1주/1개월/3개월/6개월), 볼륨 추이 라인, 부위별 볼륨 레이더, 예상 1RM 추이(종목 선택), 체중 추이, 연속 운동 기록
- **식단**: 날짜 선택, 목표 대비 kcal·PFC 프로그레스, 시간대별 타임라인, 음식 DB 자동완성(20종 샘플)
- **마이**: 프로필(닉네임·키·목표·경력·기본 휴식), 신체 기록(체중·체지방·골격근), 데이터 초기화

### 알고리즘
- **1RM 자동 계산**: `reps ≤ 12` → Epley·Brzycki 평균 / `reps > 12` → Epley
- **강도 6단계 색상**: 50/65/75/85/95% 경계 (WBS 3.1 사양)
- **연속 기록 스트릭**: 오늘부터 역행 카운트
- **볼륨 = Σ(중량 × 횟수)** (워밍업 세트도 표시상 포함, 1RM 계산에서는 제외)

### 시드 데이터
- 운동 종목 55+ 종 (부위·기구·주동근 태깅)
- 기본 루틴 4종 (PPL Push/Pull/Leg + 초보자 풀바디)
- 한국 대표 음식 20종 (kcal·P·C·F)

## 개발

```bash
npm install
npm run dev        # 브라우저 (http://localhost:5173)
npm run build      # tsc + vite build → dist/
npm run preview
npm run cap:sync   # Capacitor 동기화
```

## 폴더 구조

```
src/
├── components/
│   ├── common/     # LineChart, MuscleRadar, CalendarHeatmap
│   ├── layout/     # AppShell, BottomNav, PageHeader
│   └── record/     # ExerciseSetsCard, ExercisePickerDialog, RestTimer
├── data/           # exercises, foods, templates (시드 데이터)
├── pages/          # Home, Record, SessionEditor, Analytics, Meals, Profile, RoutineEditor
├── store/          # useAppStore (Zustand + persist)
├── types/          # 도메인 타입
├── utils/          # oneRepMax, format
└── theme.ts        # 다크 테마 (헬스장 조명 대응)
```

## WBS 대비 미구현 항목

Phase 1 이후 로드맵(WBS 섹션 3.5~3.10)은 서버·AI·소셜 인프라가 필요해 MVP에 포함하지 않았습니다:

- LLM 실연동 AI 코치 (현재 규칙 기반 카드)
- 헬스장 기구 이미지 인식 스캐너
- 백엔드 계정·동기화·소셜 피드
- 프로그램 엔진 (n주차 자동 배치, 디로드)
- 스마트워치 연동, 푸시 알림
- 슈퍼세트·드래그 정렬·눈바디 사진 비교 뷰

## 라이선스

MIT — 앱 아이콘/스플래시 자원은 별도 교체 필요.
