import os

# Valores falsos: las pruebas usan SQLite en memoria, nunca la BD real.
for _k, _v in {"DB_USER": "test", "DB_PASSWORD": "test", "DB_HOST": "localhost",
            "DB_PORT": "5432", "DB_NAME": "test"}.items():
    os.environ.setdefault(_k, _v)

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Se importan todos los modelos (igual que en main.py) para que SQLAlchemy
# pueda resolver las relaciones entre ellos.
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
# Modelos nuevos (los mismos que importa main.py) para que SQLAlchemy resuelva las relaciones
import models.acudiente, models.historial_seccion, models.formula
import models.laboratorio, models.certificado, models.subcategoria, models.franja_horaria
import models.consentimiento

from core.database import Base


@pytest.fixture
def db():
    """Sesion sobre una BD SQLite en memoria, limpia para cada prueba."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sesion = sessionmaker(bind=engine)()
    try:
        yield sesion
    finally:
        sesion.close()
        engine.dispose()