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

# Guard the entry point so the module is import-safe.
#
# reload is OFF by default: on Windows the WatchFiles reloader spawns a child
# worker process that re-imports the app, and if that child is orphaned (e.g.
# the parent is killed) it keeps holding port 8001, producing "address already
# in use" errors and zombie workers running stale code. Running a single
# process avoids that entirely. Set RELOAD=1 to opt back in during active
# backend development.
if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8001)),
        reload=os.environ.get("RELOAD", "0") == "1",
    )
