import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from models.historial import HistorialClinico
from models.mascota import Mascota
from models.user import User
from schemas.formula import FormulaIn, FormulaOut, MedicamentoIn
from service.formula import FormulaService, resumen_medicamento


@pytest.fixture
def historial(db):
    d = User(nombre="Ana", apellido="Ruiz", email="a@t.com", contrasena="x", rol="dueno")
    v = User(nombre="Vera", apellido="Vet", email="v@t.com", contrasena="x", rol="veterinario")
    db.add_all([d, v]); db.flush()
    m = Mascota(nombre_mascota="Luna", especie="Canino", idUsuario=d.idUsuario)
    db.add(m); db.flush()
    h = HistorialClinico(idMascota=m.idMascota, idUsuario=v.idUsuario)
    db.add(h); db.commit()
    return h


def med(**extra):
    datos = dict(nombre_medicamento="Amoxicilina", presentacion="250 mg", dosis="1 tableta",
                 via_administracion="oral", frecuencia="cada 8 horas", duracion_dias=7, cantidad=21)
    datos.update(extra)
    return MedicamentoIn(**datos)


def test_medicamento_exige_dosis_frecuencia_y_duracion():
    for faltante in ("dosis", "frecuencia", "duracion_dias"):
        datos = dict(nombre_medicamento="X", dosis="1", frecuencia="c/8h", duracion_dias=3)
        datos.pop(faltante)
        with pytest.raises(ValidationError):
            MedicamentoIn(**datos)


def test_texto_vacio_o_html_se_rechaza():
    with pytest.raises(ValidationError):
        med(dosis="   ")
    with pytest.raises(ValidationError):
        med(indicaciones="<img src=x onerror=alert(1)>")
    with pytest.raises(ValidationError):
        FormulaIn(medicamentos=[])


def test_crear_formula_y_resumen_legado(db, historial):
    f = FormulaService(db).crear(historial.idHistorial, FormulaIn(recomendaciones="Reposo", medicamentos=[med()]))
    assert f.estado == "activa" and f.medicamentos[0].nombre_medicamento == "Amoxicilina"
    db.refresh(historial)
    assert "Amoxicilina 250 mg: 1 tableta, vía oral, cada 8 horas, por 7 días" in historial.medicamentos


def test_resumen_singular_para_un_dia(db, historial):
    f = FormulaService(db).crear(historial.idHistorial, FormulaIn(medicamentos=[med(duracion_dias=1)]))
    assert resumen_medicamento(f.medicamentos[0]).endswith("por 1 día")


def test_actualizar_reemplaza_los_medicamentos(db, historial):
    srv = FormulaService(db)
    f = srv.crear(historial.idHistorial, FormulaIn(medicamentos=[med(), med(nombre_medicamento="Omeprazol")]))
    f = srv.actualizar(f.idFormula, FormulaIn(recomendaciones="Nuevo", medicamentos=[med(nombre_medicamento="Meloxicam")]))
    assert [m.nombre_medicamento for m in f.medicamentos] == ["Meloxicam"]
    assert f.indicaciones_generales == "Nuevo"


def test_anulada_no_se_edita_ni_se_lista_ni_se_imprime(db, historial):
    srv = FormulaService(db)
    f = srv.crear(historial.idHistorial, FormulaIn(medicamentos=[med()]))
    srv.anular(f.idFormula)
    with pytest.raises(HTTPException):
        srv.actualizar(f.idFormula, FormulaIn(medicamentos=[med()]))
    with pytest.raises(HTTPException):
        srv.anular(f.idFormula)
    assert srv.get_by_historial(historial.idHistorial) == []
    db.refresh(historial)
    assert historial.medicamentos is None


def test_salida_expone_recomendaciones_para_la_hoja_impresa(db, historial):
    f = FormulaService(db).crear(historial.idHistorial, FormulaIn(recomendaciones="Dieta blanda", medicamentos=[med()]))
    out = FormulaOut.model_validate(f)
    assert out.recomendaciones == "Dieta blanda" and out.medicamentos[0].duracion_dias == 7
