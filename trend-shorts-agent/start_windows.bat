@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo 아직 설치되지 않았습니다. install_windows.bat 을 먼저 실행하세요.
  pause & exit /b 1
)
echo 제어판을 여는 중입니다... 브라우저 창이 자동으로 열립니다.
echo 이 검은 창을 닫으면 제어판이 꺼집니다. (자동 실행 예약은 창을 닫아도 동작합니다)
".venv\Scripts\python.exe" -m agent app
pause
