# 개발 진행 기록

> 기준일: 2026-11-25 · 테스트: `pytest` **84개 통과** (외부 API 전부 mock, FFmpeg/fluidsynth 실제 실행 포함)
> 빠른 테스트만: `pytest -m "not slow"` (1~2초) · 전체: `pytest` (약 80초)

## 공통 실행 준비

```bash
cd trend-shorts-agent
uv venv && uv pip install -e ".[dev,review]"        # 업로드까지 쓰려면 ".[dev,review,publish]"
sudo apt install ffmpeg fluidsynth fluid-soundfont-gm fonts-noto-cjk
cp .env.example .env                                 # 키 입력
```

---

## Phase 1 — 뼈대 ✅
**만든 것**
- `agent/config.py`: `config/settings.yaml` + `.env` → pydantic 검증 `Settings`, 프롬프트 로더(`config/prompts/*.md`)
- `agent/models.py`: runs / videos / topics / topic_videos / scripts / productions (+ BGM 반복 방지용 `bgm_history`)
- `agent/llm.py`: Claude 래퍼 — SDK 지수 백오프 재시도(3회), 토큰·웹검색 비용 집계, structured output(JSON 스키마) /
  텍스트 JSON 추출, web search 서버 툴, `pause_turn` 이어받기, 거절(refusal) 감지
  - 기본 모델 `claude-opus-5-5`, effort `medium`, 거절 시 서버 측 대체 모델(`fallbacks: default`) 사용 → `settings.llm.fallbacks: null` 로 끌 수 있음
- `agent/costs.py`: run 단위 비용/사용량 집계, `budget.max_daily_cost_usd` 초과 시 `BudgetExceeded` 로 중단 (같은 날 재실행해도 누적)
- `agent/context.py`: run 컨텍스트(DB 세션·비용·산출물 경로·상태), `agent/logging_setup.py`: 콘솔 + `data/runs/DATE/run.log`, 단계별 소요시간
- `agent/__main__.py`: typer CLI

## Phase 2 — 수집 ✅ (mock 기준)
- `collectors/youtube.py`: `mostPopular` 차트(1유닛)를 1순위로, `search.list`(100유닛) 보조 → `videos.list` 50개 단위 상세 조회
- 쿼터: 일일 한도의 80% 도달 시 즉시 중단하고 그때까지의 결과로 진행, `runs.quota_used` 에 누적
- 필터: 조회수 ≥ 10만, 48시간 이내, 제외 키워드, 쇼츠 포함 여부, 중복 제거, **지난 7일간 다른 run 에서 주제로 처리된 영상 제외**
- 저장: DB `videos` + `data/runs/DATE/videos.json` (시간당 조회수 포함, 설명 500자). 영상·썸네일은 다운로드하지 않음
- 실행: `python -m agent collect`
- ⚠️ **실제 키로는 아직 실행해 보지 않음** — `YOUTUBE_API_KEY` 넣고 `collect` 한 번 돌려 확인 필요

## Phase 3 — 분석·대본 ✅ (mock 기준)
- `analysis/clustering.py`: Claude structured output 으로 이슈 묶기 → 존재하지 않는 영상 id·중복 배정 제거, 제외 주제(`topics_excluded.json`) 분리,
  점수 = log 정규화한 합산 조회수·평균 views/hour·영상 수·적합도의 가중합 (`topics.weights`)
- `analysis/research.py`: provider `claude`(web search 툴) | `tavily` | `serper`. **검색 결과에 실제 등장한 URL 만 인정**(모델이 지어낸 URL 제거),
  유튜브·SNS 출처 제외, 도메인 2개 미만 또는 모순 시 `confidence: low`
- `writing/script_writer.py`: 조사 자료만으로 장면 JSON 작성, 공백 제외 글자 수 기준 길이 검증(목표의 80~110% 밖이면 최대 2회 재작성),
  제목 40자/화면텍스트 12자/해시태그 정리, 출처는 조사 자료 URL 로 제한
- `writing/fact_checker.py`: 조사 대조 수정 + 플래그(defamation/medical/investment/unsupported/sensitive) + 규칙 기반 안전망 + low_confidence/length
- 한 주제 실패가 전체를 멈추지 않음(해당 주제만 `failed`), 단계별 멱등(`--force` 로 강제)
- 실행: `python -m agent run-daily` 또는 `cluster` / `research` / `write` 개별 → `data/runs/DATE/shortlist.md`
- ⚠️ 실제 Claude 호출로 대본 품질(300자 내외 달성률)은 아직 확인 안 함 — 첫 실행 후 프롬프트 튜닝 필요할 수 있음

## Phase 4 — 검토 UI + 알림 ✅
- `review/actions.py`: 후보 조회, 승인/반려/보류, 수정(새 버전으로 저장, 이전 버전 `superseded`), 자동 승인(`require_approval: false` 시 차단 플래그 없는 상위 N개)
- `review/app.py`: Streamlit — 날짜 선택, 상태 필터, 장면별 내레이션 수정, 리스크·출처·근거 영상 표시, 승인/보류/반려/수정 저장 버튼
  (AppTest 로 승인 버튼 → DB 반영 확인)
- `notify.py`: Slack / Telegram 웹훅 (없으면 로그만). 후보 생성·제작 완료·실패 시 전송
- 실행: `python -m agent review` (브라우저) / 터미널: `python -m agent candidates`, `python -m agent decide 12 approve`

## Phase 5 — 제작 ✅
- `production/tts/`: 어댑터 `elevenlabs`(with-timestamps 문자 정렬 → 단어 타임스탬프) / `google`(선택) / `dummy`(오프라인 테스트용)
- 60초 초과 시 말속도 자동 조정(상한 `max_tts_speed` 1.15배), 그래도 넘으면 `failed` + "대본 축약 필요"
- `production/visuals.py` — **실제 영상·사진으로 화면 채우기** (2026-11-25 개선)
  - 대본의 장면마다 `visual_query`(촬영 가능한 구체적 장면, 영문) + `visual_subject`(보여줄 실존 인물·기관·장소의 영문 위키백과 표기)
  - 우선순위 `production.visual_sources`: ① Wikimedia Commons 인물·기관 사진(CC0/PD/CC BY/BY-SA 만, NC·ND·로고 제외, 키 불필요)
    ② Pexels **영상 클립** ③ Pixabay **영상 클립** ④ Pexels/Pixabay 사진 ⑤ (최후) 타이포그래피 카드
  - 같은 인물 사진은 한 영상에 최대 2장, 같은 클립/사진 재사용 없음, 클립은 세로·HD 우선·80MB 상한
  - 영상 클립: 9:16 크롭 + 장면 길이에 맞춰 반복/자르기 + 원본 소리 제거 + 은은한 줌. 가로 인물 사진: 얼굴이 안 잘리게 흐린 배경 위 가운데 배치
  - 설명란에 출처 자동 표기 (`"파일명" by 작가, 라이선스, via Wikimedia Commons URL` — CC BY 계열 표기 의무 충족)
  - ⚠️ 이 개발 환경은 외부망이 막혀 있어 Pexels/Pixabay/Commons 실제 호출은 못 해봤고 API 문서 형식대로 구현 + mock 테스트만 함
  - 뉴스 방송 화면·다른 유튜버 영상·기사 사진은 저작권 때문에 쓰지 않음 (특정 사건 '그 현장' 영상은 얻을 수 없고, 비슷한 분위기의 실사 클립으로 대체)
- `production/subtitles.py`: 단어 타임스탬프 → SRT + ASS(한 줄 14자, 중앙 하단, 외곽선)
- `production/composer.py`: 장면별 켄번스(줌인/줌아웃/좌우·상하 팬 순환) + 상단 타이틀 → 연결 → 자막 번인 → loudnorm -14 LUFS, H.264 veryfast
- 산출물: `final.mp4`, `meta.json`(제목·설명(출처/이미지 크레딧/AI 공개 문구)·해시태그·합성 미디어 표기), `subtitles.srt`, `bgm.wav`, `bgm_meta.json`
- 검증: 길이 ≤ 60초, 1080x1920, 오디오 존재·피크 < 0 dB·무음 아님 → 실패 시 `productions.status = failed` + 오류
- **키 없이 확인**: `python -m agent sample` → 샘플 대본으로 51초 1080x1920 MP4 생성 확인 (−13.9 LUFS)

## Phase 5-1 — 배경음악 ✅
- `bgm/mood.py`: Claude 로 8종 분위기 + 템포/키 (범위 밖 값 보정), 실패 시 키워드 휴리스틱
- `bgm/generator.py`: 프리셋(`presets.yaml`) + 시드(run 날짜 + topic_id) → 코드 진행·베이스·패드·아르페지오·드럼·(고음역) 멜로디 작곡,
  인트로 1마디(드럼 없음) → 본문 → 엔딩 홀드, Hook 3초 안에 심벌/팀파니 임팩트 1회(sad 제외) → fluidsynth(FluidR3_GM, MIT) 렌더 →
  정확한 길이(영상+0.5초)·RMS 노멀라이즈·피크 −1 dBFS·페이드 → `bgm_meta.json`(직접 생성 증빙)
- 같은 시드 `avoid_repeat_days` 동안 재사용 금지(`bgm_history`)
- `bgm/library.py`: 곡마다 `<곡>.license.json` 필수(폴더 단위 `license.json` 은 곡 1개일 때만), NC/ND/비상업 → 거부, 자동 다운로드 없음
- 믹싱: 내레이션 −18 dBFS 정규화, BGM 은 말하는 동안 `volume`(0.08 ≈ −22 dB) 수준, 공백에서는 `ducking_db` 만큼 부드럽게 복귀(0.12초 램프)
- `sad` 는 볼륨 0.05, `sad_disable: true` 면 BGM 없이
- 실행: `python -m agent bgm-samples` → `data/bgm_samples/<mood>/bgm.wav` 8종

## Phase 6 — 스케줄링 ✅
- `scheduler.py`: `fcntl` 락 파일(`data/daily.lock`)로 동시 실행 방지 + 날짜별 완료 마커로 하루 1회 보장, 실패 시 알림(마커 없음 → 재시도 가능)
- 방법 1 (상주): `python -m agent schedule` — APScheduler, 매일 `schedule.run_at` (Asia/Seoul), 시작 시점에 오늘 실행이 빠졌으면 즉시 1회
- 방법 2 (cron): `python -m agent crontab` 출력 줄을 `crontab -e` 에 추가 (`daily-job` 명령 사용)
- `require_approval: false` 면 자동 승인된 대본을 같은 실행에서 바로 제작

## Phase 7 — 업로드(선택) 🟡 코드만
- `publish/youtube_upload.py`: OAuth(설치형 앱 플로우, 토큰 `data/youtube_token.json`), `videos.insert` 재개 가능 업로드, 기본 **비공개**,
  `containsSyntheticMedia: true`, 제목에 `#shorts`
- 실행: `settings.yaml` 의 `publish.enabled: true` → `python -m agent publish --production-id 5`
- ⚠️ 실제 업로드는 테스트하지 않음 (요청 바디만 단위 테스트)

---

## 남은 TODO / 확인 필요
- [ ] 실제 키로 1회 실행: `collect` → `run-daily` → 검토 → `produce` (YouTube / Anthropic / ElevenLabs / Pexels)
- [ ] ElevenLabs `voice_id` 설정 (한국어 보이스), 실제 낭독 속도에 맞춰 `script.chars_per_second` 보정 (현재 5.2자/초 가정)
- [ ] 첫 실행 대본 품질 확인 후 `config/prompts/*.md` 튜닝
- [ ] Pexels/Pixabay/Commons 실제 키로 1회 확인 (영상 클립 검색어 품질 점검)
- [ ] 공식 보도자료 사진(기업·기관 뉴스룸) 소스 추가 검토 — 사이트별 이용 조건 확인 필요
- [ ] Whisper 기반 자막 싱크 (Google TTS 는 현재 글자 비례 추정)
- [ ] 라우드니스: 현재 loudnorm 1-pass. 필요하면 2-pass 로 정확도 향상
- [ ] 첫 업로드 몇 편은 비공개로 올려 Content ID 경고 여부 확인 (법적·정책 체크리스트)
