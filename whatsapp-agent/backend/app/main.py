from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import audit, auth, campaigns, contacts, cron, csv_imports, leads, notifications, support, waba, webhooks

settings = get_settings()

app = FastAPI(title="WhatsApp Lead Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):  # noqa: ARG001
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# Vercel's multi-service routing (see ../vercel.json "rewrites") sends every
# request under /api/backend/* to this service, path unchanged — so every
# route here is mounted at that same prefix.
API_PREFIX = "/api/backend"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(waba.router, prefix=API_PREFIX)
app.include_router(webhooks.router, prefix=API_PREFIX)
app.include_router(contacts.router, prefix=API_PREFIX)
app.include_router(leads.router, prefix=API_PREFIX)
app.include_router(csv_imports.router, prefix=API_PREFIX)
app.include_router(campaigns.router, prefix=API_PREFIX)
app.include_router(notifications.router, prefix=API_PREFIX)
app.include_router(audit.router, prefix=API_PREFIX)
app.include_router(support.router, prefix=API_PREFIX)
app.include_router(cron.router, prefix=API_PREFIX)
