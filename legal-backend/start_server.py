"""
Local dev server launcher. Copy .env.example to .env and fill in values,
or export the env vars manually before running this script.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env if present
load_dotenv(Path(__file__).parent / ".env")

import uvicorn

# Guard the entry point: uvicorn's reload=True spawns a child process that
# re-imports this module. On Windows (spawn start method) an unguarded
# uvicorn.run() at module level recursively spawns processes and crashes.
if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8001)),
        reload=True,
    )
