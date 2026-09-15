from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = os.getenv("EVALPULSE_DB_PATH", str(BASE_DIR / "evalpulse.db"))
SAMPLE_DATA_DIR = Path(__file__).resolve().parent / "sample_data"

DEFAULT_MODELS = [
    "mock-gpt-4o",
    "mock-claude-3-5-sonnet",
    "mock-gemini-1-5-pro",
    "mock-llama-3-8b",
]

DEFAULT_TIMEOUT_SECONDS = 30.0
DEFAULT_MAX_CONCURRENCY = 5
