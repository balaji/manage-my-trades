"""Service for authenticated users."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_google_user(
        self, google_sub: str, name: str | None = None, picture: str | None = None
    ) -> User:
        result = await self.db.execute(select(User).where(User.google_sub == google_sub))
        user = result.scalar_one_or_none()
        if user:
            user.name = name
            user.picture = picture
            return user

        user = User(google_sub=google_sub, name=name, picture=picture)
        self.db.add(user)
        await self.db.flush()
        return user

    async def get_user(self, user_id: int) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
