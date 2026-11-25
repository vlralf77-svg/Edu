@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "agent\__main__.py" (
  echo [오류] 압축 파일 안에서 바로 실행한 것 같습니다. ZIP 을 마우스 오른쪽 ^> "압축 풀기" 한 뒤, 풀린 폴더에서 다시 실행하세요.
  pause & exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  echo 아직 설치되지 않았습니다. install_windows.bat 을 먼저 실행하세요.
  pause & exit /b 1
)
".venv\Scripts\python.exe" -m agent app
pause
