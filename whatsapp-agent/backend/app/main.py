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


app.include_router(auth.router, prefix="/api")
app.include_router(waba.router, prefix="/api")
app.include_router(webhooks.router, prefix="/api")
app.include_router(contacts.router, prefix="/api")
app.include_router(leads.router, prefix="/api")
app.include_router(csv_imports.router, prefix="/api")
app.include_router(campaigns.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(support.router, prefix="/api")
app.include_router(cron.router, prefix="/api")
