"""Día 10+ · Paso 3: la lista de citas y de pacientes del veterinario trae nombres, no solo IDs."""
from datetime import datetime, time, timedelta

import pytest

from models.cita import Cita
from models.franja_horaria import FranjaHoraria
from models.mascota import Mascota
from models.user import User
from models.veterinario import Veterinario
from schemas.cita import CitaListaOut
from schemas.mascota import MascotaListaOut
from service.citas import CitaService
from service.mascota import MascotaService


@pytest.fixture
def datos(db):
    ana = User(nombre="Ana", apellido="Ruiz", email="ana@test.com", contrasena="x", rol="dueno")
    vet_user = User(nombre="Carla", apellido="Mejía", email="vet@test.com", contrasena="x", rol="veterinario")
    db.add_all([ana, vet_user])
    db.flush()
    vet = Veterinario(especialidad="General", tarjetaProfesional="TP-1", idUsuario=vet_user.idUsuario)
    luna = Mascota(nombre_mascota="Luna", especie="Canino", idUsuario=ana.idUsuario)
    franja = FranjaHoraria(nombre="Mañana", hora_inicio=time(8, 0), hora_fin=time(12, 0), cupo_maximo=6)
    db.add_all([vet, luna, franja])
    db.flush()
    manana = datetime.now() + timedelta(days=1)
    db.add_all([
        Cita(fechaHora=manana, motivo="Control", estado="confirmada", idUsuario=ana.idUsuario,
             idMascota=luna.idMascota, idVeterinario=vet.idVeterinario, idFranja=franja.idFranja),
        Cita(fechaHora=manana + timedelta(days=1), motivo="Vacuna", estado="pendiente",
             idUsuario=ana.idUsuario, idMascota=luna.idMascota),   # sin veterinario ni franja
    ])
    db.commit()


def test_la_lista_trae_mascota_dueno_y_veterinario(db, datos):
    primera, segunda = sorted(CitaService(db).get_all(), key=lambda c: c.fechaHora)
    assert primera.nombre_mascota == "Luna" and primera.especie == "Canino"
    assert primera.nombre_dueno == "Ana Ruiz"
    assert primera.nombre_veterinario == "Carla Mejía"
    assert primera.franja.nombre == "Mañana"
    assert segunda.nombre_veterinario is None and segunda.franja is None      # sin asignar


def test_los_pendientes_tambien_traen_nombres(db, datos):
    pendientes = CitaService(db).get_pendientes()
    assert [c.nombre_mascota for c in pendientes] == ["Luna"]
    assert pendientes[0].nombre_dueno == "Ana Ruiz"


def test_el_schema_de_salida_expone_los_nombres(db, datos):
    fila = CitaListaOut.model_validate(CitaService(db).get_all()[0])
    assert fila.nombre_mascota == "Luna" and fila.nombre_dueno == "Ana Ruiz"


def test_la_lista_de_pacientes_trae_el_nombre_del_dueno(db, datos):
    fila = MascotaListaOut.model_validate(MascotaService(db).get_all()[0])
    assert fila.nombre_mascota == "Luna" and fila.nombre_dueno == "Ana Ruiz"