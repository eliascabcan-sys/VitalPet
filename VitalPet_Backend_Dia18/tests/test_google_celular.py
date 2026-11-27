import importlib
from datetime import date, datetime, time, timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient

from models.cita import Cita
from models.franja_horaria import FranjaHoraria
from models.mascota import Mascota
from models.user import User
from models.veterinario import Veterinario
from service.citas import CitaService


def _cliente(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "x.apps.googleusercontent.com")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "s")
    monkeypatch.delenv("PUBLIC_URL", raising=False)
    import api.vs1.auth_google as m
    m = importlib.reload(m)
    app = FastAPI()
    app.include_router(m.router, prefix="/auth")
    return TestClient(app, follow_redirects=False)


def test_en_el_pc_el_redirect_sigue_siendo_localhost(monkeypatch):
    r = _cliente(monkeypatch).get("/auth/google/login", headers={"host": "localhost:5173"})
    assert "redirect_uri=http%3A%2F%2Flocalhost%3A8000" in r.headers["location"]


def test_en_el_celular_el_redirect_usa_la_direccion_publica(monkeypatch):
    r = _cliente(monkeypatch).get(
        "/auth/google/login",
        headers={"host": "localhost:8000", "x-forwarded-host": "abc.ngrok-free.app", "x-forwarded-proto": "https"},
    )
    assert "redirect_uri=https%3A%2F%2Fabc.ngrok-free.app%2Fapi%2Fvs1%2Fauth%2Fgoogle%2Fcallback" in r.headers["location"]


def test_cita_con_hora_exacta_cuenta_en_el_cupo_de_la_franja(db):
    d = User(nombre="A", apellido="B", email="a@t.com", contrasena="x", rol="dueno")
    u = User(nombre="V", apellido="V", email="v@t.com", contrasena="x", rol="veterinario")
    db.add_all([d, u]); db.flush()
    v = Veterinario(especialidad="Medicina general", tarjetaProfesional="TP-9", idUsuario=u.idUsuario)
    m = Mascota(nombre_mascota="Luna", especie="Canino", idUsuario=d.idUsuario)
    f = FranjaHoraria(nombre="Mañana", hora_inicio=time(8), hora_fin=time(12), cupo_maximo=6)
    db.add_all([v, m, f]); db.flush()
    dia = date.today() + timedelta(days=3)
    db.add(Cita(idMascota=m.idMascota, idUsuario=d.idUsuario, idVeterinario=v.idVeterinario,
                fechaHora=datetime.combine(dia, time(9, 30)), estado="pendiente", idFranja=None))
    db.commit()
    ag = CitaService(db).agenda_veterinario(v.idVeterinario, dia, "dia")
    fr = ag["dias"][0]["franjas"][0]
    assert fr["cupos_usados"] == 1 and len(fr["citas"]) == 1
    assert ag["dias"][0]["citas_hora_exacta"] == []