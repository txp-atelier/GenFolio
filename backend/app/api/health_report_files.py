import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.person import Person
from app.models.user import User
from app.schemas.health_report_files import HealthReportFileOut, UpdateHealthReportFileRequest
from app.services.auth_service import get_person_by_user_id
from app.services.health_report_file_service import (
    HealthReportFileNotFoundError,
    MAX_REPORT_FILE_BYTES,
    UnsupportedReportFileError,
    create_report_file,
    delete_report_asset,
    delete_report_file,
    list_report_files,
    rename_report_file,
    replace_report_file,
    resolve_resource_type,
    upload_report_file,
)
from app.services.profile_picture_service import CloudinaryNotConfiguredError

router = APIRouter(prefix="/health-report-files", tags=["health-report-files"])


async def _get_own_person(db: AsyncSession, current_user: User) -> Person:
    person = await get_person_by_user_id(db, current_user.id)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No person record for this user")
    return person


async def _validate_and_upload(person: Person, file: UploadFile) -> tuple[str, str, str, str]:
    """Shared by upload and replace: validates the file against the
    pdf/docx/txt/image allow-list and 10MB cap, then uploads it. Returns
    (filename, resource_type, file_url, cloudinary_public_id)."""
    filename = file.filename or "report"
    try:
        resource_type = resolve_resource_type(filename, file.content_type)
    except UnsupportedReportFileError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "That file type isn't supported — please upload a PDF, DOCX, TXT, or image file.",
        ) from exc

    contents = await file.read()
    if len(contents) > MAX_REPORT_FILE_BYTES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "File must be smaller than 10MB")

    try:
        file_url, public_id = await upload_report_file(
            person.family_id, person.id, contents, resource_type
        )
    except CloudinaryNotConfiguredError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "File uploads aren't configured yet"
        ) from exc

    return filename, resource_type, file_url, public_id


@router.post("", response_model=HealthReportFileOut, status_code=status.HTTP_201_CREATED)
async def upload_health_report_file(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HealthReportFileOut:
    person = await _get_own_person(db, current_user)
    filename, resource_type, file_url, public_id = await _validate_and_upload(person, file)

    record = await create_report_file(
        db,
        person.id,
        title=(title or filename).strip() or filename,
        original_filename=filename,
        file_url=file_url,
        cloudinary_public_id=public_id,
        cloudinary_resource_type=resource_type,
        mime_type=file.content_type or "application/octet-stream",
    )
    return HealthReportFileOut.model_validate(record)


@router.get("", response_model=list[HealthReportFileOut])
async def list_health_report_files(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[HealthReportFileOut]:
    person = await _get_own_person(db, current_user)
    records = await list_report_files(db, person.id)
    return [HealthReportFileOut.model_validate(r) for r in records]


@router.patch("/{file_id}", response_model=HealthReportFileOut)
async def rename_health_report_file(
    file_id: uuid.UUID,
    data: UpdateHealthReportFileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HealthReportFileOut:
    person = await _get_own_person(db, current_user)
    try:
        record = await rename_report_file(db, person.id, file_id, data.title)
    except HealthReportFileNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found") from exc
    return HealthReportFileOut.model_validate(record)


@router.post("/{file_id}/replace", response_model=HealthReportFileOut)
async def replace_health_report_file(
    file_id: uuid.UUID,
    file: UploadFile = File(...),
    title: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HealthReportFileOut:
    person = await _get_own_person(db, current_user)
    filename, resource_type, file_url, public_id = await _validate_and_upload(person, file)

    try:
        record = await replace_report_file(
            db,
            person.id,
            file_id,
            title=title,
            original_filename=filename,
            file_url=file_url,
            cloudinary_public_id=public_id,
            cloudinary_resource_type=resource_type,
            mime_type=file.content_type or "application/octet-stream",
        )
    except HealthReportFileNotFoundError as exc:
        # The record it was meant to replace doesn't exist (or isn't
        # theirs) — clean up the upload that already happened rather than
        # leaving an orphaned Cloudinary asset behind.
        await delete_report_asset(public_id, resource_type)
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found") from exc

    return HealthReportFileOut.model_validate(record)


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_health_report_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    person = await _get_own_person(db, current_user)
    try:
        await delete_report_file(db, person.id, file_id)
    except HealthReportFileNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found") from exc
