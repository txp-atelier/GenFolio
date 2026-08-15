"""Import every SQLAlchemy model here so Alembic's autogenerate can see them."""

from app.db.base import Base  # noqa: F401
from app.models.chat import ChatMessage, ChatSession  # noqa: F401
from app.models.condition_synonym import ConditionSynonym  # noqa: F401
from app.models.family import Family  # noqa: F401
from app.models.health_record import HealthRecord  # noqa: F401
from app.models.invitation import Invitation  # noqa: F401
from app.models.password_reset_token import PasswordResetToken  # noqa: F401
from app.models.person import Person  # noqa: F401
from app.models.relationship import Relationship  # noqa: F401
from app.models.user import User  # noqa: F401
