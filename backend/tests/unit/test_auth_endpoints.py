"""Tests for OAuth security and auth endpoint behaviour."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_google_login_sets_state_in_session():
    """OAuth login must store a state token in the session before redirecting."""
    from app.api.v1.endpoints.auth import google_login

    session = {}
    request = MagicMock()
    request.session = session

    response = await google_login(request)

    assert "oauth_state" in session, "state must be stored in session before redirect"
    assert session["oauth_state"] in response.headers["location"]


@pytest.mark.asyncio
async def test_google_callback_rejects_missing_state():
    """Callback without a state param must raise 400."""
    from app.api.v1.endpoints.auth import google_callback

    session = {"oauth_state": "expected-token"}
    request = MagicMock()
    request.session = session

    db = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await google_callback(code="somecode", state=None, request=request, db=db)

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_google_callback_rejects_state_mismatch():
    """Callback with wrong state must raise 400."""
    from app.api.v1.endpoints.auth import google_callback

    session = {"oauth_state": "expected-token"}
    request = MagicMock()
    request.session = session

    db = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await google_callback(code="somecode", state="wrong-token", request=request, db=db)

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_google_callback_raises_on_missing_access_token():
    """A 200 response from Google with an error field (no access_token) must raise 400."""
    from app.api.v1.endpoints.auth import google_callback

    state_token = "valid-state"
    session = {"oauth_state": state_token}
    request = MagicMock()
    request.session = session

    db = AsyncMock()

    mock_token_response = MagicMock()
    mock_token_response.status_code = 200
    mock_token_response.json.return_value = {"error": "invalid_grant"}

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=mock_token_response)

    with patch("app.api.v1.endpoints.auth.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(HTTPException) as exc_info:
            await google_callback(code="somecode", state=state_token, request=request, db=db)

    assert exc_info.value.status_code == 400
