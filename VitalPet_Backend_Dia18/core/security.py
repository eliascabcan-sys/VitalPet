import os
import hashlib
import hmac
import binascii
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from core.database import get_db
from models.user import User

load_dotenv()

_PBKDF2_ITERATIONS  = 100_000
_SALT_BYTES         = 16

SECRET_KEY                  = os.getenv("SECRET_KEY")
ALGORITHM                   = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")

if not SECRET_KEY:
    raise RuntimeError("ERROR CRITICO: SECRET_KEY no definida en .env")
if not ACCESS_TOKEN_EXPIRE_MINUTES:
    raise RuntimeError("ERROR CRITICO: ACCESS_TOKEN_EXPIRE_MINUTES no definida en .env")

ACCESS_TOKEN_EXPIRE_MINUTES = int(ACCESS_TOKEN_EXPIRE_MINUTES)


def hash_password(password: str) -> str:
    salt = os.urandom(_SALT_BYTES)
    dk   = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    return f"{_PBKDF2_ITERATIONS}${binascii.hexlify(salt).decode()}${binascii.hexlify(dk).decode()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        iterations, salt_hex, dk_hex = hashed_password.split("$")
        salt      = binascii.unhexlify(salt_hex)
        dk_stored = binascii.unhexlify(dk_hex)
        dk_new    = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(dk_new, dk_stored)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire    = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_token_from_request(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token Bearer invalido o ausente",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return auth_header[7:]


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token   = get_token_from_request(request)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.estado != "activo":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario inactivo")
    return current_user


def require_roles(*roles_permitidos: str):
    def verificador(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.rol not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso restringido. Roles permitidos: {', '.join(roles_permitidos)}"
            )
        return current_user
    return verificador
