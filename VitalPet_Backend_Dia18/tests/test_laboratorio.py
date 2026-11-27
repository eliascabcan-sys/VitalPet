"""P1 - Laboratorio clínico: el veterinario crea y edita, el dueño solo ve lo suyo."""
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from models.historial import HistorialClinico
from models.mascota import Mascota
from models.user import User
from schemas.laboratorio import ExamenCreate, ExamenUpdate
from service.laboratorio import LaboratorioService


@pytest.fixture
def escenario(db):
    vet = User(nombre="Vera", apellido="Vet", email="vet@test.com", contrasena="x", rol="veterinario")
    dueno = User(nombre="Ana", apellido="Ruiz", email="ana@test.com", contrasena="x", rol="dueno")
    otro = User(nombre="Beto", apellido="Gil", email="beto@test.com", contrasena="x", rol="dueno")
    db.add_all([vet, dueno, otro])
    db.flush()
    luna = Mascota(nombre_mascota="Luna", especie="Canino", idUsuario=dueno.idUsuario)
    rocky = Mascota(nombre_mascota="Rocky", especie="Canino", idUsuario=otro.idUsuario)
    db.add_all([luna, rocky])
    db.flush()
    h = HistorialClinico(idMascota=luna.idMascota, idUsuario=vet.idUsuario, motivo_consulta="Control")
    db.add(h)
    db.commit()
    return vet, dueno, otro, luna, h


def pedir(db, vet, h, **extra):
    datos = dict(idHistorial=h.idHistorial, categoria="hematologia", tipo_examen="Hemograma completo")
    datos.update(extra)
    return LaboratorioService(db).crear(ExamenCreate(**datos), vet)


def test_el_veterinario_solicita_un_examen(db, escenario):
    vet, _, _, luna, h = escenario
    e = pedir(db, vet, h)
    assert e.estado == "solicitado"
    assert e.idMascota == luna.idMascota          # se toma del historial, no del cliente
    assert e.idUsuarioSolicita == vet.idUsuario
    assert e.nombre_mascota == "Luna"


def test_categoria_invalida_y_html_se_rechazan(escenario):
    _, _, _, _, h = escenario
    with pytest.raises(ValidationError):
        ExamenCreate(idHistorial=h.idHistorial, categoria="magia", tipo_examen="Hemograma")
    with pytest.raises(ValidationError):
        ExamenCreate(idHistorial=h.idHistorial, categoria="otro", tipo_examen="<script>alert(1)</script>")


def test_no_se_puede_solicitar_para_un_historial_inexistente(db, escenario):
    vet = escenario[0]
    with pytest.raises(HTTPException) as e:
        LaboratorioService(db).crear(ExamenCreate(idHistorial=999, categoria="otro", tipo_examen="Rayos X"), vet)
    assert e.value.status_code == 404


def test_flujo_completo_y_fecha_de_resultado(db, escenario):
    vet, _, _, _, h = escenario
    e = pedir(db, vet, h)
    srv = LaboratorioService(db)
    e = srv.actualizar(e.idExamen, ExamenUpdate(estado="en_proceso"))
    assert e.estado == "en_proceso" and e.fecha_resultado is None
    e = srv.actualizar(e.idExamen, ExamenUpdate(
        estado="entregado", resultado="Sin hallazgos relevantes",
        valores=[{"parametro": "Hematocrito", "valor": "45", "unidad": "%", "referencia": "37-55"}],
    ))
    assert e.estado == "entregado" and e.fecha_resultado is not None
    assert e.valores[0]["parametro"] == "Hematocrito"


def test_no_se_entrega_sin_resultado(db, escenario):
    vet, _, _, _, h = escenario
    e = pedir(db, vet, h)
    with pytest.raises(HTTPException) as err:
        LaboratorioService(db).actualizar(e.idExamen, ExamenUpdate(estado="entregado"))
    assert err.value.status_code == 400


def test_el_estado_no_retrocede(db, escenario):
    vet, _, _, _, h = escenario
    srv = LaboratorioService(db)
    e = pedir(db, vet, h)
    srv.actualizar(e.idExamen, ExamenUpdate(estado="entregado", resultado="OK"))
    with pytest.raises(HTTPException):
        srv.actualizar(e.idExamen, ExamenUpdate(estado="solicitado"))


def test_se_puede_corregir_un_resultado_entregado(db, escenario):
    vet, _, _, _, h = escenario
    srv = LaboratorioService(db)
    e = pedir(db, vet, h)
    srv.actualizar(e.idExamen, ExamenUpdate(estado="entregado", resultado="OK"))
    e = srv.actualizar(e.idExamen, ExamenUpdate(resultado="OK, con leve anemia"))
    assert e.resultado == "OK, con leve anemia" and e.estado == "entregado"


def test_cancelar_y_no_modificar_cancelado(db, escenario):
    vet, _, _, _, h = escenario
    srv = LaboratorioService(db)
    e = pedir(db, vet, h)
    srv.cancelar(e.idExamen)
    with pytest.raises(HTTPException):
        srv.actualizar(e.idExamen, ExamenUpdate(resultado="tarde"))
    with pytest.raises(HTTPException):
        srv.cancelar(e.idExamen)


def test_no_se_cancela_un_examen_entregado(db, escenario):
    vet, _, _, _, h = escenario
    srv = LaboratorioService(db)
    e = pedir(db, vet, h)
    srv.actualizar(e.idExamen, ExamenUpdate(estado="entregado", resultado="OK"))
    with pytest.raises(HTTPException):
        srv.cancelar(e.idExamen)


def test_el_enlace_del_archivo_solo_acepta_http(escenario):
    with pytest.raises(ValidationError):
        ExamenUpdate(archivo_url="ftp://servidor/x.pdf")
    assert ExamenUpdate(archivo_url="https://lab.test/x.pdf").archivo_url == "https://lab.test/x.pdf"


# ---------- el dueño solo ve ----------

def test_el_dueno_ve_sus_examenes_y_no_los_ajenos(db, escenario):
    vet, dueno, otro, _, h = escenario
    pedir(db, vet, h)
    srv = LaboratorioService(db)
    assert len(srv.del_dueno(dueno)) == 1
    assert srv.del_dueno(otro) == []
    with pytest.raises(HTTPException) as err:
        srv.por_historial(h.idHistorial, otro)
    assert err.value.status_code == 403


def test_el_dueno_no_ve_resultados_hasta_la_entrega(db, escenario):
    vet, dueno, _, _, h = escenario
    srv = LaboratorioService(db)
    e = pedir(db, vet, h)
    srv.actualizar(e.idExamen, ExamenUpdate(estado="en_proceso", resultado="borrador parcial"))
    visto = srv.por_historial(h.idHistorial, dueno)[0]
    assert visto.estado == "en_proceso" and visto.resultado is None and visto.valores is None
    srv.actualizar(e.idExamen, ExamenUpdate(estado="entregado", resultado="Definitivo"))
    assert srv.por_historial(h.idHistorial, dueno)[0].resultado == "Definitivo"


def test_el_dueno_no_ve_examenes_cancelados(db, escenario):
    vet, dueno, _, _, h = escenario
    srv = LaboratorioService(db)
    e = pedir(db, vet, h)
    srv.cancelar(e.idExamen)
    assert srv.del_dueno(dueno) == []
    with pytest.raises(HTTPException) as err:
        srv.get_visible(e.idExamen, dueno)
    assert err.value.status_code == 404
    assert len(srv.por_historial(h.idHistorial, vet)) == 1    # el veterinario sí lo conserva


def test_el_veterinario_ve_todo_aunque_no_este_entregado(db, escenario):
    vet, _, _, _, h = escenario
    srv = LaboratorioService(db)
    e = pedir(db, vet, h)
    srv.actualizar(e.idExamen, ExamenUpdate(estado="en_proceso", resultado="parcial"))
    assert srv.por_historial(h.idHistorial, vet)[0].resultado == "parcial"


def test_endpoints_protegen_la_escritura_por_rol():
    """POST/PUT/DELETE exigen veterinario o administrador; los GET, cualquier usuario activo."""
    from api.vs1.endpoints.laboratorio import router
    por_metodo = {}
    for r in router.routes:
        deps = [getattr(d.call, "__qualname__", "") for d in r.dependant.dependencies]
        por_metodo[(tuple(r.methods)[0], r.path)] = any("verificador" in d for d in deps)
    assert por_metodo[("POST", "/")] and por_metodo[("PUT", "/{idExamen}")] and por_metodo[("DELETE", "/{idExamen}")]
    assert not por_metodo[("GET", "/mias")]
