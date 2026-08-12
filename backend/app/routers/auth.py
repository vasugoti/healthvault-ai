"""
Auth router: signup, login, refresh, me.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr, field_validator
import uuid

from app.database import get_db
from app.models import User, TimelineEvent, TimelineEventType
from app.auth import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    date_of_birth: str | None = None
    sex: str | None = None
    user_entered_conditions: list[str] = []

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    date_of_birth: str | None
    sex: str | None
    user_entered_conditions: list[str]
    created_at: str


@router.post("/signup", response_model=LoginResponse, status_code=201)
async def signup(data: SignupRequest, db: AsyncSession = Depends(get_db)):
    # Check if email already exists
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    dob = None
    if data.date_of_birth:
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d"):
            try:
                dob = datetime.strptime(data.date_of_birth, fmt).replace(tzinfo=timezone.utc)
                break
            except ValueError:
                pass
        if dob is None:
            # Fall back to date string without error if unrecognizable
            dob = None

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        date_of_birth=dob,
        sex=data.sex,
        user_entered_conditions=data.user_entered_conditions,
    )
    db.add(user)
    await db.flush()  # Get user.id before commit

    # Timeline: account created
    db.add(TimelineEvent(
        user_id=user.id,
        event_type=TimelineEventType.ACCOUNT_CREATED,
        title="Account created",
        description="Welcome to HealthVault AI",
    ))

    await db.commit()
    await db.refresh(user)

    return LoginResponse(
        access_token=create_access_token(user.id, user.email),
        refresh_token=create_refresh_token(user.id),
        user=_user_dict(user),
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    return LoginResponse(
        access_token=create_access_token(user.id, user.email),
        refresh_token=create_refresh_token(user.id),
        user=_user_dict(user),
    )


@router.post("/refresh")
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return {
        "access_token": create_access_token(user.id, user.email),
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(**_user_dict(current_user))


def _user_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "date_of_birth": user.date_of_birth.date().isoformat() if user.date_of_birth else None,
        "sex": user.sex,
        "user_entered_conditions": user.user_entered_conditions or [],
        "created_at": user.created_at.isoformat(),
    }
