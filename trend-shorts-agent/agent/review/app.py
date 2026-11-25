"""Streamlit 검토 화면 단독 실행: `python -m agent review`. (통합 제어판은 `python -m agent app`)"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import streamlit as st  # noqa: E402

from agent.config import get_settings  # noqa: E402
from agent.review.view import render_review  # noqa: E402

st.set_page_config(page_title="숏폼 후보 검토", page_icon="🎬", layout="wide")
render_review(get_settings())
