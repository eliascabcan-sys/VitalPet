"""Ficha del paciente (todo junto) y cita de control en la fórmula."""
from datetime import date, datetime, time, timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException

from models.cita import Cita
from models.formula import FormulaMedica, FormulaMedicamento
from models.franja_horaria import FranjaHoraria
from models.historial import HistorialClinico
from models.laboratorio import ExamenLaboratorio
from models.mascota import Mascota
from models.product import Product
from models.user import User
from models.vacuna import Vacuna
from models.venta import Venta
from models.detalle_venta import DetalleVenta
from models.veterinario import Veterinario
from schemas.certificado import CertificadoCreate
from schemas.historial import HistorialCreate, SeccionIn
from service.certificado import CertificadoService
from service.ficha import FichaService
from service.historial import HistorialService

MANANA = datetime.combine(date.today() + timedelta(days=2), time(8, 0))


@pytest.fixture
def paciente(db):
    dueno = User(nombre="Ana", apellido="Ruiz", telefono="3001112233", email="ana@t.com", contrasena="x", rol="dueno")
    vet_u = User(nombre="Vera", apellido="Gil", email="vera@t.com", contrasena="x", rol="veterinario")
    db.add_all([dueno, vet_u]); db.flush()
    vet = Veterinario(tarjetaProfesional="TP-100", idUsuario=vet_u.idUsuario, estado="activo")
    m = Mascota(nombre_mascota="Luna", especie="Canino", raza="Criollo", idUsuario=dueno.idUsuario)
    db.add_all([vet, m]); db.flush()
    # historial vacío que el sistema crea solo al registrar la mascota (no es un control)
    db.add(HistorialClinico(idMascota=m.idMascota, idUsuario=vet_u.idUsuario,
                            observaciones="Historial creado automaticamente al registrar la mascota."))
    db.commit()
    return dict(dueno=dueno, vet_u=vet_u, vet=vet, m=m)


def consulta(db, p, **extra):
    datos = dict(idMascota=p["m"].idMascota, idUsuario=p["vet_u"].idUsuario,
                 motivo_consulta="Control", peso_consulta=Decimal("12.5"))
    datos.update(extra)
    return HistorialService(db).create(HistorialCreate(**datos))


def test_ficha_reune_todo_y_no_cuenta_el_historial_vacio(db, paciente):
    p, m = paciente, paciente["m"]
    h1 = consulta(db, p, secciones=[SeccionIn(tipo="anamnesis", contenido="Vomita"),
                                   SeccionIn(tipo="inyectologia", contenido="Maropitant 1 ml SC")])
    h2 = consulta(db, p, diagnostico="Gastritis", peso_consulta=Decimal("13"))

    db.add(FormulaMedica(idHistorial=h2.idHistorial, indicaciones_generales="Dieta blanda", estado="activa",
                         medicamentos=[FormulaMedicamento(nombre_medicamento="Omeprazol", dosis="1 tab",
                                                          frecuencia="c/24h", duracion_dias=5)]))
    db.add_all([
        Vacuna(idMascota=m.idMascota, tipo="vacuna", nombre_vacuna="Parvovirus", fecha_aplicacion=date.today(), lote="V1"),
        Vacuna(idMascota=m.idMascota, tipo="desparasitacion", nombre_vacuna="Drontal", fecha_aplicacion=date.today()),
        Vacuna(idMascota=m.idMascota, tipo="antipulgas", nombre_vacuna="Bravecto", fecha_aplicacion=date.today()),
        ExamenLaboratorio(idHistorial=h2.idHistorial, idMascota=m.idMascota, idUsuarioSolicita=p["vet_u"].idUsuario,
                          categoria="hematologia", tipo_examen="Hemograma"),
    ])
    prod = Product(nombre_producto="Omeprazol 20 mg", precio=10, idCategoria=1)
    db.add(prod); db.flush()
    venta = Venta(idUsuario=p["dueno"].idUsuario, total=20, estado="pagada", idHistorial=h2.idHistorial)
    db.add(venta); db.flush()
    db.add(DetalleVenta(idVenta=venta.idVenta, idProducto=prod.idProducto, cantidad=2, precioUnitario=10, subtotal=20))
    db.add(Cita(fechaHora=MANANA, idUsuario=p["dueno"].idUsuario, idMascota=m.idMascota, estado="pendiente"))
    db.commit()
    CertificadoService(db).emitir(CertificadoCreate(idMascota=m.idMascota, tipo="salud", contenido="Sano"), p["vet_u"])

    f = FichaService(db).de_mascota(m.idMascota, p["vet_u"])

    assert f["mascota"].nombre_mascota == "Luna" and f["dueno"].telefono == "3001112233"
    assert len(f["controles"]) == 2                              # el historial vacío no cuenta
    nuevo, antiguo = f["controles"][0], f["controles"][1]        # más reciente primero
    assert antiguo["anamnesis"] == "Vomita" and nuevo["diagnostico"] == "Gastritis"
    assert [i["contenido"] for i in f["inyecciones"]] == ["Maropitant 1 ml SC"]
    assert [x.medicamentos[0].nombre_medicamento for x in f["formulas"]] == ["Omeprazol"]
    assert f["formulas"][0].diagnostico == "Gastritis"
    assert [v["lote"] for v in f["vacunas"]] == ["V1"]
    assert f["desparasitaciones"][0]["nombre"] == "Drontal" and f["antipulgas"][0]["nombre"] == "Bravecto"
    assert len(f["laboratorio"]) == 1
    assert f["compras"][0]["items"][0]["nombre_producto"] == "Omeprazol 20 mg"
    assert len(f["citas"]) == 1 and len(f["certificados"]) == 1
    assert f["cita_control"]["fechaHora"] == MANANA            # la misma cita que verá la fórmula
    assert [x["peso_kg"] for x in f["pesos"]] == [Decimal("12.50"), Decimal("13.00")]
    r = f["resumen"]
    assert (r["total_controles"], r["total_formulas"], r["total_examenes"], r["total_compras"]) == (2, 1, 1, 1)
    assert r["total_aplicaciones"] == 3 and r["total_certificados"] == 1


def test_ficha_de_una_mascota_inexistente_da_404(db, paciente):
    with pytest.raises(HTTPException) as e:
        FichaService(db).de_mascota(999, paciente["vet_u"])
    assert e.value.status_code == 404


def test_ficha_de_mascota_sin_nada_viene_vacia(db, paciente):
    f = FichaService(db).de_mascota(paciente["m"].idMascota, paciente["vet_u"])
    assert f["controles"] == [] and f["formulas"] == [] and f["compras"] == []
    assert f["resumen"]["ultima_consulta"] is None


# ---------- cita de control en la fórmula ----------
def formula_en(db, h):
    db.add(FormulaMedica(idHistorial=h.idHistorial, estado="activa",
                         medicamentos=[FormulaMedicamento(nombre_medicamento="X", dosis="1", frecuencia="c/8h", duracion_dias=3)]))
    db.commit()


def test_la_formula_muestra_la_proxima_cita_agendada(db, paciente):
    p, m = paciente, paciente["m"]
    h = consulta(db, p)
    formula_en(db, h)
    assert HistorialService(db).get_by_id(h.idHistorial).cita_control is None     # aún no hay cita

    franja = FranjaHoraria(nombre="Mañana", hora_inicio=time(8), hora_fin=time(12), cupo_maximo=3)
    db.add(franja); db.flush()
    db.add(Cita(fechaHora=MANANA, idUsuario=p["dueno"].idUsuario, idMascota=m.idMascota,
                idFranja=franja.idFranja, idVeterinario=p["vet"].idVeterinario, estado="confirmada"))
    db.commit()
    c = HistorialService(db).get_by_id(h.idHistorial).cita_control
    assert c["franja_nombre"] == "Mañana" and c["nombre_veterinario"] == "Vera Gil"
    assert c["estado"] == "confirmada"


def test_una_cita_cancelada_no_aparece_en_la_formula(db, paciente):
    p, m = paciente, paciente["m"]
    h = consulta(db, p)
    formula_en(db, h)
    db.add(Cita(fechaHora=MANANA, idUsuario=p["dueno"].idUsuario, idMascota=m.idMascota, estado="cancelada"))
    db.commit()
    assert HistorialService(db).get_by_id(h.idHistorial).cita_control is None


def test_sin_formula_no_se_calcula_la_cita_de_control(db, paciente):
    p, m = paciente, paciente["m"]
    h = consulta(db, p)
    db.add(Cita(fechaHora=MANANA, idUsuario=p["dueno"].idUsuario, idMascota=m.idMascota, estado="pendiente"))
    db.commit()
    assert HistorialService(db).get_by_id(h.idHistorial).__dict__.get("cita_control") is None
