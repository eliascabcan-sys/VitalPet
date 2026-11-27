"""Día 12 · P5: utilidades compartidas para probar la API por HTTP con tokens reales de cada rol."""
import os

# La API exige estas variables al importar core.security. Con valores falsos las
# pruebas no dependen del .env de nadie (setdefault: si ya existen, no se pisan).
for _k, _v in {"SECRET_KEY": "clave-solo-para-pruebas", "ALGORITHM": "HS256",
               "ACCESS_TOKEN_EXPIRE_MINUTES": "60"}.items():
    os.environ.setdefault(_k, _v)

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from core.database import get_db
from core.security import create_access_token
from models.user import User

ROLES = ("dueno", "dueno2", "veterinario", "administrador")


@pytest.fixture
def api(db):
    """
    Cliente HTTP sobre la API real (todos los routers) y la BD en memoria de la prueba.
    api.get("/ruta", rol="veterinario") -> manda el token de ese rol (sin rol = anónimo).
    api.usuarios["dueno"] -> el User de ese rol. Roles: dueno, dueno2, veterinario, administrador.
    """
    from api.vs1.api import api_router

    usuarios = {}
    for clave in ROLES:
        rol = "dueno" if clave.startswith("dueno") else clave
        u = User(nombre=clave.capitalize(), apellido="Prueba", email=f"{clave}@test.com", contrasena="x", rol=rol)
        db.add(u)
        usuarios[clave] = u
    db.commit()

    fabrica = sessionmaker(bind=db.get_bind())

    def get_db_de_prueba():
        sesion = fabrica()
        try:
            yield sesion
        finally:
            sesion.close()

    app = FastAPI()
    app.include_router(api_router, prefix="/api/vs1")
    app.dependency_overrides[get_db] = get_db_de_prueba
    cliente = TestClient(app, raise_server_exceptions=False)

    class Api:
        pass

    a = Api()
    a.usuarios = usuarios
    a.tokens = {k: create_access_token({"sub": u.email}) for k, u in usuarios.items()}

    def llamar(metodo, ruta, rol=None, **kw):
        headers = dict(kw.pop("headers", {}) or {})
        if rol:
            headers["Authorization"] = f"Bearer {a.tokens[rol]}"
        return cliente.request(metodo, "/api/vs1" + ruta, headers=headers, **kw)

    a.request = llamar
    a.get = lambda ruta, rol=None, **kw: llamar("GET", ruta, rol, **kw)
    a.post = lambda ruta, rol=None, **kw: llamar("POST", ruta, rol, **kw)
    a.put = lambda ruta, rol=None, **kw: llamar("PUT", ruta, rol, **kw)
    a.delete = lambda ruta, rol=None, **kw: llamar("DELETE", ruta, rol, **kw)
    return a