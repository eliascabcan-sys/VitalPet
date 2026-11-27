"""Día 9 · P2: alerta grave (nivel rojo) = correo inmediato al dueño y a la clínica."""
import asyncio

import pytest

import service.alerta_grave as alerta_grave
import service.automatizacion as automatizacion
from core.email import html_alerta_grave_clinica, html_alerta_grave_dueno
from models.mascota import Mascota
from models.user import User
from schemas.reporte_salud import ReporteSaludCreate
from service.alerta_grave import correos_de_la_clinica, es_grave, notificar_alerta_grave
from service.reporte_salud import ReporteSaludService


@pytest.fixture
def escenario(db):
    dueno = User(nombre="Ana", apellido="Ruiz", email="ana@test.com", contrasena="x", rol="dueno", telefono="3001234567")
    vet = User(nombre="Vet", apellido="Uno", email="vet@test.com", contrasena="x", rol="veterinario")
    admin = User(nombre="Admin", apellido="Uno", email="admin@test.com", contrasena="x", rol="administrador")
    inactivo = User(nombre="Vet", apellido="Viejo", email="viejo@test.com", contrasena="x", rol="veterinario", estado="inactivo")
    db.add_all([dueno, vet, admin, inactivo])
    db.flush()
    mascota = Mascota(nombre_mascota="Luna", especie="Canino", idUsuario=dueno.idUsuario)
    db.add(mascota)
    db.commit()
    return dueno, mascota


@pytest.fixture
def correos(monkeypatch):
    """Cambia el envío real por uno que solo anota a quién se le habría enviado."""
    enviados = {"dueno": [], "clinica": []}

    async def falso_dueno(email, *args):
        enviados["dueno"].append((email, args))

    async def falso_clinica(email, *args):
        enviados["clinica"].append((email, args))

    monkeypatch.setattr(alerta_grave, "enviar_email_alerta_grave_dueno", falso_dueno)
    monkeypatch.setattr(alerta_grave, "enviar_email_alerta_grave_clinica", falso_clinica)
    monkeypatch.setattr(automatizacion, "_run_async", lambda coro: asyncio.run(coro))
    monkeypatch.setattr(alerta_grave.clinica, "CLINICA_EMAIL", "")
    return enviados


def test_solo_el_rojo_es_grave():
    assert es_grave("rojo") is True
    assert all(not es_grave(n) for n in ("naranja", "amarillo", "verde", "azul", None))


def test_correos_de_la_clinica_son_personal_activo_sin_repetir(db, escenario, monkeypatch):
    monkeypatch.setattr(alerta_grave.clinica, "CLINICA_EMAIL", "Clinica@test.com")
    assert sorted(correos_de_la_clinica(db)) == ["Clinica@test.com", "admin@test.com", "vet@test.com"]
    monkeypatch.setattr(alerta_grave.clinica, "CLINICA_EMAIL", "VET@test.com")   # repetido con otra mayúscula
    assert sorted(c.lower() for c in correos_de_la_clinica(db)) == ["admin@test.com", "vet@test.com"]


def test_avisa_al_dueno_y_a_toda_la_clinica(db, escenario, correos):
    _, mascota = escenario
    r = notificar_alerta_grave(db, mascota, "No comió y está sin energía.", "Reporte de salud")
    assert r == {"dueno": True, "clinica": 2}
    assert correos["dueno"][0][0] == "ana@test.com"
    assert sorted(c[0] for c in correos["clinica"]) == ["admin@test.com", "vet@test.com"]
    assert correos["clinica"][0][1][1] == "Ana Ruiz"          # nombre del dueño
    assert correos["clinica"][0][1][2] == "3001234567"        # su teléfono, para llamarlo


def test_dueno_sin_correo_no_frena_el_aviso_a_la_clinica(db, escenario, correos):
    dueno, mascota = escenario
    dueno.email = ""      # la columna no admite NULL; un correo vacío cuenta como "sin correo"
    db.commit()
    r = notificar_alerta_grave(db, mascota, "motivo", "origen")
    assert r["dueno"] is False and r["clinica"] == 2


def test_un_error_al_enviar_no_rompe_la_operacion(db, escenario, monkeypatch):
    _, mascota = escenario

    def explota(coro):
        coro.close()
        raise RuntimeError("sin red")

    monkeypatch.setattr(automatizacion, "_run_async", explota)
    assert notificar_alerta_grave(db, mascota, "motivo", "origen") == {"dueno": False, "clinica": 0}


# ---------- dónde se dispara ----------

def test_reporte_de_salud_rojo_dispara_la_alerta(db, escenario, correos):
    dueno, mascota = escenario
    datos = ReporteSaludCreate(idMascota=mascota.idMascota, alimentacion="No comió", actividad="Sin energía", sintomas="Ninguno")
    reporte = ReporteSaludService(db).crear(datos, dueno.idUsuario)
    assert reporte.nivel == "rojo"
    assert len(correos["dueno"]) == 1 and len(correos["clinica"]) == 2


def test_reporte_naranja_no_dispara_correos_graves(db, escenario, correos):
    dueno, mascota = escenario
    datos = ReporteSaludCreate(idMascota=mascota.idMascota, alimentacion="Sí, normal", actividad="Decaída", sintomas="Ninguno")
    assert ReporteSaludService(db).crear(datos, dueno.idUsuario).nivel == "naranja"
    assert correos["dueno"] == [] and correos["clinica"] == []


def test_alerta_que_sube_a_rojo_avisa_a_dueno_y_clinica(db, escenario, monkeypatch):
    from types import SimpleNamespace
    _, mascota = escenario
    alerta = SimpleNamespace(nivel="rojo", idAlerta=1,
                            seguimiento=SimpleNamespace(historial=SimpleNamespace(mascota=mascota)))
    llamadas = []
    monkeypatch.setattr(automatizacion, "reescalar_alertas", lambda _db: [alerta])
    monkeypatch.setattr(automatizacion, "notificar_alerta_grave",
                        lambda _db, m, motivo, origen: llamadas.append((m.nombre_mascota, origen)))
    r = automatizacion.reescalar_y_notificar(db)
    assert r["rojas_notificadas"] == 1 and llamadas == [("Luna", "Alerta sin atender")]


# ---------- contenido de los correos ----------

def test_correo_del_dueno_dice_que_hacer_y_escapa_html():
    html = html_alerta_grave_dueno("Ana", "Luna <b>", "<script>x</script>", "(601) 234-5678")
    assert "(601) 234-5678" in html and 'href="tel:6012345678"' in html
    assert "<script>" not in html and "Luna &lt;b&gt;" in html


def test_correo_de_la_clinica_trae_contacto_y_enlace_a_alertas():
    html = html_alerta_grave_clinica("Luna", "Ana Ruiz", "3001234567", "No comió", "Reporte de salud")
    assert "3001234567" in html and "Reporte de salud" in html and "/admin/alertas" in html
    assert "sin teléfono registrado" in html_alerta_grave_clinica("Luna", "Ana", None, "m", "o")