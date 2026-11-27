"""Día 12 · P1: consulta de stock desde la fórmula."""
import pytest
from fastapi import HTTPException

from models.categoria import Categoria
from models.formula import FormulaMedica, FormulaMedicamento
from models.historial import HistorialClinico
from models.mascota import Mascota
from models.product import Product
from models.subcategoria import Subcategoria
from service.formula_stock import UMBRAL_STOCK_BAJO, FormulaStockService, estado_de_stock


@pytest.fixture
def inv(db):
    med = Categoria(nombre_categoria="Medicamentos")
    ali = Categoria(nombre_categoria="Alimentos")
    db.add_all([med, ali]); db.flush()
    antib = Subcategoria(idCategoria=med.idCategoria, nombre_subcategoria="Antibióticos")
    antip = Subcategoria(idCategoria=med.idCategoria, nombre_subcategoria="Antiparasitarios")
    db.add_all([antib, antip]); db.flush()

    def producto(nombre, stock, cat, sub=None, estado="activo"):
        p = Product(nombre_producto=nombre, precio=1000, stock=stock, idCategoria=cat.idCategoria,
                    idSubcategoria=sub.idSubcategoria if sub else None, estado=estado)
        db.add(p); db.flush()
        return p

    d = dict(
        amoxi=producto("Amoxicilina 250 mg", 10, med, antib),
        cefa=producto("Cefalexina 500 mg", 5, med, antib),
        iver=producto("Ivermectina", 0, med, antip),
        suero=producto("Suero fisiológico", 3, med),
        pienso=producto("Pienso adulto", 40, ali),
        viejo=producto("Amoxicilina vencida", 99, med, antib, estado="inactivo"),
        antib=antib,
    )
    db.commit()
    return d


@pytest.fixture
def formula(db, inv):
    dueno = __import__("models.user", fromlist=["User"]).User(nombre="Ana", apellido="R", email="a@t.com", contrasena="x", rol="dueno")
    vet = __import__("models.user", fromlist=["User"]).User(nombre="Vet", apellido="U", email="v@t.com", contrasena="x", rol="veterinario")
    db.add_all([dueno, vet]); db.flush()
    m = Mascota(nombre_mascota="Luna", especie="Canino", idUsuario=dueno.idUsuario)
    db.add(m); db.flush()
    h = HistorialClinico(idMascota=m.idMascota, idUsuario=vet.idUsuario)
    db.add(h); db.flush()
    f = FormulaMedica(idHistorial=h.idHistorial, estado="activa")
    db.add(f); db.flush()

    def med(nombre, cantidad, idProducto=None):
        db.add(FormulaMedicamento(idFormula=f.idFormula, nombre_medicamento=nombre, dosis="1", frecuencia="c/8h",
                                  duracion_dias=7, cantidad=cantidad, idProducto=idProducto))

    med("Amoxicilina 250 mg", 4, inv["amoxi"].idProducto)       # enlazado, alcanza
    med("Cefalexina", 8)                                         # por nombre, no alcanza (hay 5)
    med("Ivermectina", 2)                                        # agotado
    med("Medicamento raro", 1)                                   # no existe en inventario
    db.commit()
    return f


def test_estado_de_stock():
    assert estado_de_stock(0) == "agotado" and estado_de_stock(-2) == "agotado"
    assert estado_de_stock(UMBRAL_STOCK_BAJO) == "bajo"
    assert estado_de_stock(UMBRAL_STOCK_BAJO + 1) == "disponible"


def test_buscar_por_nombre_trae_unidades_del_tipo(db, inv):
    r = FormulaStockService(db).buscar("amoxi")
    assert [p["nombre_producto"] for p in r] == ["Amoxicilina 250 mg"]   # no trae el inactivo
    p = r[0]
    assert p["stock"] == 10 and p["estado_stock"] == "disponible"
    assert p["nombre_subcategoria"] == "Antibióticos"
    assert p["unidades_del_tipo"] == 15 and p["productos_del_tipo"] == 2  # 10 + 5; el inactivo no suma


def test_buscar_solo_medicamentos_por_defecto(db, inv):
    nombres = {p["nombre_producto"] for p in FormulaStockService(db).buscar("")}
    assert "Pienso adulto" not in nombres and "Suero fisiológico" in nombres
    todo = {p["nombre_producto"] for p in FormulaStockService(db).buscar("pienso", solo_medicamentos=False)}
    assert todo == {"Pienso adulto"}


def test_buscar_filtra_por_subcategoria_y_respeta_limite(db, inv):
    r = FormulaStockService(db).buscar(None, idSubcategoria=inv["antib"].idSubcategoria)
    assert {p["nombre_producto"] for p in r} == {"Amoxicilina 250 mg", "Cefalexina 500 mg"}
    assert len(FormulaStockService(db).buscar("", limite=2)) == 2


def test_producto_sin_subcategoria_cuenta_solo_su_grupo(db, inv):
    p = FormulaStockService(db).buscar("suero")[0]
    assert p["nombre_subcategoria"] is None and p["unidades_del_tipo"] == 3 and p["productos_del_tipo"] == 1


def test_sin_categoria_medicamentos_busca_en_todo(db):
    cat = Categoria(nombre_categoria="Insumos"); db.add(cat); db.flush()
    db.add(Product(nombre_producto="Gasas", precio=1, stock=7, idCategoria=cat.idCategoria)); db.commit()
    assert [p["nombre_producto"] for p in FormulaStockService(db).buscar("gasas")] == ["Gasas"]


def test_stock_de_la_formula_por_medicamento(db, formula):
    r = FormulaStockService(db).de_formula(formula.idFormula)
    por_nombre = {m["nombre_medicamento"]: m for m in r["medicamentos"]}
    assert por_nombre["Amoxicilina 250 mg"]["estado"] == "disponible"
    assert por_nombre["Amoxicilina 250 mg"]["producto"]["unidades_del_tipo"] == 15
    cefa = por_nombre["Cefalexina"]
    assert cefa["estado"] == "insuficiente" and cefa["faltan"] == 3 and cefa["producto"]["stock"] == 5
    assert por_nombre["Ivermectina"]["estado"] == "agotado" and por_nombre["Ivermectina"]["faltan"] == 2
    raro = por_nombre["Medicamento raro"]
    assert raro["estado"] == "sin_inventario" and raro["producto"] is None and raro["en_inventario"] is False
    assert r["hay_faltantes"] is True


def test_formula_inexistente_da_404(db):
    with pytest.raises(HTTPException) as e:
        FormulaStockService(db).de_formula(999)
    assert e.value.status_code == 404


# ---------- por HTTP ----------

def test_http_veterinario_busca_stock(api, inv):
    r = api.get("/formulas/stock?q=amoxi", rol="veterinario")
    assert r.status_code == 200 and r.json()[0]["stock"] == 10


def test_http_stock_de_formula(api, formula):
    r = api.get(f"/formulas/{formula.idFormula}/stock", rol="administrador")
    assert r.status_code == 200 and r.json()["hay_faltantes"] is True
    assert api.get("/formulas/9999/stock", rol="administrador").status_code == 404


def test_http_el_dueno_no_ve_el_inventario(api, inv, formula):
    assert api.get("/formulas/stock?q=amoxi", rol="dueno").status_code == 403
    assert api.get(f"/formulas/{formula.idFormula}/stock", rol="dueno").status_code == 403
    assert api.get("/formulas/stock").status_code == 401