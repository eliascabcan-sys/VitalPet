"""Citas por franja del día (sin hora exacta) y canal de contacto."""
from datetime import date, datetime, time, timedelta

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from models.franja_horaria import FranjaHoraria
from models.mascota import Mascota
from models.user import User
from schemas.cita import CitaCreate, CitaUpdate
from service.citas import CitaService

MANANA = date.today() + timedelta(days=3)


@pytest.fixture
def escenario(db):
    dueno = User(nombre="Ana", apellido="Ruiz", email="ana@test.com", contrasena="x", rol="dueno")
    db.add(dueno)
    db.flush()
    m = Mascota(nombre_mascota="Luna", especie="Canino", idUsuario=dueno.idUsuario)
    f_manana = FranjaHoraria(nombre="Mañana", hora_inicio=time(8, 0), hora_fin=time(12, 0), cupo_maximo=2)
    f_tarde = FranjaHoraria(nombre="Tarde", hora_inicio=time(14, 0), hora_fin=time(18, 0), cupo_maximo=2)
    db.add_all([m, f_manana, f_tarde])
    db.commit()
    return dueno, m, f_manana, f_tarde


def pedir(dueno, m, franja, **extra):
    datos = dict(idUsuario=dueno.idUsuario, idMascota=m.idMascota, idFranja=franja.idFranja, fecha=MANANA)
    datos.update(extra)
    return CitaCreate(**datos)


# ---------- validación del schema ----------

def test_hay_que_indicar_hora_exacta_o_franja(escenario):
    dueno, m, *_ = escenario
    with pytest.raises(ValidationError):
        CitaCreate(idUsuario=dueno.idUsuario, idMascota=m.idMascota)


def test_la_franja_necesita_fecha(escenario):
    dueno, m, f, _ = escenario
    with pytest.raises(ValidationError):
        CitaCreate(idUsuario=dueno.idUsuario, idMascota=m.idMascota, idFranja=f.idFranja)


def test_canal_invalido_se_rechaza_y_urgente_se_acepta(escenario):
    dueno, m, f, _ = escenario
    with pytest.raises(ValidationError):
        pedir(dueno, m, f, canal_contacto="paloma")
    assert pedir(dueno, m, f, canal_contacto="urgente").canal_contacto == "urgente"


def test_fecha_en_el_pasado_se_rechaza(escenario):
    dueno, m, f, _ = escenario
    with pytest.raises(ValidationError):
        pedir(dueno, m, f, fecha=date.today() - timedelta(days=1))


# ---------- servicio ----------

def test_cita_por_franja_guarda_el_inicio_de_la_franja_y_el_canal(db, escenario):
    dueno, m, f, _ = escenario
    cita = CitaService(db).create(pedir(dueno, m, f, canal_contacto="telefono"), rol_usuario_actual="dueno")
    assert cita.fechaHora == datetime.combine(MANANA, time(8, 0))
    assert cita.idFranja == f.idFranja
    assert cita.canal_contacto == "telefono"


def test_misma_franja_varias_citas_hasta_llenar_el_cupo(db, escenario):
    dueno, m, f, _ = escenario
    svc = CitaService(db)
    svc.create(pedir(dueno, m, f), rol_usuario_actual="dueno")
    svc.create(pedir(dueno, m, f), rol_usuario_actual="dueno")      # cupo = 2
    with pytest.raises(HTTPException) as e:
        svc.create(pedir(dueno, m, f), rol_usuario_actual="dueno")
    assert e.value.status_code == 400
    assert "llena" in e.value.detail.lower()


def test_otra_franja_del_mismo_dia_sigue_libre(db, escenario):
    dueno, m, f_manana, f_tarde = escenario
    svc = CitaService(db)
    svc.create(pedir(dueno, m, f_manana), rol_usuario_actual="dueno")
    svc.create(pedir(dueno, m, f_manana), rol_usuario_actual="dueno")
    assert svc.create(pedir(dueno, m, f_tarde), rol_usuario_actual="dueno").idFranja == f_tarde.idFranja


def test_una_cita_cancelada_libera_el_cupo(db, escenario):
    dueno, m, f, _ = escenario
    svc = CitaService(db)
    c1 = svc.create(pedir(dueno, m, f), rol_usuario_actual="dueno")
    svc.create(pedir(dueno, m, f), rol_usuario_actual="dueno")
    svc.cancelar(c1.idCita)
    svc.create(pedir(dueno, m, f), rol_usuario_actual="dueno")       # ya cabe


def test_no_se_agenda_una_franja_de_hoy_que_ya_comenzo(db, escenario):
    dueno, m, *_ = escenario
    todo_el_dia = FranjaHoraria(nombre="Todo el día", hora_inicio=time(0, 0), hora_fin=time(23, 59), cupo_maximo=5)
    db.add(todo_el_dia)
    db.commit()
    data = CitaCreate(idUsuario=dueno.idUsuario, idMascota=m.idMascota,
                      idFranja=todo_el_dia.idFranja, fecha=date.today())
    with pytest.raises(HTTPException) as e:
        CitaService(db).create(data, rol_usuario_actual="dueno")
    assert "ya comenz" in e.value.detail.lower()


def test_franja_inexistente_da_404(db, escenario):
    dueno, m, *_ = escenario
    data = CitaCreate(idUsuario=dueno.idUsuario, idMascota=m.idMascota, idFranja=999, fecha=MANANA)
    with pytest.raises(HTTPException) as e:
        CitaService(db).create(data, rol_usuario_actual="dueno")
    assert e.value.status_code == 404


def test_disponibilidad_muestra_los_cupos_que_quedan(db, escenario):
    dueno, m, f_manana, _ = escenario
    svc = CitaService(db)
    svc.create(pedir(dueno, m, f_manana), rol_usuario_actual="dueno")
    por_nombre = {x["nombre"]: x for x in svc.disponibilidad_franjas(MANANA)}
    assert por_nombre["Mañana"]["cupos_usados"] == 1
    assert por_nombre["Mañana"]["cupos_disponibles"] == 1
    assert por_nombre["Mañana"]["disponible"] is True
    assert por_nombre["Tarde"]["cupos_disponibles"] == 2


def test_mover_la_cita_a_una_franja_llena_se_rechaza(db, escenario):
    dueno, m, f_manana, f_tarde = escenario
    svc = CitaService(db)
    svc.create(pedir(dueno, m, f_tarde), rol_usuario_actual="dueno")
    svc.create(pedir(dueno, m, f_tarde), rol_usuario_actual="dueno")
    c = svc.create(pedir(dueno, m, f_manana), rol_usuario_actual="dueno")
    with pytest.raises(HTTPException):
        svc.update(c.idCita, CitaUpdate(idFranja=f_tarde.idFranja))


def test_cita_con_hora_exacta_sigue_funcionando(db, escenario):
    dueno, m, *_ = escenario
    hora = datetime.combine(MANANA, time(10, 0))
    cita = CitaService(db).create(
        CitaCreate(idUsuario=dueno.idUsuario, idMascota=m.idMascota, fechaHora=hora),
        rol_usuario_actual="administrador",
    )
    assert cita.fechaHora == hora and cita.idFranja is None
