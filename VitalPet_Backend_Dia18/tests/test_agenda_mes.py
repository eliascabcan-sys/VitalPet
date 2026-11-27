from datetime import date, datetime, time

import pytest
from fastapi import HTTPException

from models.cita import Cita
from models.franja_horaria import FranjaHoraria
from models.mascota import Mascota
from models.user import User
from models.veterinario import Veterinario
from service.citas import CitaService


@pytest.fixture
def vet_con_citas(db):
    d = User(nombre="Ana", apellido="Ruiz", email="a@t.com", contrasena="x", rol="dueno")
    u = User(nombre="Vera", apellido="Vet", email="v@t.com", contrasena="x", rol="veterinario")
    db.add_all([d, u]); db.flush()
    v = Veterinario(especialidad="Medicina general", tarjetaProfesional="TP-1", idUsuario=u.idUsuario)
    m = Mascota(nombre_mascota="Luna", especie="Canino", idUsuario=d.idUsuario)
    f = FranjaHoraria(nombre="Mañana", hora_inicio=time(8), hora_fin=time(12), cupo_maximo=6)
    db.add_all([v, m, f]); db.flush()
    for dia in (1, 15, 31):
        db.add(Cita(idMascota=m.idMascota, idUsuario=d.idUsuario, idVeterinario=v.idVeterinario,
                    fechaHora=datetime(2026, 10, dia, 9), estado="pendiente", idFranja=f.idFranja))
    db.add(Cita(idMascota=m.idMascota, idUsuario=d.idUsuario, idVeterinario=v.idVeterinario,
                fechaHora=datetime(2026, 11, 2, 9), estado="pendiente", idFranja=f.idFranja))
    db.commit()
    return v


def test_vista_mes_cubre_del_primero_al_ultimo_dia(db, vet_con_citas):
    a = CitaService(db).agenda_veterinario(vet_con_citas.idVeterinario, date(2026, 10, 13), "mes")
    assert a["desde"] == date(2026, 10, 1) and a["hasta"] == date(2026, 10, 31)
    assert len(a["dias"]) == 31 and a["total_citas"] == 3      # la de noviembre no entra


def test_vista_mes_en_febrero_bisiesto_y_diciembre(db, vet_con_citas):
    srv, vid = CitaService(db), vet_con_citas.idVeterinario
    assert srv.agenda_veterinario(vid, date(2028, 2, 10), "mes")["hasta"] == date(2028, 2, 29)
    assert srv.agenda_veterinario(vid, date(2026, 12, 5), "mes")["hasta"] == date(2026, 12, 31)


def test_vista_invalida_se_rechaza(db, vet_con_citas):
    with pytest.raises(HTTPException):
        CitaService(db).agenda_veterinario(vet_con_citas.idVeterinario, date(2026, 10, 1), "año")
