import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import hash_password, require_roles
from core.email import enviar_email_recuperacion, enviar_email_bienvenida
from models.token_recuperacion import TokenRecuperacion
from models.user import User
from schemas.recuperacion import SolicitudRecuperacion, RestablecerContrasena

router = APIRouter()


@router.post("/recuperar-contrasena", status_code=status.HTTP_200_OK)
async def solicitar_recuperacion(
    data: SolicitudRecuperacion,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Genera un token de recuperación y lo manda al correo.
    Siempre responde igual para no revelar si el email existe.
    """
    usuario = db.query(User).filter(User.email == data.email).first()

    if usuario:
        # Invalidar tokens anteriores del mismo email
        db.query(TokenRecuperacion).filter(
            TokenRecuperacion.email == data.email,
            TokenRecuperacion.usado == False
        ).update({"usado": True})
        db.commit()

        # Crear token nuevo
        token_str = secrets.token_urlsafe(32)
        db_token  = TokenRecuperacion(
            email     = data.email,
            token     = token_str,
            expira_en = datetime.now() + timedelta(minutes=30),
            usado     = False
        )
        db.add(db_token)
        db.commit()

        # Enviar email en segundo plano
        background_tasks.add_task(
            enviar_email_recuperacion,
            email  = data.email,
            token  = token_str,
            nombre = usuario.nombre
        )

    return {"mensaje": "Si el correo existe, recibirás un enlace para recuperar tu contraseña."}


@router.post("/restablecer-contrasena", status_code=status.HTTP_200_OK)
def restablecer_contrasena(
    data: RestablecerContrasena,
    db: Session = Depends(get_db)
):
    """Valida el token y actualiza la contraseña."""
    db_token = db.query(TokenRecuperacion).filter(
        TokenRecuperacion.token == data.token,
        TokenRecuperacion.usado == False
    ).first()

    if not db_token:
        raise HTTPException(
            status_code=400,
            detail="El enlace de recuperación no es válido."
        )

    if db_token.expira_en < datetime.now():
        raise HTTPException(
            status_code=400,
            detail="El enlace de recuperación expiró. Solicita uno nuevo."
        )

    usuario = db.query(User).filter(User.email == db_token.email).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    usuario.contrasena = hash_password(data.contrasena)
    db_token.usado     = True
    db.commit()

    return {"mensaje": "Contraseña actualizada correctamente. Ya puedes iniciar sesión."}


@router.post("/bienvenida/{usuario_id}", status_code=status.HTTP_200_OK)
async def enviar_bienvenida(
    usuario_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador"))
):
    """Reenvío manual de bienvenida, reservado para administración."""
    usuario = db.query(User).filter(User.idUsuario == usuario_id).first()
    if usuario:
        background_tasks.add_task(
            enviar_email_bienvenida,
            email  = usuario.email,
            nombre = usuario.nombre
        )
    return {"mensaje": "Email de bienvenida enviado."}