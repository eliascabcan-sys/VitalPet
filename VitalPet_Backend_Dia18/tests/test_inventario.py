"""Inventario: subcategorías y unidades por tipo."""
import pytest
from fastapi import HTTPException

from models.categoria import Categoria
from models.product import Product
from schemas.product import ProductCreate, ProductUpdate
from schemas.subcategoria import SubcategoriaCreate, SubcategoriaUpdate
from service.products import ProductService
from service.subcategorias import SubcategoriaService


@pytest.fixture
def inv(db):
    med = Categoria(nombre_categoria="Medicamentos")
    ali = Categoria(nombre_categoria="Alimentos")
    db.add_all([med, ali]); db.commit()
    s = SubcategoriaService(db)
    antib = s.create(SubcategoriaCreate(idCategoria=med.idCategoria, nombre_subcategoria="Antibióticos"))
    antip = s.create(SubcategoriaCreate(idCategoria=med.idCategoria, nombre_subcategoria="Antiparasitarios"))
    conc = s.create(SubcategoriaCreate(idCategoria=ali.idCategoria, nombre_subcategoria="Concentrados"))
    return dict(med=med, ali=ali, antib=antib, antip=antip, conc=conc)


def prod(inv, nombre, stock, cat="med", sub=None, **extra):
    return ProductCreate(nombre_producto=nombre, precio=1000, stock=stock, idCategoria=inv[cat].idCategoria,
                         idSubcategoria=inv[sub].idSubcategoria if sub else None, **extra)


def test_subcategoria_no_se_repite_en_la_misma_categoria(db, inv):
    with pytest.raises(HTTPException) as e:
        SubcategoriaService(db).create(SubcategoriaCreate(idCategoria=inv["med"].idCategoria, nombre_subcategoria="antibióticos"))
    assert e.value.status_code == 400
    # el mismo nombre en OTRA categoría sí se permite
    assert SubcategoriaService(db).create(SubcategoriaCreate(idCategoria=inv["ali"].idCategoria, nombre_subcategoria="Antibióticos"))


def test_categoria_inexistente_rechaza_subcategoria(db, inv):
    with pytest.raises(HTTPException) as e:
        SubcategoriaService(db).create(SubcategoriaCreate(idCategoria=999, nombre_subcategoria="Algo"))
    assert e.value.status_code == 404


def test_producto_exige_que_la_subcategoria_sea_de_su_categoria(db, inv):
    with pytest.raises(HTTPException) as e:
        ProductService(db).create(prod(inv, "Pienso X", 5, cat="ali", sub="antib"))
    assert e.value.status_code == 400
    assert ProductService(db).create(prod(inv, "Amoxicilina", 5, sub="antib")).idSubcategoria == inv["antib"].idSubcategoria


def test_cambiar_de_categoria_limpia_la_subcategoria_anterior(db, inv):
    p = ProductService(db).create(prod(inv, "Amoxicilina", 5, sub="antib"))
    p = ProductService(db).update(p.idProducto, ProductUpdate(idCategoria=inv["ali"].idCategoria))
    assert p.idSubcategoria is None


def test_unidades_por_tipo_suman_solo_activos(db, inv):
    svc = ProductService(db)
    svc.create(prod(inv, "Amoxicilina", 10, sub="antib"))
    svc.create(prod(inv, "Cefalexina", 5, sub="antib"))
    svc.create(prod(inv, "Ivermectina", 7, sub="antip"))
    svc.create(prod(inv, "Suero", 3))                                   # sin subcategoría
    borrado = svc.create(prod(inv, "Vencido", 100, sub="antib"))
    svc.soft_delete(borrado.idProducto)
    filas = {(f["nombre_categoria"], f["nombre_subcategoria"]): f for f in svc.stock_por_tipo()}
    assert filas[("Medicamentos", "Antibióticos")]["unidades"] == 15
    assert filas[("Medicamentos", "Antibióticos")]["productos"] == 2
    assert filas[("Medicamentos", "Antiparasitarios")]["unidades"] == 7
    assert filas[("Medicamentos", None)]["unidades"] == 3
    solo = svc.stock_por_tipo(idSubcategoria=inv["antib"].idSubcategoria)
    assert len(solo) == 1 and solo[0]["unidades"] == 15


def test_filtrar_productos_por_subcategoria(db, inv):
    svc = ProductService(db)
    svc.create(prod(inv, "Amoxicilina", 10, sub="antib"))
    svc.create(prod(inv, "Ivermectina", 7, sub="antip"))
    assert [p.nombre_producto for p in svc.get_all(idSubcategoria=inv["antip"].idSubcategoria)] == ["Ivermectina"]


def test_no_se_elimina_una_subcategoria_con_productos(db, inv):
    ProductService(db).create(prod(inv, "Amoxicilina", 10, sub="antib"))
    with pytest.raises(HTTPException) as e:
        SubcategoriaService(db).soft_delete(inv["antib"].idSubcategoria)
    assert e.value.status_code == 400
    assert SubcategoriaService(db).soft_delete(inv["conc"].idSubcategoria) is True


def test_recrear_una_subcategoria_eliminada_la_reactiva(db, inv):
    s = SubcategoriaService(db)
    s.soft_delete(inv["conc"].idSubcategoria)
    nueva = s.create(SubcategoriaCreate(idCategoria=inv["ali"].idCategoria, nombre_subcategoria="Concentrados"))
    assert nueva.idSubcategoria == inv["conc"].idSubcategoria and nueva.estado == "activo"


def test_renombrar_subcategoria(db, inv):
    s = SubcategoriaService(db)
    assert s.update(inv["antib"].idSubcategoria, SubcategoriaUpdate(nombre_subcategoria="Antibióticos orales")).nombre_subcategoria == "Antibióticos orales"
    with pytest.raises(HTTPException):
        s.update(inv["antib"].idSubcategoria, SubcategoriaUpdate(nombre_subcategoria="Antiparasitarios"))