"""Certificados: firma, tarjeta profesional, lote, código de verificación y no-edición."""
from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from models.certificado import Certificado
from models.mascota import Mascota
from models.user import User
from models.veterinario import Veterinario
from schemas.certificado import CertificadoAnular, CertificadoCreate, FirmaIn
from service.certificado import CertificadoService, calcular_huella, es_integro

FIRMA = "data:image/png;base64,iVBORw0KGgo="


@pytest.fixture
def mundo(db):
    dueno = User(nombre="Ana", apellido="Ruiz", email="ana@t.com", contrasena="x", rol="dueno")
    otro = User(nombre="Otro", apellido="Dueño", email="otro@t.com", contrasena="x", rol="dueno")
    vet_u = User(nombre="Vera", apellido="Gil", email="vera@t.com", contrasena="x", rol="veterinario")
    vet2_u = User(nombre="Ivan", apellido="Paz", email="ivan@t.com", contrasena="x", rol="veterinario")
    admin = User(nombre="Adm", apellido="In", email="adm@t.com", contrasena="x", rol="administrador")
    db.add_all([dueno, otro, vet_u, vet2_u, admin]); db.flush()
    db.add_all([Veterinario(tarjetaProfesional="TP-100", idUsuario=vet_u.idUsuario, estado="activo"),
                Veterinario(tarjetaProfesional="TP-200", idUsuario=vet2_u.idUsuario, estado="activo")])
    m = Mascota(nombre_mascota="Luna", especie="Canino", raza="Criollo", idUsuario=dueno.idUsuario)
    db.add(m); db.commit()
    return dict(dueno=dueno, otro=otro, vet=vet_u, vet2=vet2_u, admin=admin, mascota=m)


def pedir(m, **extra):
    datos = dict(idMascota=m.idMascota, tipo="salud", contenido="Paciente clínicamente sano.")
    datos.update(extra)
    return CertificadoCreate(**datos)


# ---------- validación ----------
def test_tipo_invalido_y_vigencia_pasada(mundo):
    m = mundo["mascota"]
    with pytest.raises(ValidationError):
        pedir(m, tipo="otra_cosa")
    with pytest.raises(ValidationError):
        pedir(m, vigenciaHasta=date.today() - timedelta(days=1))
    with pytest.raises(ValidationError):
        pedir(m, contenido="   ")


def test_firma_solo_imagen_png_o_jpg_y_con_tope():
    assert FirmaIn(firma=FIRMA).firma == FIRMA
    with pytest.raises(ValidationError):
        FirmaIn(firma="data:text/html;base64,PHNjcmlwdD4=")
    with pytest.raises(ValidationError):
        FirmaIn(firma="data:image/png;base64," + "A" * 300_001)


# ---------- emitir ----------
def test_emitir_congela_datos_y_genera_codigos(db, mundo):
    c = CertificadoService(db).emitir(pedir(mundo["mascota"], lote="L-77"), mundo["vet"])
    assert c.codigo.startswith("CERT-") and len(c.codigo_verificacion) == 10
    assert c.tarjeta_profesional == "TP-100"
    assert c.nombre_veterinario == "Vera Gil"
    assert c.mascota_nombre == "Luna" and c.dueno_nombre == "Ana Ruiz"
    assert c.lote == "L-77" and len(c.huella) == 64 and c.integro is True


def test_los_codigos_no_se_repiten(db, mundo):
    svc = CertificadoService(db)
    a = svc.emitir(pedir(mundo["mascota"]), mundo["vet"])
    b = svc.emitir(pedir(mundo["mascota"]), mundo["vet"])
    assert a.codigo != b.codigo and a.codigo_verificacion != b.codigo_verificacion


def test_vacunacion_exige_lote(db, mundo):
    with pytest.raises(HTTPException) as e:
        CertificadoService(db).emitir(pedir(mundo["mascota"], tipo="vacunacion"), mundo["vet"])
    assert e.value.status_code == 400 and "lote" in e.value.detail.lower()
    assert CertificadoService(db).emitir(pedir(mundo["mascota"], tipo="vacunacion", lote="A1"), mundo["vet"])


def test_sin_tarjeta_profesional_no_se_puede_emitir(db, mundo):
    with pytest.raises(HTTPException) as e:
        CertificadoService(db).emitir(pedir(mundo["mascota"]), mundo["admin"])
    assert e.value.status_code == 403


def test_la_firma_registrada_se_estampa_en_certificados_nuevos(db, mundo):
    svc = CertificadoService(db)
    assert svc.firma_de(mundo["vet"])["registrada"] is False
    sin_firma = svc.emitir(pedir(mundo["mascota"]), mundo["vet"])
    assert sin_firma.firma_veterinario is None
    svc.guardar_firma(mundo["vet"], FIRMA)
    con_firma = svc.emitir(pedir(mundo["mascota"]), mundo["vet"])
    assert con_firma.firma_veterinario == FIRMA
    db.refresh(sin_firma)
    assert sin_firma.firma_veterinario is None           # el anterior no cambia


def test_historial_de_otra_mascota_se_rechaza(db, mundo):
    with pytest.raises(HTTPException):
        CertificadoService(db).emitir(pedir(mundo["mascota"], idHistorial=999), mundo["vet"])


# ---------- no se puede modificar ni falsificar ----------
def test_cambiar_la_mascota_despues_no_altera_el_certificado(db, mundo):
    c = CertificadoService(db).emitir(pedir(mundo["mascota"]), mundo["vet"])
    mundo["mascota"].nombre_mascota = "Otra"
    db.commit()
    db.refresh(c)
    assert c.mascota_nombre == "Luna" and es_integro(c)


def test_si_alguien_altera_la_base_de_datos_se_detecta(db, mundo):
    svc = CertificadoService(db)
    c = svc.emitir(pedir(mundo["mascota"]), mundo["vet"])
    db.query(Certificado).filter_by(idCertificado=c.idCertificado).update({"contenido": "Texto falsificado"})
    db.commit()
    db.refresh(c)
    assert es_integro(c) is False
    assert svc.obtener(c.idCertificado, mundo["vet"]).integro is False


def test_la_huella_cambia_si_cambia_cualquier_dato(db, mundo):
    c = CertificadoService(db).emitir(pedir(mundo["mascota"]), mundo["vet"])
    original = calcular_huella(c)
    c.lote = "OTRO"
    assert calcular_huella(c) != original
    db.rollback()


def test_la_api_no_ofrece_editar_ni_borrar_certificados():
    from api.vs1.endpoints.certificados import router
    permitidos = {("PUT", "/firma"), ("PUT", "/{idCertificado}/anular")}
    for r in router.routes:
        for metodo in r.methods - {"GET", "POST", "HEAD", "OPTIONS"}:
            assert (metodo, r.path) in permitidos, f"Ruta que modifica certificados: {metodo} {r.path}"


# ---------- anular ----------
def test_anular_exige_motivo_y_solo_el_emisor_o_admin(db, mundo):
    svc = CertificadoService(db)
    c = svc.emitir(pedir(mundo["mascota"]), mundo["vet"])
    with pytest.raises(ValidationError):
        CertificadoAnular(motivo="x")
    with pytest.raises(HTTPException) as e:
        svc.anular(c.idCertificado, "Datos mal escritos", mundo["vet2"])
    assert e.value.status_code == 403
    anulado = svc.anular(c.idCertificado, "Datos mal escritos", mundo["vet"])
    assert anulado.estado == "anulado" and anulado.motivo_anulacion == "Datos mal escritos"
    assert anulado.integro is True                       # anular no toca el contenido firmado
    with pytest.raises(HTTPException):
        svc.anular(c.idCertificado, "Otra vez", mundo["admin"])


# ---------- quién los ve ----------
def test_el_dueno_ve_los_suyos_y_no_los_de_otros(db, mundo):
    svc = CertificadoService(db)
    c = svc.emitir(pedir(mundo["mascota"]), mundo["vet"])
    assert [x.idCertificado for x in svc.por_mascota(mundo["mascota"].idMascota, mundo["dueno"])] == [c.idCertificado]
    assert svc.obtener(c.idCertificado, mundo["dueno"]).codigo == c.codigo
    with pytest.raises(HTTPException) as e:
        svc.obtener(c.idCertificado, mundo["otro"])
    assert e.value.status_code == 403
    with pytest.raises(HTTPException):
        svc.por_mascota(mundo["mascota"].idMascota, mundo["otro"])

# =====================================================================
# Día 8: verificación pública y PDF
# =====================================================================
from datetime import date as _date

from core.limitador import LimitadorPorIP


def _emitido(db, mundo, **extra):
    return CertificadoService(db).emitir(pedir(mundo["mascota"], **extra), mundo["vet"])


def test_verificar_con_codigo_de_verificacion_con_o_sin_guion(db, mundo):
    c = _emitido(db, mundo, lote="L-1")
    cv = c.codigo_verificacion
    for variante in (cv, f"{cv[:5]}-{cv[5:]}", cv.lower(), f"  {cv} "):
        r = CertificadoService(db).verificar_publico(variante)
        assert r["valido"] is True and r["estado"] == "emitido" and r["integro"] is True
    assert CertificadoService(db).verificar_publico(c.codigo)["codigo"] == c.codigo   # también por el número CERT-


def test_verificar_codigo_inexistente_da_404(db, mundo):
    _emitido(db, mundo)
    for malo in ("ZZZZZZZZZZ", "abc", "", "CERT-2026-NOEXISTE"):
        with pytest.raises(HTTPException) as e:
            CertificadoService(db).verificar_publico(malo)
        assert e.value.status_code == 404


def test_la_verificacion_publica_no_expone_contenido_ni_dueno(db, mundo):
    c = _emitido(db, mundo, contenido="Diagnóstico confidencial")
    r = CertificadoService(db).verificar_publico(c.codigo_verificacion)
    assert "contenido" not in r and "dueno_nombre" not in r and "firma_veterinario" not in r
    assert "Diagnóstico confidencial" not in str(r) and "Ana" not in str(r)
    assert r["mascota_nombre"] == "Luna" and r["tarjeta_profesional"] == "TP-100"


def test_verificar_detecta_certificado_falsificado(db, mundo):
    c = _emitido(db, mundo)
    db.query(Certificado).filter_by(idCertificado=c.idCertificado).update({"mascota_nombre": "Rex"})
    db.commit()
    r = CertificadoService(db).verificar_publico(c.codigo_verificacion)
    assert r["valido"] is False and r["integro"] is False and "NO VÁLIDO" in r["mensaje"]


def test_verificar_certificado_anulado(db, mundo):
    svc = CertificadoService(db)
    c = _emitido(db, mundo)
    svc.anular(c.idCertificado, "Error en los datos", mundo["vet"])
    r = svc.verificar_publico(c.codigo_verificacion)
    assert r["valido"] is False and r["estado"] == "anulado" and r["integro"] is True
    assert "ANULADO" in r["mensaje"]


def test_verificar_certificado_vencido(db, mundo, monkeypatch):
    import service.certificado as modulo

    c = _emitido(db, mundo, vigenciaHasta=_date.today() + timedelta(days=5))

    class FechaFutura(_date):
        @classmethod
        def today(cls):
            return _date.today() + timedelta(days=30)

    monkeypatch.setattr(modulo, "date", FechaFutura)
    r = CertificadoService(db).verificar_publico(c.codigo_verificacion)
    assert r["valido"] is False and r["vigente"] is False and "venció" in r["mensaje"]


def test_el_endpoint_de_verificacion_es_publico_y_el_de_pdf_no():
    from api.vs1.endpoints.certificados import router

    def depende_de_sesion(ruta):
        return any("current" in str(d.call) or "require_roles" in str(d.call) or "get_current" in str(d.call)
                   for d in ruta.dependant.dependencies)

    rutas = {r.path: r for r in router.routes}
    assert not depende_de_sesion(rutas["/verificar/{codigo}"])
    assert depende_de_sesion(rutas["/{idCertificado}/pdf"])


def test_limitador_de_verificacion_corta_los_intentos_masivos():
    lim = LimitadorPorIP(maximo=3, ventana_segundos=60)
    assert [lim.permitir("1.1.1.1", ahora=t) for t in (0, 1, 2)] == [True, True, True]
    assert lim.permitir("1.1.1.1", ahora=3) is False          # el 4.º en la ventana se bloquea
    assert lim.permitir("2.2.2.2", ahora=3) is True           # otra IP no se afecta
    assert lim.permitir("1.1.1.1", ahora=70) is True          # pasada la ventana vuelve a permitir


def test_pdf_se_genera_con_firma_lote_y_qr(db, mundo):
    svc = CertificadoService(db)
    svc.guardar_firma(mundo["vet"], FIRMA)
    c = _emitido(db, mundo, tipo="vacunacion", lote="L-77", contenido="Vacuna antirrábica aplicada. Ñandú & 'comillas' 5 > 3")
    contenido, nombre = svc.pdf(c.idCertificado, mundo["vet"], "http://localhost:5173")
    assert contenido[:5] == b"%PDF-" and len(contenido) > 1500
    assert nombre == f"{c.codigo}.pdf"


def test_pdf_de_certificado_anulado_se_genera(db, mundo):
    svc = CertificadoService(db)
    c = _emitido(db, mundo)
    svc.anular(c.idCertificado, "Error en los datos", mundo["vet"])
    assert svc.pdf(c.idCertificado, mundo["vet"])[0][:5] == b"%PDF-"


def test_pdf_se_rechaza_si_el_certificado_fue_alterado(db, mundo):
    svc = CertificadoService(db)
    c = _emitido(db, mundo)
    db.query(Certificado).filter_by(idCertificado=c.idCertificado).update({"contenido": "Texto falsificado"})
    db.commit()
    with pytest.raises(HTTPException) as e:
        svc.pdf(c.idCertificado, mundo["vet"])
    assert e.value.status_code == 409


def test_pdf_el_dueno_solo_descarga_los_suyos(db, mundo):
    svc = CertificadoService(db)
    c = _emitido(db, mundo)
    assert svc.pdf(c.idCertificado, mundo["dueno"])[0][:5] == b"%PDF-"
    with pytest.raises(HTTPException) as e:
        svc.pdf(c.idCertificado, mundo["otro"])
    assert e.value.status_code == 403
