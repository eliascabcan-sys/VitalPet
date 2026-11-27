"""
Día 12 · P5: pruebas de roles y permisos.

1) Matriz de roles: quién puede (y quién no) llamar a cada endpoint sensible.
   Sin token -> 401. Rol no permitido -> 403. Rol permitido -> cualquier otra
   respuesta (404/422 son normales: la ruta usa ids inventados).
2) Aislamiento entre dueños: un dueño NO puede leer lo de otro dueño.
3) Barrido: toda ruta de la API, salvo las públicas, rechaza a quien no trae token.
"""
import re
from datetime import date, datetime

import pytest

from models.categoria import Categoria
from models.certificado import Certificado
from models.cita import Cita
from models.formula import FormulaMedica, FormulaMedicamento
from models.historial import HistorialClinico
from models.laboratorio import ExamenLaboratorio
from models.mascota import Mascota
from models.plantilla_seguimiento import PlantillaSeguimiento
from models.seguimiento import Seguimiento
from models.vacuna import Vacuna
from models.venta import Venta

DUENO, VET, ADMIN = "dueno", "veterinario", "administrador"
TODOS = (DUENO, VET, ADMIN)
PERSONAL = (VET, ADMIN)

# (método, ruta, roles permitidos)
MATRIZ = [
    # Fórmulas y stock (Día 12)
    ("GET", "/formulas/stock", PERSONAL),
    ("GET", "/formulas/1/stock", PERSONAL),
    ("POST", "/formulas/", PERSONAL),
    ("PUT", "/formulas/1", PERSONAL),
    ("DELETE", "/formulas/1", PERSONAL),
    ("GET", "/formulas/historial/1", TODOS),
    # Contacto directo (Día 12)
    ("GET", "/contacto-directo/pendientes", PERSONAL),
    ("PUT", "/contacto-directo/1", PERSONAL),
    # Autorizaciones de adultos mayores
    ("GET", "/autorizaciones/mias", (DUENO,)),
    ("GET", "/autorizaciones/acudientes", (DUENO,)),
    ("POST", "/autorizaciones/acudientes", (DUENO,)),
    ("PUT", "/autorizaciones/acudientes/1", (DUENO,)),
    ("DELETE", "/autorizaciones/acudientes/1", (DUENO,)),
    ("POST", "/autorizaciones/consentimiento", (DUENO,)),
    ("DELETE", "/autorizaciones/consentimiento", (DUENO,)),
    ("GET", "/autorizaciones/dueno/1", PERSONAL),
    # Seguimiento y alertas
    ("GET", "/seguimientos/alertas/pendientes", PERSONAL),
    ("PUT", "/seguimientos/alertas/1/vista", PERSONAL),
    ("POST", "/seguimientos/", PERSONAL),
    ("GET", "/seguimientos/plantillas", PERSONAL),
    ("POST", "/seguimientos/plantillas", PERSONAL),
    ("GET", "/seguimientos/mias/pendientes", TODOS),
    ("POST", "/automatizacion/ejecutar", PERSONAL),
    # Historial, laboratorio, certificados, vacunas
    ("GET", "/historial/", PERSONAL),
    ("POST", "/historial/", PERSONAL),
    ("PUT", "/historial/1", PERSONAL),
    ("DELETE", "/historial/1", (ADMIN,)),
    ("GET", "/laboratorio/", PERSONAL),
    ("POST", "/laboratorio/", PERSONAL),
    ("PUT", "/laboratorio/1", PERSONAL),
    ("DELETE", "/laboratorio/1", PERSONAL),
    ("POST", "/certificados/", PERSONAL),
    ("PUT", "/certificados/1/anular", PERSONAL),
    ("POST", "/vacunas/", PERSONAL),
    ("PUT", "/vacunas/1", PERSONAL),
    ("DELETE", "/vacunas/1", (ADMIN,)),
    ("GET", "/ficha/mascota/1", PERSONAL),
    # Citas
    ("GET", "/citas/", PERSONAL),
    ("GET", "/citas/agenda", PERSONAL),
    ("GET", "/citas/sin-asignar", PERSONAL),
    ("PUT", "/citas/1/asignar", PERSONAL),
    ("POST", "/citas/recordatorios/enviar", (ADMIN,)),
    # Inventario y ventas
    ("POST", "/products/", (ADMIN,)),
    ("PUT", "/products/1", (ADMIN,)),
    ("DELETE", "/products/1", (ADMIN,)),
    ("POST", "/subcategorias/", (ADMIN,)),
    ("PUT", "/subcategorias/1", (ADMIN,)),
    ("DELETE", "/subcategorias/1", (ADMIN,)),
    ("POST", "/categorias/", (ADMIN,)),
    ("GET", "/ventas/", (ADMIN,)),
    ("PUT", "/ventas/1", (ADMIN,)),
    ("DELETE", "/ventas/1", (ADMIN,)),
    # Usuarios y veterinarios
    ("GET", "/users/", (ADMIN,)),
    ("GET", "/users/duenos", PERSONAL),
    ("POST", "/users/staff", (ADMIN,)),
    ("DELETE", "/users/1", (ADMIN,)),
    ("GET", "/veterinarios/", (ADMIN,)),
    ("POST", "/veterinarios/", (ADMIN,)),
    ("DELETE", "/mascotas/1", PERSONAL),
]


@pytest.mark.parametrize("metodo,ruta,permitidos", MATRIZ, ids=[f"{m} {r}" for m, r, _ in MATRIZ])
def test_matriz_de_roles(api, metodo, ruta, permitidos):
    kw = {"json": {}} if metodo in ("POST", "PUT") else {}
    assert api.request(metodo, ruta, **kw).status_code == 401, "sin token debe responder 401"
    for rol in TODOS:
        # El administrador va al final de TODOS: sus DELETE (p. ej. /users/1) no afectan a los otros roles.
        codigo = api.request(metodo, ruta, rol=rol, **kw).status_code
        if rol in permitidos:
            assert codigo not in (401, 403), f"{rol} debería poder {metodo} {ruta} y recibió {codigo}"
        else:
            assert codigo == 403, f"{rol} NO debería poder {metodo} {ruta} y recibió {codigo}"


def test_un_usuario_inactivo_pierde_el_acceso(db, api):
    api.usuarios[VET].estado = "inactivo"
    db.commit()
    assert api.get("/contacto-directo/pendientes", rol=VET).status_code == 400
    assert api.get("/formulas/stock", rol=VET).status_code == 400


def test_token_basura_o_de_usuario_inexistente_da_401(api):
    assert api.get("/formulas/stock", headers={"Authorization": "Bearer basura"}).status_code == 401
    from core.security import create_access_token
    token = create_access_token({"sub": "fantasma@test.com"})
    assert api.get("/formulas/stock", headers={"Authorization": f"Bearer {token}"}).status_code == 401


# ---------- aislamiento entre dueños ----------

@pytest.fixture
def datos(db, api):
    """Todo lo que pertenece al dueño 'dueno'. El dueño 'dueno2' no tiene nada."""
    a, vet = api.usuarios["dueno"], api.usuarios[VET]
    m = Mascota(nombre_mascota="Luna", especie="Canino", idUsuario=a.idUsuario)
    db.add(m); db.flush()
    h = HistorialClinico(idMascota=m.idMascota, idUsuario=vet.idUsuario)
    db.add(h); db.flush()
    f = FormulaMedica(idHistorial=h.idHistorial, estado="activa")
    pl = PlantillaSeguimiento(nombre="Plantilla", tipo_animal="Canino", diagnostico="Vómito")
    db.add_all([f, pl]); db.flush()
    db.add(FormulaMedicamento(idFormula=f.idFormula, nombre_medicamento="Amoxicilina", dosis="1",
                              frecuencia="c/8h", duracion_dias=5))
    seg = Seguimiento(idHistorial=h.idHistorial, idPlantilla=pl.idPlantilla)
    ex = ExamenLaboratorio(idHistorial=h.idHistorial, idMascota=m.idMascota, idUsuarioSolicita=vet.idUsuario,
                           categoria="hematologia", tipo_examen="Hemograma")
    vac = Vacuna(nombre_vacuna="Rabia", fecha_aplicacion=date.today(), idMascota=m.idMascota)
    ven = Venta(idUsuario=a.idUsuario, total=1000, idHistorial=h.idHistorial)
    cita = Cita(fechaHora=datetime(2030, 1, 1, 9, 0), idUsuario=a.idUsuario, idMascota=m.idMascota)
    cert = Certificado(codigo="CERT-TEST-1", tipo="salud", idMascota=m.idMascota, idHistorial=h.idHistorial,
                       idUsuario=vet.idUsuario, contenido="Sano", codigo_verificacion="ABCD1234EFGH5678")
    db.add_all([seg, ex, vac, ven, cita, cert]); db.commit()
    return dict(m=m.idMascota, h=h.idHistorial, f=f.idFormula, seg=seg.idSeguimiento, ex=ex.idExamen,
                vac=vac.idVacuna, ven=ven.idVenta, cita=cita.idCita, cert=cert.idCertificado)


def _rutas_ajenas(d):
    return [
        f"/mascotas/{d['m']}", f"/historial/{d['h']}", f"/historial/mascota/{d['m']}",
        f"/historial/mascota/{d['m']}/pesos", f"/formulas/historial/{d['h']}",
        f"/laboratorio/{d['ex']}", f"/laboratorio/historial/{d['h']}", f"/laboratorio/mascota/{d['m']}",
        f"/vacunas/{d['vac']}", f"/vacunas/mascota/{d['m']}", f"/esquema-sanitario/mascota/{d['m']}",
        f"/ventas/{d['ven']}", f"/citas/{d['cita']}", f"/citas/mascota/{d['m']}",
        f"/certificados/{d['cert']}", f"/certificados/{d['cert']}/pdf", f"/certificados/mascota/{d['m']}",
        f"/seguimientos/{d['seg']}", f"/seguimientos/mascota/{d['m']}",
    ]


def test_un_dueno_no_puede_leer_lo_de_otro_dueno(api, datos):
    fallas = []
    for ruta in _rutas_ajenas(datos):
        r = api.get(ruta, rol="dueno2")
        if r.status_code not in (403, 404):
            fallas.append(f"GET {ruta} -> {r.status_code}")
    assert not fallas, "El dueño 2 pudo leer datos del dueño 1:\n  " + "\n  ".join(fallas)


def test_el_dueno_si_ve_lo_suyo(api, datos):
    for ruta in (f"/mascotas/{datos['m']}", f"/historial/{datos['h']}", f"/formulas/historial/{datos['h']}",
                 f"/citas/{datos['cita']}", f"/vacunas/mascota/{datos['m']}"):
        assert api.get(ruta, rol="dueno").status_code == 200, ruta


def test_el_personal_clinico_ve_los_datos_de_cualquier_dueno(api, datos):
    for rol in PERSONAL:
        assert api.get(f"/historial/{datos['h']}", rol=rol).status_code == 200
        assert api.get(f"/mascotas/{datos['m']}", rol=rol).status_code == 200


def test_un_dueno_no_modifica_ni_borra_lo_de_otro(api, datos):
    assert api.put(f"/mascotas/{datos['m']}", rol="dueno2", json={"nombre_mascota": "Hackeada"}).status_code in (403, 404)
    assert api.delete(f"/citas/{datos['cita']}", rol="dueno2").status_code in (403, 404)
    assert api.get(f"/mascotas/{datos['m']}", rol="dueno").json()["nombre_mascota"] == "Luna"


# ---------- barrido de toda la API ----------

PUBLICAS = {
    ("GET", "/categorias/"), ("GET", "/categorias/{id}"),
    ("GET", "/products/"), ("GET", "/products/{id}"),
    ("GET", "/subcategorias/"), ("GET", "/subcategorias/{id}"),
    ("POST", "/users/login"), ("POST", "/users/register"),
    ("POST", "/auth/recuperar-contrasena"), ("POST", "/auth/restablecer-contrasena"),
    ("GET", "/auth/google/login"), ("GET", "/auth/google/callback"),
    ("GET", "/certificados/verificar/{codigo}"),   # verificación pública de certificados
    ("GET", "/mascotas/foto/{nombre}"),            # foto servida a <img>, que no puede mandar token
}


def test_toda_ruta_no_publica_exige_token(api):
    # Se arma el listado desde la propia API para que rutas nuevas queden cubiertas sin tocar esta prueba.
    from fastapi import FastAPI
    from api.vs1.api import api_router
    app = FastAPI(); app.include_router(api_router, prefix="/api/vs1")
    rutas = app.openapi()["paths"]

    sin_proteger = []
    for ruta, ops in rutas.items():
        corta = ruta.replace("/api/vs1", "")
        for metodo in ops:
            if metodo.upper() not in ("GET", "POST", "PUT", "DELETE", "PATCH"):
                continue
            if (metodo.upper(), corta) in PUBLICAS:
                continue
            url = re.sub(r"\{[^}]+\}", "1", corta)
            kw = {"json": {}} if metodo in ("post", "put", "patch") else {}
            codigo = api.request(metodo.upper(), url, **kw).status_code
            if codigo != 401:
                sin_proteger.append(f"{metodo.upper()} {corta} -> {codigo}")
    assert not sin_proteger, "Rutas que NO piden token (¿falta Depends?):\n  " + "\n  ".join(sin_proteger)
