"""제어판 실행기: Streamlit 서버를 띄우고 준비되면 브라우저를 연다.

- 처음 실행 시 Streamlit 이 콘솔에서 이메일을 묻고 멈추는 문제 → headless 모드 + 직접 브라우저 열기
- 8501 포트가 이미 쓰이면 다음 빈 포트 사용 (이미 제어판이 떠 있으면 그 창을 다시 열기)
- 실패하면 원인과 해결 방법을 콘솔에 표시
"""
from __future__ import annotations

import importlib.util
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

from ..config import PROJECT_ROOT

APP = Path(__file__).parent / "app.py"


def _port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def _is_our_panel(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/_stcore/health", timeout=2) as r:
            return r.status == 200
    except OSError:
        return False


def _wait_ready(port: int, proc: subprocess.Popen, timeout: float = 90) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        if proc.poll() is not None:
            return False
        if _is_our_panel(port):
            return True
        time.sleep(0.5)
    return False


def launch(port: int = 8501, open_browser: bool = True) -> int:
    if importlib.util.find_spec("streamlit") is None:
        print("[오류] 제어판 부품(streamlit)이 설치되지 않았습니다. 설치 프로그램(install_windows.bat 등)을 다시 실행하세요.")
        return 1
    if not _port_free(port):
        if _is_our_panel(port):
            url = f"http://localhost:{port}"
            print(f"제어판이 이미 실행 중입니다 → {url} 을 엽니다.")
            if open_browser:
                webbrowser.open(url)
            return 0
        while not _port_free(port):
            port += 1
    url = f"http://localhost:{port}"
    print("제어판을 준비하는 중입니다... (처음엔 10~30초 걸릴 수 있습니다)")
    cmd = [sys.executable, "-m", "streamlit", "run", str(APP), "--server.port", str(port),
           "--server.address", "localhost", "--server.headless", "true", "--browser.gatherUsageStats", "false"]
    proc = subprocess.Popen(cmd, cwd=PROJECT_ROOT, stdin=subprocess.DEVNULL)
    if not _wait_ready(port, proc):
        code = proc.poll()
        print(f"[오류] 제어판이 시작되지 않았습니다 (종료 코드 {code}). 위에 출력된 오류 메시지를 확인하세요.")
        if code is None:
            proc.terminate()
        return 1
    print(f"\n✔ 제어판이 열렸습니다: {url}")
    print("  브라우저가 자동으로 안 열리면 위 주소를 브라우저 주소창에 붙여넣으세요.")
    print("  이 창을 닫으면 제어판이 꺼집니다. (자동 실행 예약은 창을 닫아도 동작합니다)\n")
    if open_browser:
        webbrowser.open(url)
    try:
        return proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
        return 0
