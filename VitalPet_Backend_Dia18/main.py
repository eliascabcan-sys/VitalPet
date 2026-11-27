import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from api.vs1.api import api_router

# Todos los modelos deben importarse aqui para que SQLAlchemy los conozca
# antes de create_all() y pueda resolver las relaciones entre ellos.
import models.user, models.mascota, models.categoria
import models.product, models.cita, models.historial
import models.venta, models.detalle_venta
import models.veterinario
import models.plantilla_seguimiento, models.pregunta_plantilla
import models.seguimiento, models.respuesta_seguimiento, models.alerta_seguimiento
import models.token_recuperacion
import models.vacuna
import models.derivacion
import models.reporte_salud
import models.acudiente, models.historial_seccion, models.formula
import models.laboratorio, models.certificado, models.subcategoria, models.franja_horaria
import models.consentimiento

from core.database import Base, engine, SessionLocal
from sqlalchemy import text
from core.security import hash_password
from models.user import User
from models.veterinario import Veterinario


load_dotenv()
Base.metadata.create_all(bind=engine)

def seed_cuentas_fijas():
    """
    Crea (si no existen) las cuentas de administrador y veterinario con
    contrasena fija. Estas cuentas NUNCA se crean por /users/register:
    ese endpoint solo puede crear duenos. Las contrasenas se definen
    por variables de entorno para no dejarlas escritas en el codigo.
    """
    admin_email = os.getenv("ADMIN_EMAIL", "admin@vitalpet.com")
    admin_pass  = os.getenv("ADMIN_PASSWORD")
    vet_email   = os.getenv("VET_EMAIL", "veterinario@vitalpet.com")
    vet_pass    = os.getenv("VET_PASSWORD")
    vet_tarjeta = os.getenv("VET_TARJETA_PROFESIONAL", "TP-000001")

    if not admin_pass or not vet_pass:
        print("⚠️  ADMIN_PASSWORD y/o VET_PASSWORD no definidas en .env: no se sembraron las cuentas fijas.")
        return

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == admin_email).first()
        if not admin:
            admin = User(
                nombre="Admin", apellido="VitalPet",
                email=admin_email, contrasena=hash_password(admin_pass),
                rol="administrador", estado="activo",
            )
            db.add(admin)

        vet_user = db.query(User).filter(User.email == vet_email).first()
        if not vet_user:
            vet_user = User(
                nombre="Veterinario", apellido="VitalPet",
                email=vet_email, contrasena=hash_password(vet_pass),
                rol="veterinario", estado="activo",
            )
            db.add(vet_user)
            db.flush()
            db.add(Veterinario(
                especialidad="Medicina general",
                tarjetaProfesional=vet_tarjeta,
                idUsuario=vet_user.idUsuario,
            ))

        db.commit()
    finally:
        db.close()


seed_cuentas_fijas()

app = FastAPI(
    title="VitalPet",
    description="Sistema de gestion de historial clinico veterinario",
    version="3.0.0",
)

# CORS
origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:5500,http://127.0.0.1:5500")
LISTA_ORIGENES = [o.strip() for o in origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=LISTA_ORIGENES,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.middleware("http")
async def cabeceras_seguridad(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response

# Servir el frontend desde el mismo FastAPI evita problemas de CORS y
# permite abrir todo el proyecto desde http://localhost:8000/.
# Se prueban varias rutas posibles porque el nombre de la carpeta del
# frontend puede variar (frontend, VitalPet_frontend_corregido, etc).
# También se puede forzar con la variable FRONTEND_DIR en el .env.
_candidatas = []
if os.getenv("FRONTEND_DIR"):
    _candidatas.append(os.getenv("FRONTEND_DIR"))
_base = os.path.dirname(__file__)
_candidatas += [
    os.path.join(_base, "..", "frontend"),
    os.path.join(_base, "..", "VitalPet_frontend_corregido"),
    os.path.join(_base, "..", "..", "frontend", "VitalPet_frontend_corregido"),
    os.path.join(_base, "..", "frontend", "VitalPet_frontend_corregido"),
]

FRONTEND_DIR = None
for _c in _candidatas:
    _c = os.path.abspath(_c)
    if os.path.isdir(os.path.join(_c, "templates")):
        FRONTEND_DIR = _c
        break

if FRONTEND_DIR:
    print(f"✅ Frontend encontrado en: {FRONTEND_DIR}")
    app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND_DIR, "static")), name="static")
    app.mount("/templates", StaticFiles(directory=os.path.join(FRONTEND_DIR, "templates"), html=True), name="templates")
# Sin else: el frontend React corre aparte con Vite, no hace falta avisar.

app.include_router(api_router, prefix="/api/vs1")


# ── Automatización (P4): corre sola cada N minutos ──────────────────────────
# El intervalo es configurable por .env para poder hacer una demo en minutos
# de algo que en producción corre cada 15 min (ver CONTRATO.md, punto D5).
from apscheduler.schedulers.background import BackgroundScheduler
from core.database import SessionLocal as _SessionLocal
from service.automatizacion import ejecutar_ciclo as _ejecutar_ciclo_automatizacion

_INTERVALO_MIN = int(os.getenv("AUTOMATIZACION_INTERVALO_MINUTOS", "15"))
_scheduler = BackgroundScheduler()


def _job_automatizacion():
    db = _SessionLocal()
    try:
        resultado = _ejecutar_ciclo_automatizacion(db)
        print(f"🤖 Automatización ejecutada: {resultado}")
    except Exception as exc:
        print(f"⚠️ Error en el ciclo de automatización: {exc}")
    finally:
        db.close()


@app.on_event("startup")
def _iniciar_scheduler():
    if os.getenv("AUTOMATIZACION_DESACTIVADA", "").lower() == "true":
        print("⏸️  Automatización desactivada por AUTOMATIZACION_DESACTIVADA=true.")
        return
    _scheduler.add_job(_job_automatizacion, "interval", minutes=_INTERVALO_MIN, id="ciclo_automatizacion")
    _scheduler.start()
    print(f"✅ Automatización programada cada {_INTERVALO_MIN} minuto(s).")


@app.on_event("shutdown")
def _detener_scheduler():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    schema = get_openapi(
        title="VitalPet",
        version="3.0.0",
        description="Sistema de gestion de historial clinico veterinario",
        routes=app.routes,
    )

    schema["components"]["securitySchemes"] = {
        "Bearer": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Pega aqui tu token JWT",
        }
    }

    rutas_sin_candado = ["/login", "/register", "/google"]

    for path, path_item in schema.get("paths", {}).items():
        es_publica = any(p in path for p in rutas_sin_candado)
        if not es_publica:
            for method, operation in path_item.items():
                if method in ["get", "post", "put", "delete", "patch"]:
                    operation.setdefault("security", [{"Bearer": []}])

    app.openapi_schema = schema
    return app.openapi_schema

app.openapi = custom_openapi


@app.get("/")
async def root():
    # Con el frontend en React (Vite) ya no hay carpeta FRONTEND_DIR: sin este
    # chequeo, os.path.join(None, ...) lanzaba TypeError y GET / respondia 500.
    if FRONTEND_DIR:
        index = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
    return {"message": "VitalPet API v3 activa"}