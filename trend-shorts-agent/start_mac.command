#!/bin/bash
cd "$(dirname "$0")" || exit 1
[ -x .venv/bin/python ] || { echo "install_mac.command 를 먼저 실행하세요"; read -r; exit 1; }
echo "제어판을 여는 중... 이 창을 닫으면 제어판이 꺼집니다 (자동 실행 예약은 계속 동작)"
.venv/bin/python -m agent app
