"""Shared fixtures for starter kit test runner tests."""

from __future__ import annotations

import sys
from pathlib import Path

# Add scripts/test to path so we can import test_starter_kit
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
