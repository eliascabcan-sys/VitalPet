"""Día 9 · P3: lista general del laboratorio para el veterinario (todos los pacientes)."""
from datetime import datetime, timedelta

import pytest

from models.laboratorio import ExamenLaboratorio
from models.mascota import Mascota
from models.user import User
from service.laboratorio import LaboratorioService

AHORA = datetime(2026, 10, 10, 9, 0)


@pytest.fixture
def datos(db):
    ana = User(nombre="Ana", apellido="Ruiz", email="ana@test.com", contrasena="x", rol="dueno")
    luis = User(nombre="Luis", apellido="Mora", email="luis@test.com", contrasena="x", rol="dueno")
    db.add_all([ana, luis])
    db.flush()
    luna = Mascota(nombre_mascota="Luna", especie="Canino", idUsuario=ana.idUsuario)
    michi = Mascota(nombre_mascota="Michi", especie="Felino", idUsuario=luis.idUsuario)
    db.add_all([luna, michi])
    db.flush()

    def examen(mascota, tipo, estado, dias_atras):
        e = ExamenLaboratorio(idHistorial=1, idMascota=mascota.idMascota, idUsuarioSolicita=1, categoria="hematologia",
                            tipo_examen=tipo, estado=estado, fecha_solicitud=AHORA - timedelta(days=dias_atras))
        db.add(e)
        return e

    examen(luna, "Hemograma", "solicitado", 1)
    examen(michi, "Perfil renal", "en_proceso", 6)       # el que más lleva esperando
    examen(luna, "Coprológico", "entregado", 2)
    examen(michi, "Orina", "entregado", 4)
    examen(luna, "Rayos X", "cancelado", 3)
    db.commit()


def nombres(lista):
    return [e.tipo_examen for e in lista]


def test_pendientes_primero_y_el_mas_antiguo_arriba(db, datos):
    r = LaboratorioService(db).listar_todos()
    assert nombres(r) == ["Perfil renal", "Hemograma", "Coprológico", "Orina"]   # luego los entregados, nuevos primero


def test_los_cancelados_solo_salen_si_se_piden(db, datos):
    s = LaboratorioService(db)
    assert "Rayos X" not in nombres(s.listar_todos())
    assert nombres(s.listar_todos(estado="cancelado")) == ["Rayos X"]


def test_filtra_por_estado(db, datos):
    assert nombres(LaboratorioService(db).listar_todos(estado="entregado")) == ["Coprológico", "Orina"]


@pytest.mark.parametrize("texto,esperados", [
    ("luna", {"Hemograma", "Coprológico"}),        # por mascota
    ("mora", {"Perfil renal", "Orina"}),            # por apellido del dueño
    ("ANA", {"Hemograma", "Coprológico"}),          # sin importar mayúsculas
    ("orina", {"Orina"}),                           # por examen
    ("zzz", set()),
])
def test_busca_por_mascota_dueno_o_examen(db, datos, texto, esperados):
    assert set(nombres(LaboratorioService(db).listar_todos(buscar=texto))) == esperados


def test_cada_fila_trae_dueno_y_especie(db, datos):
    fila = next(e for e in LaboratorioService(db).listar_todos() if e.tipo_examen == "Perfil renal")
    assert fila.nombre_dueno == "Luis Mora" and fila.especie == "Felino" and fila.nombre_mascota == "Michi"


def test_respeta_el_limite(db, datos):
    assert len(LaboratorioService(db).listar_todos(limite=2)) == 2