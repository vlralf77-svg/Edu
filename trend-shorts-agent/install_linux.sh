#!/bin/bash
# 트렌드 숏폼 에이전트 설치 (Ubuntu/Debian)
set -e
cd "$(dirname "$0")"
sudo apt-get update && sudo apt-get install -y ffmpeg fonts-noto-cjk fluidsynth fluid-soundfont-gm curl
command -v uv >/dev/null || { curl -LsSf https://astral.sh/uv/install.sh | sh; export PATH="$HOME/.local/bin:$PATH"; }
[ -x .venv/bin/python ] || uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -e ".[review,publish]"
[ -f .env ] || cp .env.example .env
mkdir -p data
echo "설치 완료! ./start_linux.sh 로 제어판을 여세요."
