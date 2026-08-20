import asyncio
import uuid
from datetime import datetime, timezone

import cloudinary
import cloudinary.uploader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.health_report_file import HealthReportFile
from app.services.profile_picture_service import CloudinaryNotConfiguredError

MAX_REPORT_FILE_BYTES = 10 * 1024 * 1024

# Extension (from the filename) -> Cloudinary resource_type. Cloudinary's
# "auto" detection is unreliable for office documents like .docx, so the
# resource_type is decided explicitly from the upload's declared content
# type / filename instead of left to Cloudinary to guess.
_IMAGE_CONTENT_PREFIXES = ("image/",)
_ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}


class HealthReportFileNotFoundError(Exception):
    pass


class UnsupportedReportFileError(Exception):
    pass


_configured = False


def _ensure_configured() -> None:
    global _configured
    if _configured:
        return
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )
    _configured = True


def resolve_resource_type(filename: str, content_type: str | None) -> str:
    """Picks the Cloudinary resource_type for an upload, and doubles as the
    allow-list check — raises UnsupportedReportFileError for anything not in
    the pdf/docx/txt/image set the health report accepts."""
    if content_type and content_type.startswith(_IMAGE_CONTENT_PREFIXES):
        return "image"

    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension == "pdf":
        # Cloudinary treats PDFs as images (it can rasterize pages), which is
        # also what lets the stored file_url be opened directly in a browser.
        return "image"
    if extension in _ALLOWED_EXTENSIONS:
        return "raw"

    raise UnsupportedReportFileError()


async def upload_report_file(
    family_id: uuid.UUID,
    person_id: uuid.UUID,
    contents: bytes,
    resource_type: str,
) -> tuple[str, str]:
    """Uploads to Cloudinary, returns (secure_url, public_id)."""
    if not (
        settings.cloudinary_cloud_name
        and settings.cloudinary_api_key
        and settings.cloudinary_api_secret
    ):
        raise CloudinaryNotConfiguredError()

    _ensure_configured()
    public_id = str(uuid.uuid4())

    def _upload() -> dict:
        return cloudinary.uploader.upload(
            contents,
            folder=f"genfolio/{family_id}/reports",
            public_id=public_id,
            resource_type=resource_type,
        )

    result = await asyncio.to_thread(_upload)
    return result["secure_url"], result["public_id"]


async def delete_report_asset(public_id: str, resource_type: str) -> None:
    _ensure_configured()

    def _destroy() -> None:
        cloudinary.uploader.destroy(public_id, resource_type=resource_type)

    await asyncio.to_thread(_destroy)


async def create_report_file(
    db: AsyncSession,
    person_id: uuid.UUID,
    title: str,
    original_filename: str,
    file_url: str,
    cloudinary_public_id: str,
    cloudinary_resource_type: str,
    mime_type: str,
) -> HealthReportFile:
    record = HealthReportFile(
        person_id=person_id,
        title=title,
        original_filename=original_filename,
        file_url=file_url,
        cloudinary_public_id=cloudinary_public_id,
        cloudinary_resource_type=cloudinary_resource_type,
        mime_type=mime_type,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def list_report_files(db: AsyncSession, person_id: uuid.UUID) -> list[HealthReportFile]:
    result = await db.execute(
        select(HealthReportFile)
        .where(HealthReportFile.person_id == person_id)
        .order_by(HealthReportFile.uploaded_at.desc())
    )
    return list(result.scalars().all())


async def get_own_report_file(
    db: AsyncSession, person_id: uuid.UUID, file_id: uuid.UUID
) -> HealthReportFile:
    result = await db.execute(
        select(HealthReportFile).where(
            HealthReportFile.id == file_id, HealthReportFile.person_id == person_id
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HealthReportFileNotFoundError()
    return record


async def rename_report_file(
    db: AsyncSession, person_id: uuid.UUID, file_id: uuid.UUID, title: str
) -> HealthReportFile:
    record = await get_own_report_file(db, person_id, file_id)
    record.title = title
    await db.commit()
    await db.refresh(record)
    return record


async def replace_report_file(
    db: AsyncSession,
    person_id: uuid.UUID,
    file_id: uuid.UUID,
    title: str | None,
    original_filename: str,
    file_url: str,
    cloudinary_public_id: str,
    cloudinary_resource_type: str,
    mime_type: str,
) -> HealthReportFile:
    """Swaps the underlying file on an existing report entry — the new file
    is already uploaded (caller does that first) by the time this runs, so
    a failed swap never leaves the record pointing at nothing. The old
    Cloudinary asset is deleted only after the DB row has been updated, and
    only best-effort, so a Cloudinary hiccup here can't undo the swap that
    already succeeded."""
    record = await get_own_report_file(db, person_id, file_id)
    old_public_id = record.cloudinary_public_id
    old_resource_type = record.cloudinary_resource_type

    record.original_filename = original_filename
    record.file_url = file_url
    record.cloudinary_public_id = cloudinary_public_id
    record.cloudinary_resource_type = cloudinary_resource_type
    record.mime_type = mime_type
    record.uploaded_at = datetime.now(timezone.utc)
    if title:
        record.title = title

    await db.commit()
    await db.refresh(record)

    try:
        await delete_report_asset(old_public_id, old_resource_type)
    except Exception:
        pass

    return record


async def delete_report_file(db: AsyncSession, person_id: uuid.UUID, file_id: uuid.UUID) -> None:
    record = await get_own_report_file(db, person_id, file_id)
    # Best-effort — a Cloudinary hiccup shouldn't block the user from
    # clearing the record out of their own report.
    try:
        await delete_report_asset(record.cloudinary_public_id, record.cloudinary_resource_type)
    except Exception:
        pass
    await db.delete(record)
    await db.commit()
