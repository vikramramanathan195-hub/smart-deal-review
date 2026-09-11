from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings
from app.models import Role

security = HTTPBearer(auto_error=False)

# No real user database — just two seeded mock accounts, one per role.
MOCK_USERS: dict[str, Role] = {
    "rep@dealreview.dev": "sales_rep",
    "manager@dealreview.dev": "manager",
}


class TokenPayload:
    def __init__(self, email: str, role: Role) -> None:
        self.email = email
        self.role = role


def create_access_token(email: str, role: Role) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expires_minutes)
    payload = {"sub": email, "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc
    email = payload.get("sub")
    role = payload.get("role")
    if email is None or role not in ("sales_rep", "manager"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return TokenPayload(email=email, role=role)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> TokenPayload:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    return decode_access_token(credentials.credentials)


def require_role(role: Role):
    def _dependency(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
        if user.role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires the '{role}' role",
            )
        return user

    return _dependency
