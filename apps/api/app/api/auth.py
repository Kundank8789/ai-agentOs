from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_db
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from app.services.jwt import create_access_token
from app.services.security import hash_password, verify_password


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post("/signup", response_model=UserResponse, status_code=201)
async def signup(
    signup_data: SignupRequest,
    db: AsyncSession = Depends(get_db),
):
    existing_user = await db.execute(
        select(User).where(
            User.email == signup_data.email
        )
    )

    if existing_user.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail="Email already registered.",
        )

    organization = Organization(
        name=f"{signup_data.name}'s Organization"
    )

    db.add(organization)
    await db.flush()

    user = User(
        organization_id=organization.id,
        name=signup_data.name,
        email=signup_data.email,
        password_hash=hash_password(signup_data.password),
        role="owner",
    )

    db.add(user)

    await db.commit()
    await db.refresh(user)

    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(
            User.email == login_data.email
        )
    )

    user = result.scalar_one_or_none()

    if user is None or user.password_hash is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    if not verify_password(
        login_data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    access_token = create_access_token(
        user_id=user.id,
        organization_id=user.organization_id,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
    )