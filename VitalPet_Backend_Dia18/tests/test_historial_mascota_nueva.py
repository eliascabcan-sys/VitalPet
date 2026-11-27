"""
Historia clínica: regla de "mascota nueva" (solo anamnesis, sin diagnóstico),
peso en cada control y secciones guardadas junto con el registro.
"""
from decimal import Decimal

import pytest
from fastapi import HTTPException

from models.historial import HistorialClinico
from models.mascota import Mascota
from models.user import User
from schemas.historial import HistorialCreate, HistorialUpdate, SeccionIn
from service.historial import HistorialService


@pytest.fixture
def mascota(db):
    dueno = User(nombre="Ana", apellido="Ruiz", email="ana@test.com", contrasena="x", rol="dueno")
    vet = User(nombre="Vera", apellido="Gil", email="vera@test.com", contrasena="x", rol="veterinario")
    db.add_all([dueno, vet])
    db.flush()
    m = Mascota(nombre_mascota="Luna", especie="Canino", idUsuario=dueno.idUsuario)
    db.add(m)
    db.flush()
    # Igual que service/mascota.py (RQF-12): historial vacío automático al registrar.
    db.add(HistorialClinico(
        idMascota=m.idMascota, idUsuario=vet.idUsuario,
        observaciones="Historial creado automaticamente al registrar la mascota.",
    ))
    db.commit()
    m.__dict__["_vet"] = vet.idUsuario
    return m


def nuevo(m, **extra):
    datos = dict(idMascota=m.idMascota, idUsuario=m.__dict__["_vet"],
                 motivo_consulta="Control", peso_consulta=Decimal("12.5"))
    datos.update(extra)
    return HistorialCreate(**datos)


def test_mascota_recien_registrada_es_nueva_aunque_tenga_historial_vacio(db, mascota):
    estado = HistorialService(db).estado_clinico_mascota(mascota.idMascota)
    assert estado["mascota_nueva"] is True
    assert estado["consultas_previas"] == 0
    assert "diagnostico" in estado["campos_bloqueados"]
    assert "diagnostico_definitivo" in estado["secciones_bloqueadas"]


def test_primera_consulta_rechaza_diagnostico(db, mascota):
    with pytest.raises(HTTPException) as e:
        HistorialService(db).create(nuevo(mascota, diagnostico="Otitis"))
    assert e.value.status_code == 400
    assert "mascota es nueva" in e.value.detail


def test_primera_consulta_rechaza_secciones_de_diagnostico(db, mascota):
    secciones = [SeccionIn(tipo="diagnostico_presuntivo", contenido="Gastritis")]
    with pytest.raises(HTTPException) as e:
        HistorialService(db).create(nuevo(mascota, secciones=secciones))
    assert e.value.status_code == 400


def test_primera_consulta_con_anamnesis_se_guarda_y_actualiza_el_peso(db, mascota):
    secciones = [
        SeccionIn(tipo="anamnesis", contenido="Vomita desde ayer"),
        SeccionIn(tipo="examen_fisico", contenido="Abdomen sensible"),
    ]
    h = HistorialService(db).create(nuevo(mascota, secciones=secciones))
    assert h.mascota_nueva is True
    assert {s.tipo for s in h.secciones} == {"anamnesis", "examen_fisico"}
    db.refresh(mascota)
    assert mascota.peso_kg == Decimal("12.50")


def test_el_peso_es_obligatorio_en_cada_control(db, mascota):
    with pytest.raises(HTTPException) as e:
        HistorialService(db).create(nuevo(mascota, peso_consulta=None))
    assert e.value.status_code == 400
    assert "peso" in e.value.detail.lower()


def test_segunda_consulta_ya_permite_diagnostico(db, mascota):
    svc = HistorialService(db)
    svc.create(nuevo(mascota))                       # 1.ª consulta (anamnesis/examen)
    assert svc.estado_clinico_mascota(mascota.idMascota)["mascota_nueva"] is False
    h2 = svc.create(nuevo(mascota, diagnostico="Gastritis", peso_consulta=Decimal("12.1")))
    assert h2.diagnostico == "Gastritis"
    assert h2.mascota_nueva is False


def test_editar_la_primera_consulta_sigue_bloqueando_el_diagnostico(db, mascota):
    svc = HistorialService(db)
    h1 = svc.create(nuevo(mascota))
    svc.create(nuevo(mascota, diagnostico="Gastritis"))   # la 2.ª sí puede
    with pytest.raises(HTTPException):
        svc.update(h1.idHistorial, HistorialUpdate(diagnostico="Otitis"))


def test_un_diagnostico_que_ya_estaba_guardado_no_bloquea_otras_ediciones(db, mascota):
    svc = HistorialService(db)
    h1 = svc.create(nuevo(mascota))
    # Dato antiguo: la 1.ª consulta ya traía diagnóstico (antes de existir la regla).
    db.query(HistorialClinico).filter_by(idHistorial=h1.idHistorial).update({"diagnostico": "Otitis"})
    db.commit()
    h = svc.update(h1.idHistorial, HistorialUpdate(diagnostico="Otitis", observaciones="Revisar en 3 días"))
    assert h.observaciones == "Revisar en 3 días"


def test_no_se_puede_borrar_el_peso_de_un_control(db, mascota):
    svc = HistorialService(db)
    h1 = svc.create(nuevo(mascota))
    with pytest.raises(HTTPException):
        svc.update(h1.idHistorial, HistorialUpdate(peso_consulta=None))


def test_pesos_por_mascota_en_orden(db, mascota):
    svc = HistorialService(db)
    svc.create(nuevo(mascota, peso_consulta=Decimal("12.5")))
    svc.create(nuevo(mascota, peso_consulta=Decimal("13.0")))
    pesos = svc.pesos_por_mascota(mascota.idMascota)
    assert [p["peso_kg"] for p in pesos] == [Decimal("12.50"), Decimal("13.00")]
    db.refresh(mascota)
    assert mascota.peso_kg == Decimal("13.00")   # el último control manda
