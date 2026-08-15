import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.invitation import Invitation
from app.models.person import Person
from app.models.user import User
from app.services.auth_service import EmailAlreadyRegisteredError, get_user_by_email
from app.services.relationship_service import connect_new_member, find_claimable_parent

INVITATION_TTL_DAYS = 7


class InvitationNotFoundError(Exception):
    pass


class InvitationNotPendingError(Exception):
    pass


class InvitationExpiredError(Exception):
    pass


async def create_invitation(
    db: AsyncSession,
    family_id: uuid.UUID,
    inviter_person_id: uuid.UUID,
    relationship_to_inviter: str,
) -> Invitation:
    invitation = Invitation(
        family_id=family_id,
        inviter_person_id=inviter_person_id,
        relationship_to_inviter=relationship_to_inviter,
        token=secrets.token_urlsafe(24),
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITATION_TTL_DAYS),
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    return invitation


async def get_invitation_by_token(db: AsyncSession, token: str) -> Invitation | None:
    result = await db.execute(select(Invitation).where(Invitation.token == token))
    return result.scalar_one_or_none()


async def get_valid_invitation(db: AsyncSession, token: str) -> Invitation:
    invitation = await get_invitation_by_token(db, token)
    if invitation is None:
        raise InvitationNotFoundError()
    if invitation.status != "pending":
        raise InvitationNotPendingError()
    if invitation.expires_at < datetime.now(timezone.utc):
        raise InvitationExpiredError()
    return invitation


async def accept_invitation(
    db: AsyncSession,
    token: str,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
) -> tuple[User, Person]:
    invitation = await get_valid_invitation(db, token)

    if await get_user_by_email(db, email) is not None:
        raise EmailAlreadyRegisteredError(email)

    user = User(email=email, password_hash=hash_password(password))
    db.add(user)
    await db.flush()

    # If this is someone joining as "parent" and the inviter already has an
    # unclaimed placeholder parent (created earlier when a sibling joined
    # before any parent was on record), claim that row instead of creating
    # a second, disconnected parent — this is what keeps the existing
    # sibling connected once the real parent joins.
    person = None
    if invitation.relationship_to_inviter == "parent":
        person = await find_claimable_parent(db, invitation.inviter_person_id)
        if person is not None:
            person.user_id = user.id
            person.first_name = first_name
            person.last_name = last_name
            person.is_claimed = True

    if person is None:
        person = Person(
            family_id=invitation.family_id,
            user_id=user.id,
            first_name=first_name,
            last_name=last_name,
            is_claimed=True,
        )
        db.add(person)
    await db.flush()

    await connect_new_member(
        db,
        family_id=invitation.family_id,
        inviter_person_id=invitation.inviter_person_id,
        new_person_id=person.id,
        relationship_to_inviter=invitation.relationship_to_inviter,
    )

    invitation.status = "accepted"
    invitation.accepted_by_person_id = person.id

    await db.commit()
    await db.refresh(user)
    await db.refresh(person)
    return user, person
