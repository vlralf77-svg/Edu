# 트렌드 숏폼 자동 제작 AI 에이전트

매일 YouTube 트렌드(최근 48시간·조회수 10만+)를 수집해 이슈별로 묶고, 웹으로 사실관계를 조사해
60초 이내 한국어 숏폼 대본을 쓰고, 사람이 승인한 대본을 **TTS + 스톡 이미지 + 자막 + 직접 작곡한 BGM** 으로
1080x1920 MP4 로 만듭니다. 남의 영상·음원·썸네일은 트렌드 파악용 메타데이터로만 쓰고 재사용하지 않습니다.

- 전체 명세: [`CLAUDE.md`](CLAUDE.md) · 진행 상황/TODO: [`docs/PROGRESS.md`](docs/PROGRESS.md)

## 내 PC 프로그램으로 쓰기 (서버 불필요) — 권장

1. `install_windows.bat` (Mac: `install_mac.command`, Linux: `install_linux.sh`) 더블클릭
2. 바탕화면 **Trend Shorts Agent** 아이콘 → 브라우저에 제어판이 열림
3. ⚙️ 설정에서 API 키 입력 (분석·대본 AI 는 기본이 **Google Gemini 무료 등급** — Claude 유료로 바꿀 수 있음) → 🏠 홈에서 분석 시작 → ✅ 검토 → 영상 제작 → 🎬 만든 영상에서 저장

자세한 설명: [`docs/INSTALL.md`](docs/INSTALL.md)

## 빠른 시작 (개발자용 터미널)

```bash
cd trend-shorts-agent
uv venv && uv pip install -e ".[dev,review]"
sudo apt install ffmpeg fluidsynth fluid-soundfont-gm fonts-noto-cjk
cp .env.example .env            # ANTHROPIC_API_KEY, YOUTUBE_API_KEY, ELEVENLABS_API_KEY, PEXELS_API_KEY ...
# settings.yaml 의 production.voice_id 에 ElevenLabs 보이스 ID 입력

python -m agent sample          # 키 없이: 샘플 대본 → data/runs/0000-sample/.../final.mp4
python -m agent run-daily       # 수집→클러스터→조사→대본→팩트체크→ data/runs/<오늘>/shortlist.md
python -m agent review          # Streamlit 에서 승인/반려/수정
python -m agent produce --approved
```

## 흐름

```
collect ─▶ cluster ─▶ research ─▶ write ─▶ fact_check ─▶ shortlist ─▶ (사람 검토) ─▶ produce ─▶ (publish)
YouTube    Claude      Claude       Claude    Claude        md + 알림     Streamlit      TTS·이미지·자막·BGM·FFmpeg
```

상태: `collected → clustered → researched → scripted → checked → pending_review → approved → producing → produced → (uploaded)`

## 주요 명령

| 명령 | 설명 |
|---|---|
| `run-daily [--run DATE] [--force]` | 1~6단계 (완료 단계는 건너뜀) |
| `collect` / `cluster` / `research` / `write` | 단계별 실행 |
| `review` / `candidates` / `decide ID approve` | 검토 (웹 / 터미널) |
| `produce --script-id ID` / `--approved` | 영상 제작 |
| `app` | 통합 제어판 (프로그램 화면) |
| `doctor` | 이 PC 준비 상태 점검 |
| `schedule-install` / `schedule-uninstall` | 이 PC 예약 작업에 매일 자동 실행 등록/해제 |
| `bgm-samples` | 분위기 8종 샘플 BGM |
| `schedule` / `daily-job` / `crontab` | 매일 07:00 KST 자동 실행 |
| `publish --production-id ID` | (선택) 비공개 업로드 |

## 테스트

```bash
.venv/bin/pytest -m "not slow"   # 빠른 단위 테스트
.venv/bin/pytest                 # FFmpeg·fluidsynth 실제 렌더 포함 (약 80초)
```
