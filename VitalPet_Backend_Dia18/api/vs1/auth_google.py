import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests
from dotenv import load_dotenv
from urllib.parse import urlencode

from core.database import get_db
from core.security import create_access_token
from core.email import enviar_email_google_bienvenida, enviar_email_login_google
from models.user import User

load_dotenv()

router = APIRouter()

def _env(nombre: str):
    # Quita espacios y comillas que a veces quedan al copiar desde Google Cloud.
    valor = os.getenv(nombre)
    return valor.strip().strip('"').strip("'") if valor else valor


GOOGLE_CLIENT_ID       = _env("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET   = _env("GOOGLE_CLIENT_SECRET")
ALLOWED_GOOGLE_DOMAINS = os.getenv("ALLOWED_GOOGLE_DOMAINS", "@gmail.com")

GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
REDIRECT_URI     = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/vs1/auth/google/callback")

FRONTEND_URL          = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
# Ruta de React que recibe el token (ver <Route path="/oauth-callback"> en App.tsx).
# Configurable por si el frontend se sirve bajo otra ruta.
FRONTEND_CALLBACK_PATH = os.getenv("FRONTEND_CALLBACK_PATH", "/oauth-callback")
FRONTEND_CALLBACK_URL = f"{FRONTEND_URL}{FRONTEND_CALLBACK_PATH}"


# URL publica de la app (ej. el tunel https://abc.ngrok-free.app). Opcional.
PUBLIC_URL = (os.getenv("PUBLIC_URL") or "").strip().rstrip("/")
_HOSTS_LOCALES = ("localhost", "127.0.0.1", "[::1]", "testserver")


def _base_publica(request: Request | None) -> str | None:
    """
    Direccion con la que el usuario abrio la app. En el celular NO es localhost
    (es el tunel o la IP de la red), asi que Google debe volver a ESA direccion.
    Devuelve None en el PC local para conservar el comportamiento de siempre.
    """
    if PUBLIC_URL:
        return PUBLIC_URL
    if request is None:
        return None
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(",")[0].strip()
    if not host or host.split(":")[0] in _HOSTS_LOCALES:
        return None
    proto = (request.headers.get("x-forwarded-proto") or request.url.scheme).split(",")[0].strip()
    return f"{proto}://{host}"


def _redirect_uri(request: Request | None) -> str:
    base = _base_publica(request)
    return f"{base}/api/vs1/auth/google/callback" if base else REDIRECT_URI


def _callback_frontend(request: Request | None) -> str:
    base = _base_publica(request)
    return f"{base}{FRONTEND_CALLBACK_PATH}" if base else FRONTEND_CALLBACK_URL


def _redirigir_con_error(mensaje: str, request: Request | None = None) -> RedirectResponse:
    return RedirectResponse(
        url=f"{_callback_frontend(request)}?{urlencode({'error': mensaje})}",
        status_code=303
    )


@router.get("/google/login")
def iniciar_sesion_google(request: Request):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google OAuth2 no está configurado en el archivo .env.")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": _redirect_uri(request),
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
    }
    return RedirectResponse(
        url=f"{GOOGLE_AUTH_URL}?{urlencode(params)}",
        status_code=303
    )


@router.get("/google/callback")
async def callback_google(
    request: Request,
    code: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return _redirigir_con_error("Google OAuth2 no está configurado en el servidor.", request)
    if not code:
        return _redirigir_con_error("Falta el código de autorización de Google.", request)

    try:
        async with httpx.AsyncClient(timeout=15.0) as cliente:
            respuesta = await cliente.post(GOOGLE_TOKEN_URL, data={
                "code":          code,
                "client_id":     GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri":  _redirect_uri(request),
                "grant_type":    "authorization_code"
            })
    except httpx.HTTPError:
        return _redirigir_con_error("No fue posible comunicarse con Google. Intenta de nuevo.", request)

    if not respuesta.is_success:
        return _redirigir_con_error("Google no pudo validar el código de autorización.", request)

    try:
        tokens = respuesta.json()
    except ValueError:
        return _redirigir_con_error("Google devolvió una respuesta inválida.", request)

    token_identidad = tokens.get("id_token")
    if not token_identidad:
        return _redirigir_con_error("No se pudo obtener el token de Google.", request)

    try:
        perfil = id_token.verify_oauth2_token(
            token_identidad,
            requests.Request(),
            GOOGLE_CLIENT_ID,
            # Tolera hasta 60 s de diferencia entre el reloj del PC y el de Google
            # ("Token used too early" cuando la hora del equipo está desfasada).
            clock_skew_in_seconds=60
        )
    except ValueError as e:
        print("ERROR VERIFICANDO TOKEN GOOGLE:", repr(e))
        if "too early" in str(e) or "too late" in str(e):
            return _redirigir_con_error("La hora de este equipo no está sincronizada. Actívala en automático e intenta de nuevo.", request)
        return _redirigir_con_error("Token de Google inválido.", request)

    google_sub_id  = perfil.get("sub")
    email_usuario  = perfil.get("email")
    if not google_sub_id or not email_usuario:
        return _redirigir_con_error("La cuenta de Google no entregó los datos necesarios.", request)
    nombre_usuario = perfil.get("name") or email_usuario.split("@")[0]

    dominios_validos = [d.strip().lower() for d in ALLOWED_GOOGLE_DOMAINS.split(",") if d.strip()]
    email_lower = email_usuario.lower()
    if not any(email_lower.endswith(d) for d in dominios_validos):
        return _redirigir_con_error(f"El correo {email_usuario} no está autorizado.", request)

    es_usuario_nuevo   = False
    es_vinculacion_nueva = False

    usuario = db.query(User).filter(User.google_id == google_sub_id).first()

    if not usuario:
        usuario = db.query(User).filter(User.email == email_usuario).first()
        if usuario:
            usuario.google_id    = google_sub_id
            es_vinculacion_nueva = True
            db.commit()
        else:
            nombre_split = nombre_usuario.split(" ", 1)
            usuario = User(
                nombre     = nombre_split[0],
                apellido   = nombre_split[1] if len(nombre_split) > 1 else "",
                email      = email_usuario,
                contrasena = "",
                rol        = "dueno",
                estado     = "activo",
                google_id  = google_sub_id
            )
            db.add(usuario)
            db.commit()
            db.refresh(usuario)
            es_usuario_nuevo = True

    if usuario.estado != "activo":
        return _redirigir_con_error(
            "Esta cuenta está inactiva. Un administrador debe reactivarla antes de iniciar sesión.",
            request
        )

    if es_usuario_nuevo:
        background_tasks.add_task(
            enviar_email_google_bienvenida,
            email  = email_usuario,
            nombre = usuario.nombre
        )
    elif es_vinculacion_nueva:
        background_tasks.add_task(
            enviar_email_google_bienvenida,
            email  = email_usuario,
            nombre = usuario.nombre
        )
    else:
        background_tasks.add_task(
            enviar_email_login_google,
            email  = email_usuario,
            nombre = usuario.nombre
        )

    token_propio = create_access_token(data={"sub": usuario.email})
    datos = urlencode({
        "access_token": token_propio,
        "token_type":   "bearer",
        "rol":          usuario.rol,
        "idUsuario":    usuario.idUsuario,
        "nombre":       usuario.nombre,
        "apellido":     usuario.apellido or "",
        "email":        usuario.email,
    })
    return RedirectResponse(
        url=f"{_callback_frontend(request)}#{datos}",
        status_code=303
    )