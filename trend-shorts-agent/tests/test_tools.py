"""FFmpeg 찾기·자동 설치 (Windows WinError 2 대응)."""
import io
import zipfile

import httpx
import pytest

from agent import tools


def test_find_tool_prefers_project_folder(tmp_path, monkeypatch):
    monkeypatch.setattr(tools, "LOCAL_DIR", tmp_path)
    tools.find_tool.cache_clear()
    exe = tmp_path / ("ffmpeg.exe" if tools.IS_WIN else "ffmpeg")
    exe.write_text("x")
    assert tools.find_tool("ffmpeg") == str(exe)
    tools.find_tool.cache_clear()


def test_missing_tool_gives_korean_guidance(monkeypatch):
    monkeypatch.setattr(tools, "find_tool", lambda name: None)
    monkeypatch.setattr(tools, "IS_WIN", False)
    with pytest.raises(tools.ToolMissing, match="찾을 수 없습니다"):
        tools.tool("ffmpeg")


def test_windows_auto_installs_when_missing(tmp_path, monkeypatch):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("ffmpeg-8.0-essentials_build/bin/ffmpeg.exe", b"FF")
        z.writestr("ffmpeg-8.0-essentials_build/bin/ffprobe.exe", b"FP")
        z.writestr("ffmpeg-8.0-essentials_build/doc/readme.txt", b"doc")
    http = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, content=buf.getvalue())))
    monkeypatch.setattr(tools, "LOCAL_DIR", tmp_path)
    out = tools.install_ffmpeg(http=http)
    assert sorted(p.name for p in out.iterdir()) == ["ffmpeg.exe", "ffprobe.exe"]
    assert (tmp_path / "ffprobe.exe").read_bytes() == b"FP"
    tools.find_tool.cache_clear()
