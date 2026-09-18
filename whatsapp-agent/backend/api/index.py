"""Vercel's Python runtime auto-detects an ASGI app named `app` in any file
under /api and serves it as a serverless function — no adapter needed for
FastAPI. This file is the single entrypoint for the "backend" service; see
../../vercel.json for how /api/backend/* requests get routed here.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: E402
