import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

import uvicorn
from backend.api import app

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    print(f"Starting Adaptive OS Scheduling Backend on http://{host}:{port}")
    uvicorn.run("backend.api:app", host=host, port=port, reload=False)
