"""Día 9 · P5: pruebas del esquema sanitario (gatos, refuerzos, límites de fechas, permisos y datos)."""
from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from core.esquema_sanitario import Aplicacion, calcular_esquema
from models.mascota import Mascota
from models.user import User
from models.vacuna import Vacuna
from schemas.vacuna import VacunaCreate
from service.esquema_sanitario import EsquemaSanitarioService

HOY = date(2026, 10, 13)


def item(r, clave):
    return next(i for i in r["items"] if i.clave == clave)


def ap(i, nombre, fecha, prox=None):
    return Aplicacion(i, nombre, fecha, prox)


def serie_polivalente(ultima_proxima=None):
    """Serie completa (3 dosis) de polivalente; la última puede traer la 'próxima dosis' del veterinario."""
    return {"vacuna": [
        ap(1, "Polivalente DHPP", date(2025, 11, 1)),
        ap(2, "Polivalente DHPP", date(2025, 11, 22)),
        ap(3, "Polivalente DHPP", date(2025, 12, 13), ultima_proxima),
    ]}


# ---------- gatos ----------

def test_gatito_recibe_las_fechas_por_edad():
    nac = HOY - timedelta(weeks=7)
    r = calcular_esquema("Felino", nac, {}, HOY)
    assert item(r, "triple_felina").fecha_objetivo == nac + timedelta(weeks=8)
    assert item(r, "rabia").fecha_objetivo == nac + timedelta(weeks=12)
    assert item(r, "antipulgas").fecha_objetivo == nac + timedelta(days=56)
    assert item(r, "leucemia_felina").estado == "opcional"


def test_gato_adulto_sin_registros_tiene_la_triple_vencida():
    r = calcular_esquema("Felino", HOY - timedelta(days=800), {}, HOY)
    assert item(r, "triple_felina").estado == "vencida"
    assert item(r, "leucemia_felina").estado == "opcional"


# ---------- refuerzos y ciclos ----------

def test_un_refuerzo_despues_de_la_serie_reinicia_el_ciclo_anual():
    nac = HOY - timedelta(days=900)
    apps = {"vacuna": [
        ap(1, "Polivalente DHPP", date(2024, 11, 1)), ap(2, "Polivalente DHPP", date(2024, 11, 22)),
        ap(3, "Polivalente DHPP", date(2024, 12, 13)), ap(4, "Polivalente DHPP", date(2025, 11, 1))]}
    poli = item(calcular_esquema("Canino", nac, apps, HOY), "polivalente_canina")
    assert poli.dosis_aplicadas == 4
    assert poli.fecha_objetivo == date(2026, 11, 1)
    assert poli.estado == "proxima" and poli.dias_restantes == 19


@pytest.mark.parametrize("dias_hasta_la_proxima,esperado", [
    (31, "al_dia"), (30, "proxima"), (0, "proxima"), (-1, "vencida"),
])
def test_limites_de_dias_para_clasificar(dias_hasta_la_proxima, esperado):
    proxima = HOY + timedelta(days=dias_hasta_la_proxima)
    r = calcular_esquema("Canino", HOY - timedelta(days=700), serie_polivalente(proxima), HOY)
    assert item(r, "polivalente_canina").estado == esperado


def test_los_mensajes_estan_en_espanol_y_dicen_cuanto_falta():
    nac = HOY - timedelta(days=700)
    vencida = item(calcular_esquema("Canino", nac, serie_polivalente(HOY - timedelta(days=1)), HOY), "polivalente_canina")
    hoy = item(calcular_esquema("Canino", nac, serie_polivalente(HOY), HOY), "polivalente_canina")
    assert "Atrasada 1 día(s)" in vencida.mensaje
    assert hoy.mensaje == "Le toca hoy."


def test_sin_fecha_de_nacimiento_se_usa_el_intervalo_de_21_dias_entre_dosis():
    apps = {"vacuna": [ap(1, "Polivalente DHPP", date(2026, 10, 1))]}
    poli = item(calcular_esquema("Canino", None, apps, HOY), "polivalente_canina")
    assert poli.fecha_objetivo == date(2026, 10, 22) and poli.estado == "proxima"


def test_el_nombre_en_mayusculas_y_con_tilde_se_reconoce():
    r = calcular_esquema("Canino", HOY - timedelta(days=700), {"vacuna": [ap(1, "ANTIRRÁBICA", date(2026, 6, 1))]}, HOY)
    assert item(r, "rabia").dosis_aplicadas == 1 and item(r, "rabia").estado == "al_dia"


# ---------- desparasitación y antipulgas ----------

@pytest.mark.parametrize("semanas,intervalo_dias", [(10, 14), (11, 14), (12, 30), (25, 30), (26, 90), (200, 90)])
def test_intervalo_de_desparasitacion_segun_la_edad(semanas, intervalo_dias):
    nac = HOY - timedelta(weeks=semanas)
    aplicada = HOY - timedelta(days=5)
    r = calcular_esquema("Canino", nac, {"desparasitacion": [ap(1, "Drontal", aplicada)]}, HOY)
    assert item(r, "desparasitacion").fecha_objetivo == aplicada + timedelta(days=intervalo_dias)


def test_la_fecha_que_escribe_el_veterinario_manda_en_antipulgas():
    prox = HOY + timedelta(days=45)
    r = calcular_esquema("Canino", HOY - timedelta(days=700), {"antipulgas": [ap(1, "Bravecto", HOY - timedelta(days=5), prox)]}, HOY)
    assert item(r, "antipulgas").fecha_objetivo == prox and item(r, "antipulgas").estado == "al_dia"


# ---------- resumen y especies ----------

def test_el_resumen_cuenta_los_mismos_estados_que_los_items():
    r = calcular_esquema("Canino", HOY - timedelta(days=800), {}, HOY)
    for estado, cantidad in r["resumen"].items():
        assert cantidad == sum(1 for i in r["items"] if i.estado == estado)
    assert sum(r["resumen"].values()) == len(r["items"])


def test_otra_especie_solo_trae_desparasitacion_y_avisa_que_no_hay_esquema():
    r = calcular_esquema("Ave", HOY - timedelta(days=400), {}, HOY)
    assert r["tiene_esquema"] is False
    assert [i.clave for i in r["items"]] == ["desparasitacion"]
    assert "no hay un esquema estándar" in r["nota"]


# ---------- servicio: permisos y datos ----------

@pytest.fixture
def mundo(db):
    ana = User(nombre="Ana", apellido="Ruiz", email="ana@test.com", contrasena="x", rol="dueno")
    luis = User(nombre="Luis", apellido="Mora", email="luis@test.com", contrasena="x", rol="dueno")
    vet = User(nombre="Vet", apellido="Uno", email="vet@test.com", contrasena="x", rol="veterinario")
    admin = User(nombre="Admin", apellido="Uno", email="admin@test.com", contrasena="x", rol="administrador")
    db.add_all([ana, luis, vet, admin])
    db.flush()
    nac = date.today() - timedelta(days=800)
    zeus = Mascota(nombre_mascota="Zeus", especie="Canino", idUsuario=ana.idUsuario, fechaNacimiento=nac)
    bola = Mascota(nombre_mascota="Bola", especie="Felino", idUsuario=ana.idUsuario, fechaNacimiento=nac)
    viejo = Mascota(nombre_mascota="Viejo", especie="Canino", idUsuario=ana.idUsuario, estado="inactivo")
    ajena = Mascota(nombre_mascota="Ajena", especie="Canino", idUsuario=luis.idUsuario, fechaNacimiento=nac)
    db.add_all([zeus, bola, viejo, ajena])
    db.commit()
    return {"ana": ana, "luis": luis, "vet": vet, "admin": admin, "zeus": zeus, "ajena": ajena}


def test_veterinario_y_administrador_ven_el_esquema_de_cualquier_mascota(db, mundo):
    for rol in ("vet", "admin"):
        r = EsquemaSanitarioService(db).por_mascota(mundo["ajena"].idMascota, mundo[rol])
        assert r["nombre_mascota"] == "Ajena"


def test_el_dueno_no_ve_el_esquema_de_la_mascota_de_otro(db, mundo):
    with pytest.raises(HTTPException) as e:
        EsquemaSanitarioService(db).por_mascota(mundo["ajena"].idMascota, mundo["ana"])
    assert e.value.status_code == 403


def test_mascota_inexistente_da_404(db, mundo):
    with pytest.raises(HTTPException) as e:
        EsquemaSanitarioService(db).por_mascota(9999, mundo["vet"])
    assert e.value.status_code == 404


def test_el_listado_del_dueno_excluye_inactivas_y_va_por_nombre(db, mundo):
    nombres = [m["nombre_mascota"] for m in EsquemaSanitarioService(db).del_dueno(mundo["ana"])]
    assert nombres == ["Bola", "Zeus"]


def test_una_aplicacion_nueva_se_refleja_en_el_esquema(db, mundo):
    zeus = mundo["zeus"]
    antes = item_del_servicio(db, zeus, "rabia")
    assert antes["estado"] == "vencida" and antes["dosis_aplicadas"] == 0
    db.add(Vacuna(tipo="vacuna", nombre_vacuna="Antirrábica", fecha_aplicacion=date.today() - timedelta(days=10), idMascota=zeus.idMascota))
    db.commit()
    despues = item_del_servicio(db, zeus, "rabia")
    assert despues["estado"] == "al_dia" and despues["dosis_aplicadas"] == 1


def item_del_servicio(db, mascota, clave):
    return next(i for i in EsquemaSanitarioService(db).de_mascota(mascota)["items"] if i["clave"] == clave)


# ---------- validación de lo que se registra ----------

def datos_vacuna(**cambios):
    base = dict(nombre_vacuna="Antirrábica", fecha_aplicacion=date(2026, 10, 1), idMascota=1)
    return VacunaCreate(**{**base, **cambios})


def test_la_proxima_dosis_debe_ser_posterior_a_la_aplicacion():
    assert datos_vacuna(proxima_dosis=date(2027, 10, 1)).proxima_dosis == date(2027, 10, 1)
    for fecha in (date(2026, 10, 1), date(2026, 9, 1)):
        with pytest.raises(ValidationError):
            datos_vacuna(proxima_dosis=fecha)


def test_el_nombre_de_la_vacuna_no_puede_traer_html():
    with pytest.raises(ValidationError):
        datos_vacuna(nombre_vacuna="<b>Rabia</b>")