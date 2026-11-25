@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if not exist "agent\__main__.py" (
  echo [오류] ZIP 압축을 먼저 풀고, 풀린 trend-shorts-agent 폴더 안에서 실행하세요.
  pause & exit /b 1
)
echo ==================================================
echo   트렌드 숏폼 에이전트 설치 (Windows)
echo ==================================================
echo.

echo [1/5] uv (파이썬 설치/관리 도구) 확인
where uv >nul 2>nul
if errorlevel 1 (
  powershell -ExecutionPolicy ByPass -NoProfile -Command "irm https://astral.sh/uv/install.ps1 | iex"
)
set "PATH=%USERPROFILE%\.local\bin;%PATH%"
where uv >nul 2>nul
if errorlevel 1 (
  echo [오류] uv 설치에 실패했습니다. 인터넷 연결을 확인하고 다시 실행하세요.
  pause & exit /b 1
)

echo [2/5] FFmpeg (영상 합성 프로그램) 확인
where ffmpeg >nul 2>nul
if errorlevel 1 (
  winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo [주의] FFmpeg 자동 설치 실패. https://www.gyan.dev/ffmpeg/builds/ 에서 full 빌드를 받아 PATH 에 추가하세요.
  )
)

echo [3/5] 파이썬과 필요한 부품 설치 (처음엔 몇 분 걸립니다)
uv venv --python 3.12 .venv
if errorlevel 1 ( echo [오류] 파이썬 환경 생성 실패 & pause & exit /b 1 )
uv pip install --python .venv\Scripts\python.exe -e ".[review]"
if errorlevel 1 ( echo [오류] 부품 설치 실패 & pause & exit /b 1 )

echo [4/5] 설정 파일 준비
if not exist .env copy .env.example .env >nul
if not exist data mkdir data

echo [5/5] 바탕화면에 실행 아이콘 만들기
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Trend Shorts Agent.lnk'); $s.TargetPath='%~dp0start_windows.bat'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%SystemRoot%\System32\imageres.dll,18'; $s.Save()"

echo.
echo 설치 완료! 바탕화면의 [Trend Shorts Agent] 아이콘을 더블클릭하세요.
echo (FFmpeg 를 방금 설치했다면 이 창을 닫고 아이콘으로 실행해야 인식됩니다)
pause
