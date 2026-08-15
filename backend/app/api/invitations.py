from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.core.security import create_token
from app.models.family import Family
from app.models.person import Person
from app.models.user import User
from app.schemas.auth import TokenPair
from app.schemas.invitations import (
    AcceptInvitationRequest,
    CreateInvitationRequest,
    InvitationOut,
    InvitationPreview,
)
from app.services.auth_service import EmailAlreadyRegisteredError, get_person_by_user_id
from app.services.invitation_service import (
    InvitationExpiredError,
    InvitationNotFoundError,
    InvitationNotPendingError,
    accept_invitation,
    create_invitation,
    get_invitation_by_token,
)

router = APIRouter(prefix="/invitations", tags=["invitations"])


@router.post("", response_model=InvitationOut, status_code=status.HTTP_201_CREATED)
async def create_invite(
    data: CreateInvitationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InvitationOut:
    person = await get_person_by_user_id(db, current_user.id)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No person record for this user")

    invitation = await create_invitation(
        db, person.family_id, person.id, data.relationship_to_inviter
    )
    return InvitationOut(
        token=invitation.token,
        invite_url=f"{settings.frontend_url}/join/{invitation.token}",
        relationship_to_inviter=invitation.relationship_to_inviter,
        expires_at=invitation.expires_at,
    )


@router.get("/{token}", response_model=InvitationPreview)
async def preview_invite(token: str, db: AsyncSession = Depends(get_db)) -> InvitationPreview:
    invitation = await get_invitation_by_token(db, token)
    if invitation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")

    inviter = await db.get(Person, invitation.inviter_person_id)
    family = await db.get(Family, invitation.family_id)

    is_expired = invitation.expires_at < datetime.now(timezone.utc)
    effective_status = (
        "expired" if invitation.status == "pending" and is_expired else invitation.status
    )

    return InvitationPreview(
        family_name=family.name if family else "",
        inviter_first_name=inviter.first_name if inviter else "",
        inviter_last_name=inviter.last_name if inviter else "",
        relationship_to_inviter=invitation.relationship_to_inviter,
        status=effective_status,
    )


@router.post("/{token}/accept", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def accept_invite(
    token: str, data: AcceptInvitationRequest, db: AsyncSession = Depends(get_db)
) -> TokenPair:
    try:
        user, _person = await accept_invitation(
            db, token, data.email, data.password, data.first_name, data.last_name
        )
    except InvitationNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found") from exc
    except InvitationNotPendingError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "Invitation already used") from exc
    except InvitationExpiredError as exc:
        raise HTTPException(status.HTTP_410_GONE, "Invitation expired") from exc
    except EmailAlreadyRegisteredError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered") from exc

    return TokenPair(
        access_token=create_token(user.id, "access"),
        refresh_token=create_token(user.id, "refresh"),
    )
