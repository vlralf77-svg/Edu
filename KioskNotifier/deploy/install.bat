@echo off
setlocal
REM KioskNotifier 배포 스크립트
REM 실행 파일과 appsettings.json 을 %LOCALAPPDATA%\KioskNotifier 에 복사 후 실행

set "DEST=%LOCALAPPDATA%\KioskNotifier"
set "SRC=%~dp0"

if not exist "%DEST%" mkdir "%DEST%"

echo [1/3] Copying KioskNotifier.exe ...
copy /Y "%SRC%KioskNotifier.exe" "%DEST%\KioskNotifier.exe" >nul
if errorlevel 1 (
    echo    ERROR: KioskNotifier.exe copy failed.
    goto :err
)

echo [2/3] Copying appsettings.json ...
if exist "%DEST%\appsettings.json" (
    echo    - existing appsettings.json preserved.
) else (
    if exist "%SRC%appsettings.json" (
        copy /Y "%SRC%appsettings.json" "%DEST%\appsettings.json" >nul
    )
)

echo [3/3] Registering HKCU\Run autostart ...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
    /v "KioskNotifier" /t REG_SZ /d "\"%DEST%\KioskNotifier.exe\"" /f >nul

echo.
echo Installed to %DEST%
echo Launching...
start "" "%DEST%\KioskNotifier.exe"
echo Done.
exit /b 0

:err
echo Install failed.
exit /b 1
