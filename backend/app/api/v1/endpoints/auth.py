"""Authentication endpoints."""

import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.session import get_db
from app.deps import get_current_user
from app.models import User
from app.services.user_service import UserService

router = APIRouter()
settings = get_settings()


@router.get("/google/login")
async def google_login(request: Request):
    state = secrets.token_urlsafe(32)
    request.session["oauth_state"] = state
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid profile",
        "prompt": "select_account",
        "state": state,
    }
    return RedirectResponse(f"{settings.GOOGLE_AUTH_BASE_URL}?{urlencode(params)}")


@router.get("/google/callback")
async def google_callback(code: str, request: Request, db: AsyncSession = Depends(get_db), state: str | None = None):
    expected_state = request.session.pop("oauth_state", None)
    if not state or state != expected_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state parameter")
    async with httpx.AsyncClient(timeout=30.0) as client:
        token_response = await client.post(
            settings.GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_response.status_code >= 400:
            raise HTTPException(status_code=400, detail="Google login failed")
        token_data = token_response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Google login failed: no access token")

        userinfo_response = await client.get(
            settings.GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_response.status_code >= 400:
            raise HTTPException(status_code=400, detail="Google user lookup failed")
        userinfo = userinfo_response.json()

    google_sub = userinfo.get("sub")
    if not google_sub:
        raise HTTPException(status_code=400, detail="Google account did not provide a subject identifier")

    user = await UserService(db).get_or_create_google_user(
        google_sub, name=userinfo.get("name"), picture=userinfo.get("picture")
    )
    request.session["user_id"] = str(user.id)
    return RedirectResponse(url=settings.FRONTEND_CALLBACK_URL)


@router.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {"id": str(current_user.id), "name": current_user.name, "picture": current_user.picture}


@router.delete("/me", status_code=204)
async def delete_me(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await UserService(db).delete_user(current_user)
    request.session.clear()
