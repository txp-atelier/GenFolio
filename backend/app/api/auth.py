from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.core.security import create_token, decode_token
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    MeResponse,
    PasswordResetConfirmIn,
    PasswordResetRequestIn,
    PasswordResetRequestOut,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
)
from app.services.auth_service import (
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    InvalidResetTokenError,
    authenticate_user,
    build_me_response,
    create_password_reset_token,
    get_person_by_user_id,
    get_user_by_email,
    get_user_by_id,
    register_user,
    reset_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_pair(user_id) -> TokenPair:
    return TokenPair(
        access_token=create_token(user_id, "access"),
        refresh_token=create_token(user_id, "refresh"),
    )


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    try:
        user, _person = await register_user(db, data)
    except EmailAlreadyRegisteredError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered") from exc

    return _token_pair(user.id)


@router.post("/login", response_model=TokenPair)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    try:
        user = await authenticate_user(db, data.email, data.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password") from exc

    return _token_pair(user.id)


@router.post("/refresh", response_model=TokenPair)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    try:
        user_id = decode_token(data.refresh_token, expected_type="refresh")
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc

    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")

    return _token_pair(user.id)


@router.get("/me", response_model=MeResponse)
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MeResponse:
    person = await get_person_by_user_id(db, current_user.id)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No person record for this user")

    return await build_me_response(db, current_user, person)


_RESET_REQUESTED_MESSAGE = "If that email is registered, a password reset link has been generated."


@router.post("/password-reset/request", response_model=PasswordResetRequestOut)
async def request_password_reset(
    data: PasswordResetRequestIn, db: AsyncSession = Depends(get_db)
) -> PasswordResetRequestOut:
    user = await get_user_by_email(db, data.email)
    # Always return the same response whether or not the email is registered,
    # so this endpoint can't be used to enumerate accounts.
    if user is None:
        return PasswordResetRequestOut(message=_RESET_REQUESTED_MESSAGE)

    raw_token = await create_password_reset_token(db, user)

    if settings.environment == "production":
        # TODO: send raw_token via a real email provider once one is wired
        # up; for now (dev/MVP, no email service) it's returned directly.
        return PasswordResetRequestOut(message=_RESET_REQUESTED_MESSAGE)

    reset_url = f"{settings.frontend_url}/reset-password?token={raw_token}"
    return PasswordResetRequestOut(
        message=_RESET_REQUESTED_MESSAGE, reset_token=raw_token, reset_url=reset_url
    )


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def confirm_password_reset(
    data: PasswordResetConfirmIn, db: AsyncSession = Depends(get_db)
) -> None:
    try:
        await reset_password(db, data.token, data.new_password)
    except InvalidResetTokenError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired reset token") from exc
