import uuid
from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt

from app.core.config import settings
from app.core.security import create_token, decode_token


def test_create_and_decode_access_token_round_trip():
    user_id = uuid.uuid4()
    token = create_token(user_id, "access")
    assert decode_token(token, expected_type="access") == user_id


def test_create_and_decode_refresh_token_round_trip():
    user_id = uuid.uuid4()
    token = create_token(user_id, "refresh")
    assert decode_token(token, expected_type="refresh") == user_id


def test_decode_token_rejects_wrong_type():
    # An access token presented where a refresh token is expected (or vice
    # versa) must fail — this is what stops an access token, which the
    # client may expose to more surfaces, from being replayed as a refresh
    # token to mint fresh sessions indefinitely.
    access_token = create_token(uuid.uuid4(), "access")
    with pytest.raises(ValueError):
        decode_token(access_token, expected_type="refresh")


def test_decode_token_rejects_expired_token():
    user_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    expired_payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": now - timedelta(minutes=31),
        "exp": now - timedelta(minutes=1),
    }
    expired_token = jwt.encode(expired_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    with pytest.raises(ValueError):
        decode_token(expired_token, expected_type="access")


def test_decode_token_rejects_garbage():
    with pytest.raises(ValueError):
        decode_token("not-a-real-token", expected_type="access")
