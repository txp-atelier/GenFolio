import asyncio
import uuid

import cloudinary
import cloudinary.uploader

from app.core.config import settings

MAX_PROFILE_PICTURE_BYTES = 5 * 1024 * 1024

_configured = False


class CloudinaryNotConfiguredError(Exception):
    pass


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


async def upload_profile_picture(
    family_id: uuid.UUID, person_id: uuid.UUID, contents: bytes
) -> str:
    if not (
        settings.cloudinary_cloud_name
        and settings.cloudinary_api_key
        and settings.cloudinary_api_secret
    ):
        raise CloudinaryNotConfiguredError()

    _ensure_configured()

    def _upload() -> dict:
        # One public_id per person -> overwrite=True means re-uploading
        # replaces the old photo instead of accumulating new ones.
        return cloudinary.uploader.upload(
            contents,
            folder=f"familytree/{family_id}",
            public_id=str(person_id),
            overwrite=True,
            resource_type="image",
        )

    # cloudinary's SDK is synchronous/blocking — run off the event loop.
    result = await asyncio.to_thread(_upload)
    return result["secure_url"]
