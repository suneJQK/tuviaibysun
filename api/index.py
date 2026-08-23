# Re-export original backend. The Vercel config will run uvicorn against api.index:app.
# Keep all original behavior — do not edit endpoints.
from .index import *  # noqa: F401,F403
