from fastapi import APIRouter, HTTPException, status

from app.auth import MOCK_USERS, create_access_token
from app.models import LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest) -> LoginResponse:
    known_role = MOCK_USERS.get(body.email)
    if known_role is None or known_role != body.role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unknown email/role combination. Seeded users: "
            + ", ".join(f"{email} ({role})" for email, role in MOCK_USERS.items()),
        )
    token = create_access_token(body.email, body.role)
    return LoginResponse(access_token=token, role=body.role, email=body.email)
