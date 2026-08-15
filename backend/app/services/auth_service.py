import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.family import Family
from app.models.password_reset_token import PasswordResetToken
from app.models.person import Person
from app.models.user import User
from app.schemas.auth import MeResponse, RegisterRequest, UserOut

RESET_TOKEN_TTL_MINUTES = 60


class EmailAlreadyRegisteredError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class InvalidResetTokenError(Exception):
    pass


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def register_user(db: AsyncSession, data: RegisterRequest) -> tuple[User, Person]:
    if await get_user_by_email(db, data.email) is not None:
        raise EmailAlreadyRegisteredError(data.email)

    user = User(email=data.email, password_hash=hash_password(data.password))
    db.add(user)
    await db.flush()  # assigns user.id without committing

    family = Family(name=data.family_name, created_by=user.id)
    db.add(family)
    await db.flush()  # assigns family.id

    person = Person(
        family_id=family.id,
        user_id=user.id,
        first_name=data.first_name,
        last_name=data.last_name,
        is_claimed=True,
    )
    db.add(person)

    await db.commit()
    await db.refresh(user)
    await db.refresh(person)
    return user, person


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    user = await get_user_by_email(db, email)
    if user is None or not verify_password(password, user.password_hash):
        raise InvalidCredentialsError()
    return user


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_person_by_user_id(db: AsyncSession, user_id: uuid.UUID) -> Person | None:
    result = await db.execute(select(Person).where(Person.user_id == user_id))
    return result.scalar_one_or_none()


async def build_me_response(db: AsyncSession, user: User, person: Person) -> MeResponse:
    """Shared by every endpoint that returns "your own profile" (GET
    /auth/me, PATCH /persons/me, POST /persons/me/profile-picture) so the
    shape can't drift between them."""
    family = await db.get(Family, person.family_id)
    return MeResponse(
        user=UserOut.model_validate(user),
        person_id=person.id,
        family_id=person.family_id,
        family_name=family.name if family else "",
        first_name=person.first_name,
        last_name=person.last_name,
        dob=person.dob,
        sex=person.sex,
        height_cm=person.height_cm,
        weight_kg=person.weight_kg,
        profile_picture_url=person.profile_picture_url,
    )


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


async def create_password_reset_token(db: AsyncSession, user: User) -> str:
    # Drop any outstanding unused tokens so only the newest link is valid.
    await db.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
    )

    raw_token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
        )
    )
    await db.commit()
    return raw_token


async def reset_password(db: AsyncSession, raw_token: str, new_password: str) -> None:
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == _hash_token(raw_token))
    )
    reset_token = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if reset_token is None or reset_token.used_at is not None or reset_token.expires_at < now:
        raise InvalidResetTokenError()

    user = await get_user_by_id(db, reset_token.user_id)
    if user is None:
        raise InvalidResetTokenError()

    user.password_hash = hash_password(new_password)
    reset_token.used_at = now
    await db.commit()
