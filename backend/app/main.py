from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.health import router as health_router
from app.api.health_records import router as health_records_router
from app.api.health_report_files import router as health_report_files_router
from app.api.invitations import router as invitations_router
from app.api.persons import router as persons_router
from app.core.config import settings

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(invitations_router)
app.include_router(persons_router)
app.include_router(health_records_router)
app.include_router(health_report_files_router)
app.include_router(chat_router)
