# 트렌드 숏폼 자동 제작 AI 에이전트 — 개발 명세서

> 이 문서는 Claude Code에게 전달하는 **개발 지시서**입니다.
> 프로젝트 루트에 `CLAUDE.md`로 복사하거나, Claude Code에서 "이 문서대로 프로젝트를 만들어줘"라고 요청하세요.
> Claude Code는 아래 **개발 단계(Phase)** 순서대로 구현하고, 각 Phase 완료 시 테스트를 통과시킨 뒤 다음으로 넘어갑니다.

---

## 1. 목표

매일 정해진 시간에 자동으로:

1. **수집** — 최근 24~48시간 내 업로드된 **조회수 10만 이상** YouTube 영상을 찾는다.
2. **분석** — 영상들의 주제·이슈를 묶고(클러스터링), 웹 검색으로 사실관계를 보강 조사한다.
3. **기획** — 주제별로 **60초 이내 숏폼 대본**을 작성하고, 제작 후보 리스트를 만든다.
4. **검토** — 사람이 리스트를 보고 제작할 항목을 승인한다. (기본값: 승인 필수)
5. **제작** — 승인된 대본으로 TTS 음성 + 이미지/영상 소스 + 자막을 합성해 **9:16 세로 MP4**를 만든다.
6. **(선택) 업로드** — YouTube Shorts에 비공개/예약 업로드한다.

### 핵심 원칙
- **원본 영상을 재사용하지 않는다.** 남의 영상은 "어떤 이슈가 뜨는지" 파악하는 용도로만 쓰고, 영상·음원·썸네일을 다운로드하거나 잘라 쓰지 않는다. 대본은 반드시 독자적으로 조사·재구성한다.
- 모든 사실 주장에는 출처 URL을 남긴다 (대본 메타데이터에 저장).
- 각 단계는 독립 실행 가능해야 한다 (`python -m agent collect`, `... research` 등). 중간 산출물은 파일/DB에 저장해 재실행·디버깅이 쉽게.

---

## 2. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 언어 | Python 3.11+ | `uv` 또는 `poetry`로 의존성 관리 |
| LLM | Anthropic Claude API (`anthropic` SDK) | 주제 분석·대본 작성·팩트체크 |
| 트렌드 수집 | YouTube Data API v3 | `search.list` + `videos.list`, 일일 쿼터 10,000 유닛 주의 |
| 웹 조사 | Claude API의 web search 툴 또는 Tavily/Serper API | 설정으로 교체 가능하게 |
| TTS | ElevenLabs / Google Cloud TTS / 타입캐스트 중 택1 | 어댑터 패턴으로 교체 가능하게 |
| 비주얼 소스 | Pexels/Pixabay API(무료 스톡) + 이미지 생성 API(선택) | 라이선스 정보 저장 |
| 영상 합성 | FFmpeg + MoviePy | 1080x1920, 30fps, H.264 `-preset veryfast` |
| 자막 | TTS 타임스탬프 또는 Whisper로 싱크 | 번인(burn-in) 자막, 한글 폰트(Pretendard/Noto Sans KR) |
| 저장소 | SQLite (SQLAlchemy) + `data/` 폴더 | 나중에 Postgres로 교체 가능 |
| 스케줄 | cron 또는 APScheduler | 기본 매일 07:00 KST |
| 검토 UI | Streamlit (간단) 또는 Google Sheets 연동 | Phase 4에서 선택 |
| 알림 | Slack/Telegram 웹훅 (선택) | 리스트 생성·제작 완료 알림 |

---

## 3. 디렉터리 구조

```
trend-shorts-agent/
├── CLAUDE.md                  # 이 문서
├── pyproject.toml
├── .env.example               # API 키 목록 (실제 키는 .env, git 제외)
├── config/
│   ├── settings.yaml          # 실행 시간, 조회수 기준, 카테고리, 지역 등
│   └── prompts/
│       ├── cluster_topics.md
│       ├── research.md
│       ├── write_script.md
│       └── fact_check.md
├── agent/
│   ├── __main__.py            # CLI 진입점 (typer)
│   ├── pipeline.py            # 전체 파이프라인 오케스트레이션
│   ├── collectors/
│   │   └── youtube.py         # 트렌드 영상 수집
│   ├── analysis/
│   │   ├── clustering.py      # 주제 묶기 + 점수화
│   │   └── research.py        # 웹 조사
│   ├── writing/
│   │   ├── script_writer.py   # 대본 생성
│   │   └── fact_checker.py    # 대본 검증
│   ├── production/
│   │   ├── tts/               # base.py + elevenlabs.py, google.py ...
│   │   ├── visuals.py         # 스톡/생성 이미지 확보
│   │   ├── subtitles.py
│   │   ├── bgm/
│   │   │   ├── mood.py        # 대본 → 분위기/템포 분석
│   │   │   ├── generator.py   # 절차적 작곡 (MIDI → WAV)
│   │   │   ├── library.py     # 로컬 무료 음원 라이브러리 검색
│   │   │   └── presets.yaml   # 분위기별 음악 파라미터
│   │   └── composer.py        # FFmpeg/MoviePy 합성
│   ├── publish/
│   │   └── youtube_upload.py  # (선택)
│   ├── review/
│   │   └── app.py             # Streamlit 검토 화면
│   ├── models.py              # DB 모델
│   ├── llm.py                 # Claude API 래퍼 (재시도, 토큰 로깅)
│   └── notify.py
├── data/
│   ├── runs/YYYY-MM-DD/       # 날짜별 산출물 (json, 음성, 이미지, mp4)
│   └── agent.db
├── assets/fonts/, assets/bgm/ # 라이선스 확인된 폰트·BGM만
└── tests/
```

---

## 4. 설정 (`config/settings.yaml`)

```yaml
schedule:
  timezone: Asia/Seoul
  run_at: "07:00"

collect:
  region_code: KR
  relevance_language: ko
  published_within_hours: 48
  min_view_count: 100000
  max_videos: 50
  include_shorts: true
  category_ids: []            # 비우면 전체. 예: [25(뉴스), 24(엔터), 28(과학기술)]
  exclude_keywords: ["도박", "성인"]

topics:
  max_topics_per_day: 10
  min_videos_per_topic: 1

script:
  max_seconds: 60
  target_chars_ko: 300        # 한국어 낭독 기준 약 280~320자 ≈ 55~60초
  tone: "친근하고 빠른 뉴스 브리핑"
  structure: [hook, context, key_points, closing]

production:
  resolution: [1080, 1920]
  fps: 30
  tts_provider: elevenlabs
  voice_id: ""
  visual_source: pexels      # pexels | pixabay | generated
  burn_subtitles: true

bgm:
  mode: generate              # generate(직접 생성) | library(로컬 라이브러리) | hybrid(라이브러리 우선, 없으면 생성)
  volume: 0.08                # 내레이션 대비 배경음 크기
  ducking_db: -12             # 말할 때 배경음 자동 감소
  fade_in_sec: 0.5
  fade_out_sec: 1.5
  soundfont: assets/soundfonts/FluidR3_GM.sf2   # MIT 라이선스 사운드폰트
  library_dir: assets/bgm/library               # 라이선스 확인된 곡만, 곡마다 license.json 필수
  avoid_repeat_days: 7        # 같은 곡/같은 시드 반복 방지

review:
  require_approval: true      # false면 상위 N개 자동 제작
  auto_produce_top_n: 3

publish:
  enabled: false
  privacy: private
```

---

## 5. 파이프라인 상세

### Step 1. 수집 (`collectors/youtube.py`)
- `search.list`로 `publishedAfter = now - 48h`, `regionCode=KR`, `order=viewCount` 검색 (카테고리/키워드별 여러 번).
- 결과 videoId를 50개씩 묶어 `videos.list(part=snippet,statistics,contentDetails)`로 조회수·길이·태그 확보.
- `mostPopular` 차트(`videos.list chart=mostPopular`)도 함께 수집 — 쿼터가 1유닛으로 저렴함. **이걸 1순위 소스로** 사용.
- `viewCount >= min_view_count` 필터, 중복 제거, 지난 7일 내 이미 처리한 영상 제외.
- 저장 필드: video_id, title, channel, published_at, view_count, like_count, comment_count, duration, tags, description(앞 500자), **시간당 조회수(views/hour)**.
- 쿼터 사용량을 로그로 남기고, 일일 한도의 80% 넘으면 중단.

### Step 2. 주제 클러스터링 (`analysis/clustering.py`)
- 영상 제목·설명·태그를 Claude에 넘겨 **이슈 단위로 묶기** (JSON 출력 강제).
- 주제별 점수 = 합산 조회수, 평균 views/hour, 영상 수, 숏폼 적합도(LLM 평가 1~5)의 가중합.
- 제외: 특정 개인 비방/사생활, 미확인 루머, 성인·도박·혐오, 저작권 콘텐츠 그 자체(예: 드라마 회차 요약).
- 출력: `topics.json` — `{topic_id, title, summary, related_video_ids, score, angle_ideas[]}`

### Step 3. 조사 (`analysis/research.py`)
- 상위 `max_topics_per_day`개 주제에 대해 웹 검색 3~5회.
- 뉴스·공식 발표 등 1차 출처 우선. 출처별 핵심 사실을 요약해 `research/{topic_id}.json`에 저장 (URL, 발행일, 사실 목록).
- 출처가 2개 미만이거나 서로 모순되면 `confidence: low` 표시 → 리스트에서 경고 표시.

### Step 4. 대본 작성 (`writing/script_writer.py`)
- 입력: 주제 + 조사 결과. **원본 영상 대사를 쓰지 않고** 조사 사실만으로 작성.
- 구조 (60초 기준):
  - **Hook (0~3초)**: 스크롤을 멈추게 하는 한 문장
  - **Context (3~15초)**: 무슨 일인지
  - **Key points (15~50초)**: 핵심 2~3개
  - **Closing (50~60초)**: 한 줄 정리 + 질문/구독 유도
- 출력 JSON (장면 단위):
```json
{
  "topic_id": "...",
  "title": "영상 제목 후보 (40자 이내)",
  "hashtags": ["#..."],
  "estimated_seconds": 57,
  "scenes": [
    {"idx": 1, "narration": "...", "on_screen_text": "...", "visual_query": "stock search keyword (영문)", "seconds": 3}
  ],
  "sources": ["https://..."],
  "risk_notes": "법적/윤리적 주의사항"
}
```
- 글자 수로 길이 검증: 총 낭독 글자수 > `target_chars_ko * 1.1`이면 자동 재작성 (최대 2회).

### Step 5. 팩트체크 (`writing/fact_checker.py`)
- 대본의 각 문장을 조사 결과와 대조 → 근거 없는 문장은 수정 또는 삭제.
- 명예훼손 소지(실명 + 단정적 부정 표현), 의료·투자 조언성 문장 플래그.

### Step 6. 리스트업 + 검토 (`review/app.py`)
- 매일 `data/runs/YYYY-MM-DD/shortlist.md` 와 DB에 저장:
  - 순위, 주제, 점수, 근거 영상(링크/조회수), 대본 미리보기, 예상 길이, 출처, 리스크 플래그
- Streamlit 화면에서: 대본 수정 / 승인 / 반려 / 보류.
- 알림(Slack/Telegram)으로 "오늘의 후보 N개" 전송.
- `require_approval: false`면 리스크 플래그 없는 상위 N개 자동 승인.

### Step 7. 영상 제작 (`production/`)
1. **TTS**: 장면별 음성 생성 → 실제 길이 측정 → 총 60초 초과 시 말속도 조정 또는 대본 축약 요청.
2. **비주얼**: 장면별 `visual_query`로 스톡 영상/이미지 검색 → 세로 크롭. 라이선스·출처 메타데이터 저장. 실패 시 단색 배경 + 키워드 타이포그래피로 대체.
3. **자막**: TTS 타임스탬프(또는 Whisper) 기반 SRT 생성 → 한 줄 최대 14자, 화면 중앙 하단, 외곽선.
4. **배경음악**: Step 7-1대로 주제 분위기에 맞는 저작권 안전 BGM을 생성 → 영상 길이에 맞춰 `bgm.wav`.
5. **합성**: 장면 클립 + 켄번스(줌/팬) 효과 + 자막 번인 + `on_screen_text` 상단 타이틀 + BGM(덕킹) → `final.mp4`.
6. **썸네일/메타**: 제목, 설명(출처 포함), 해시태그 → `meta.json`.
7. 산출물 검증: 길이 ≤ 60초, 해상도 1080x1920, 오디오 피크 확인. 실패 시 상태 `failed` + 로그.

### Step 7-1. 주제 맞춤 배경음악 생성 (`production/bgm/`)

**원칙: 남이 만든 곡을 가져오지 않고, 코드로 직접 작곡해서 저작권을 우리가 갖는다.**
멜로디·코드 진행·리듬을 프로그램이 매번 새로 만들고, 소리는 자유 라이선스 사운드폰트로 렌더링한다. 그래서 Content ID 오탐이나 라이선스 분쟁이 생길 여지가 거의 없다.

#### (1) 분위기 분석 — `mood.py`
- 승인된 대본을 Claude에 넘겨 JSON으로 받는다:
```json
{"mood": "tense", "energy": 0.7, "tempo_bpm": 118, "key": "D minor", "reason": "사건·사고 속보"}
```
- 분위기 카테고리(고정 목록 중 택1):

| mood | 어울리는 주제 | 템포 | 조성 | 악기 구성 (GM 프로그램) |
|---|---|---|---|---|
| `upbeat` | 연예·트렌드·밈·신제품 | 115~128 | 장조 | 신스 리드, 일렉 피아노, 베이스, 드럼 |
| `news` | 정치·경제·사회 일반 | 95~110 | 단조/중립 | 피아노 아르페지오, 스트링 패드, 가벼운 퍼커션 |
| `tense` | 사건·사고·논란 | 100~120 | 단조 | 저음 스트링, 펄스 신스, 킥 위주 |
| `inspiring` | 스포츠·성공·감동 | 90~105 | 장조 | 피아노, 스트링, 팀파니 |
| `calm` | 생활정보·건강·날씨 | 75~90 | 장조 | 어쿠스틱 기타, 패드, 소프트 드럼 |
| `tech` | IT·과학·AI | 110~124 | 단조/도리안 | 신스 아르페지오, 패드, 일렉 드럼 |
| `funny` | 웃긴 사건·동물 | 120~135 | 장조 | 피치카토, 마림바, 경쾌한 드럼 |
| `sad` | 추모·재난 | 65~80 | 단조 | 피아노 솔로, 첼로 패드 (드럼 없음) |

- `sad`(추모·재난) 주제는 볼륨을 0.05로 낮추고, 사용자 설정으로 BGM 없이 내보낼 수도 있게 한다.

#### (2) 절차적 작곡 — `generator.py`
- 라이브러리: `pretty_midi`(MIDI 생성) + `fluidsynth`(렌더링) + `pydub`/FFmpeg(후처리).
- 입력: mood 프리셋 + 영상 길이(초) + 시드(run 날짜 + topic_id 해시).
- 작곡 로직:
  1. 프리셋에서 코드 진행 후보 중 하나를 시드로 선택 (예: `news` → i–VI–III–VII, `upbeat` → I–V–vi–IV). 코드 진행 자체는 저작권 대상이 아님.
  2. 4마디 또는 8마디 루프 구성: 베이스(코드 근음), 패드(코드 톤), 아르페지오/리듬 패턴, 드럼 패턴(프리셋별 템플릿 + 시드 기반 변형).
  3. 간단한 멜로디(선택): 코드 톤 위주로 스케일 내에서 랜덤 워크, 내레이션을 가리지 않게 **중음역 회피**, 음량 낮게.
  4. 구조: 인트로(1마디, 드럼 없음) → 본문 반복 → 엔딩(마지막 코드 홀드 + 페이드). 영상 길이에 맞게 마디 수 계산.
  5. 대본의 Hook 구간(0~3초)에는 임팩트(심벌/라이저) 1회 배치.
- 렌더링: `FluidR3_GM.sf2`(MIT 라이선스)로 WAV 44.1kHz 렌더 → 노멀라이즈(-16 LUFS 근처) → 페이드 인/아웃.
- 메타데이터 `bgm_meta.json` 저장: mood, bpm, key, 진행, 시드, 사운드폰트명·라이선스, 생성 일시. → **"직접 생성한 음악"임을 증명하는 기록**.
- 같은 시드는 `avoid_repeat_days` 동안 재사용 금지.

#### (3) 로컬 라이브러리 (선택, `mode: library | hybrid`) — `library.py`
- 사람이 직접 다운로드해 넣은 무료 음원만 사용. 곡마다 `license.json` 필수:
```json
{"title": "...", "source": "YouTube 오디오 보관함", "license": "출처 표기 불필요", "attribution": "", "mood": ["news", "tense"], "bpm": 105}
```
- `license.json`이 없거나 라이선스가 "비상업", "NC", "ND" 계열이면 **로딩 거부**.
- 출처 표기가 필요한 곡은 `meta.json` 설명란에 표기 문구 자동 추가.
- 에이전트가 인터넷에서 음원을 **자동 다운로드하지 않는다** (라이선스 확인을 사람이 하도록).

#### (4) 믹싱 — `composer.py`에서 처리
- 내레이션 구간 사이드체인 덕킹(`ducking_db`), 문장 사이 공백에서 살짝 올라옴.
- BGM 길이 = 영상 길이 + 0.5초, 끝에서 `fade_out_sec` 페이드.
- 최종 믹스 라우드니스 -14 LUFS (YouTube 기준) 근처로 맞춤.

#### (5) 사용하지 말 것
- 유명 곡을 흉내 내도록 하는 생성(특정 곡·아티스트 이름을 프롬프트에 넣는 것 포함)
- 라이선스가 비상업용(예: CC-BY-NC)인 AI 음악 모델의 출력 — 수익화 채널에서 문제됨. AI 음악 생성 API를 추가하려면 상업적 이용 허용 여부를 사람이 확인한 뒤 어댑터로 붙인다.
- 출처를 알 수 없는 "무료 BGM" 모음 파일

#### (6) 테스트
- mood 8종 각각 30초·60초 BGM 생성 → 길이 오차 ±0.2초, 클리핑 없음, 무음 아님.
- 같은 시드 → 같은 결과(재현성), 다른 시드 → 다른 결과.
- `license.json` 누락/NC 라이선스 곡 로딩 거부 테스트.

### Step 8. (선택) 업로드 (`publish/youtube_upload.py`)
- OAuth 2.0으로 `videos.insert`, 기본 **비공개**. 사람이 확인 후 공개 전환.
- AI 생성 콘텐츠 표기(합성 미디어 공개) 설정을 메타에 포함.

---

## 6. 데이터 모델 (SQLite)

- `runs` (id, date, status, started_at, finished_at, quota_used, cost_usd)
- `videos` (video_id PK, title, channel, published_at, view_count, views_per_hour, collected_at)
- `topics` (id, run_id, title, summary, score, status)
- `topic_videos` (topic_id, video_id)
- `scripts` (id, topic_id, version, json, char_count, est_seconds, risk_flags, approval_status)
- `productions` (id, script_id, status, video_path, duration, error, created_at)

상태 흐름: `collected → clustered → researched → scripted → checked → pending_review → approved → producing → produced → (uploaded)`

---

## 7. CLI

```bash
python -m agent run-daily              # 1~6단계 전체 (제작은 승인 대기)
python -m agent collect
python -m agent cluster --run 2026-11-25
python -m agent research --run 2026-11-25
python -m agent write --run 2026-11-25
python -m agent review                 # Streamlit 실행
python -m agent produce --script-id 12 # 승인된 대본 제작
python -m agent produce --approved     # 승인된 것 전부 제작
python -m agent publish --production-id 5
```

---

## 8. 개발 단계 (Claude Code는 이 순서대로)

- **Phase 1 — 뼈대**: 프로젝트 구조, 설정 로더, `.env.example`, DB 모델, CLI, 로깅, `llm.py`(재시도·비용 로깅). ✅ `pytest` 통과
- **Phase 2 — 수집**: YouTube 수집기 + 쿼터 관리 + 중복 제거. API 응답은 mock 테스트. ✅ 실제 키로 `collect` 실행 시 영상 목록 JSON 생성
- **Phase 3 — 분석·대본**: 클러스터링, 웹 조사, 대본 작성, 팩트체크. 프롬프트는 `config/prompts/`의 md 파일로 분리. ✅ `shortlist.md` 생성, 모든 대본 300자 내외
- **Phase 4 — 검토 UI + 알림**: Streamlit 화면, 승인 상태 반영. ✅ 승인/반려가 DB에 반영
- **Phase 5 — 제작**: TTS 어댑터, 스톡 비주얼, 자막, 합성. ✅ 샘플 대본 1개로 60초 이내 1080x1920 MP4 생성
- **Phase 5-1 — 배경음악**: 분위기 분석, 절차적 작곡, 라이브러리 로더, 덕킹 믹스. 시스템 패키지 `fluidsynth` 설치 포함. ✅ mood 8종 샘플 WAV 생성 + 최종 영상에 BGM 믹스
- **Phase 6 — 스케줄링**: cron/APScheduler 설정, 실패 시 알림, 하루 1회 실행 보장(락 파일). ✅ 설정 시간에 자동 실행
- **Phase 7 — 업로드(선택)**: OAuth, 비공개 업로드.

각 Phase가 끝나면: 무엇을 만들었는지 요약, 실행 방법, 남은 TODO를 `docs/PROGRESS.md`에 기록.

---

## 9. 프롬프트 초안

### `write_script.md`
```
너는 한국어 숏폼 뉴스 브리핑 작가다.
아래 [조사 자료]에 있는 사실만 사용해 60초 이내(낭독 기준 280~320자) 대본을 써라.
- 원본 영상의 문장·표현을 그대로 쓰지 말 것
- 첫 문장은 3초 안에 호기심을 만드는 훅
- 문장은 짧게, 구어체, 숫자는 읽기 쉽게
- 확인되지 않은 내용은 쓰지 말 것. 논란 사안은 양측 입장을 균형 있게
- 장면 4~7개로 나누고, 장면마다 화면 텍스트(12자 이내)와 스톡 검색어(영문)를 제시
- 출력은 지정된 JSON 스키마만
[주제] {topic}
[조사 자료] {research}
```

### `cluster_topics.md`
```
아래는 최근 48시간 조회수 상위 영상 목록이다. 같은 이슈를 다루는 영상끼리 묶고,
각 이슈의 한 줄 요약, 숏폼 적합도(1~5), 새로운 관점 아이디어 2개를 JSON으로 출력하라.
개인 사생활·미확인 루머·선정적 주제는 excluded로 표시하라.
```

---

## 10. 비기능 요구사항

- **비밀정보**: API 키는 `.env`에만, 커밋 금지. `.gitignore`에 `.env`, `data/`, `*.mp4` 포함.
- **비용 관리**: LLM 토큰·TTS 글자수·API 호출 수를 run 단위로 집계해 `runs.cost_usd`에 기록. 일일 상한(`max_daily_cost_usd`) 초과 시 중단.
- **재시도**: 외부 API는 지수 백오프 3회. 한 주제 실패가 전체를 멈추지 않게.
- **멱등성**: 같은 날짜로 재실행 시 이미 완료된 단계는 건너뜀 (`--force`로 강제).
- **로그**: `data/runs/DATE/run.log` + 콘솔. 단계별 소요시간 기록.
- **테스트**: 외부 API는 전부 mock. 대본 길이 검증, 클러스터 JSON 파싱, 합성 결과 길이 검증 테스트 포함.

---

## 11. 법적·정책 체크리스트

- [ ] 타인 영상/음원/썸네일을 다운로드·재편집하지 않음 (트렌드 파악용 메타데이터만 사용)
- [ ] 스톡 소스·폰트의 라이선스 기록
- [ ] BGM은 직접 생성(`bgm_meta.json` 보관) 또는 `license.json`이 있는 라이브러리 곡만 사용
- [ ] 첫 업로드 몇 편은 비공개로 올려 Content ID 경고가 없는지 확인
- [ ] 대본에 출처 표기 (영상 설명란)
- [ ] 실명 인물 관련 단정적 부정 표현 금지, 의료·투자 조언 금지
- [ ] YouTube 정책: AI 합성 콘텐츠 공개 설정, 반복적·대량생산 콘텐츠(재사용 콘텐츠) 정책 확인
- [ ] YouTube Data API 이용약관 준수 (데이터 보관 기간 등)

---

## 12. 첫 요청 예시 (Claude Code에 입력)

```
이 CLAUDE.md를 읽고 Phase 1부터 시작해줘.
각 Phase가 끝나면 테스트를 돌리고 docs/PROGRESS.md를 업데이트한 뒤 멈춰서 나한테 확인받아.
TTS는 일단 ElevenLabs로, 검토 UI는 Streamlit으로 해줘.
```
