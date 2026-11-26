#!/bin/bash
# 트렌드 숏폼 에이전트 설치 (Mac) — Finder 에서 더블클릭
cd "$(dirname "$0")" || exit 1
echo "=== 트렌드 숏폼 에이전트 설치 (Mac) ==="
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew 가 필요합니다. https://brew.sh 의 설치 명령을 터미널에 붙여넣어 설치한 뒤 다시 실행하세요."
  read -r -p "엔터를 누르면 닫힙니다"; exit 1
fi
echo "[1/4] FFmpeg 설치 확인"; command -v ffmpeg >/dev/null || brew install ffmpeg
echo "[2/4] uv 설치 확인"; command -v uv >/dev/null || brew install uv
echo "[3/4] 파이썬 환경 설치"
{ [ -x .venv/bin/python ] || uv venv --python 3.12 .venv; } && uv pip install --python .venv/bin/python -e ".[review,publish]" || { echo "설치 실패"; read -r; exit 1; }
echo "[4/4] 설정 파일 준비"; [ -f .env ] || cp .env.example .env; mkdir -p data
chmod +x start_mac.command
echo; echo "설치 완료! start_mac.command 를 더블클릭하면 제어판이 열립니다."
read -r -p "엔터를 누르면 닫힙니다"
