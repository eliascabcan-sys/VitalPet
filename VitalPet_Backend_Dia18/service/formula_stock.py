"""
Día 12 · P1: consulta de stock desde la fórmula.

- buscar(): mientras el veterinario escribe la fórmula, devuelve los productos
  que coinciden con lo que teclea, con sus unidades y el total del mismo tipo.
- de_formula(): para una fórmula ya guardada, dice por cada medicamento si hay
  existencias suficientes en el inventario.
Solo lee: no descuenta stock (eso lo hace la venta).
"""
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.categoria import Categoria
from models.formula import FormulaMedica
from models.product import Product
from models.subcategoria import Subcategoria

# Por debajo (o igual) a este número de unidades se avisa "stock bajo".
UMBRAL_STOCK_BAJO = 5


def estado_de_stock(unidades: int) -> str:
    if unidades <= 0:
        return "agotado"
    if unidades <= UMBRAL_STOCK_BAJO:
        return "bajo"
    return "disponible"


class FormulaStockService:
    def __init__(self, db: Session):
        self.db = db

    # ---------- piezas ----------
    def _unidades_del_tipo(self, p: Product) -> tuple[int, int]:
        q = self.db.query(func.count(Product.idProducto), func.coalesce(func.sum(Product.stock), 0)).filter(
            Product.estado == "activo", Product.idCategoria == p.idCategoria,
        )
        if p.idSubcategoria is None:
            q = q.filter(Product.idSubcategoria.is_(None))
        else:
            q = q.filter(Product.idSubcategoria == p.idSubcategoria)
        productos, unidades = q.one()
        return int(productos), int(unidades)

    def _producto_out(self, p: Product) -> dict:
        cat = self.db.query(Categoria).filter(Categoria.idCategoria == p.idCategoria).first()
        sub = (self.db.query(Subcategoria).filter(Subcategoria.idSubcategoria == p.idSubcategoria).first()
               if p.idSubcategoria else None)
        productos, unidades = self._unidades_del_tipo(p)
        stock = int(p.stock or 0)
        return dict(
            idProducto=p.idProducto, nombre_producto=p.nombre_producto, stock=stock,
            estado_stock=estado_de_stock(stock), requierePrescripcion=bool(p.requierePrescripcion),
            idCategoria=p.idCategoria, nombre_categoria=cat.nombre_categoria if cat else None,
            idSubcategoria=p.idSubcategoria, nombre_subcategoria=sub.nombre_subcategoria if sub else None,
            productos_del_tipo=productos, unidades_del_tipo=unidades,
        )

    def _ids_categorias_medicamentos(self) -> list[int]:
        filas = self.db.query(Categoria.idCategoria).filter(
            Categoria.estado == "activo", Categoria.nombre_categoria.ilike("%medicament%"),
        ).all()
        return [f[0] for f in filas]

    # ---------- buscador mientras se formula ----------
    def buscar(self, q: str | None = None, idSubcategoria: int | None = None,
               solo_medicamentos: bool = True, limite: int = 15) -> list[dict]:
        consulta = self.db.query(Product).filter(Product.estado == "activo")
        if solo_medicamentos:
            ids = self._ids_categorias_medicamentos()
            if ids:                         # si la clínica no tiene categoría "Medicamentos", se busca en todo
                consulta = consulta.filter(Product.idCategoria.in_(ids))
        if idSubcategoria is not None:
            consulta = consulta.filter(Product.idSubcategoria == idSubcategoria)
        texto = (q or "").strip()
        if texto:
            consulta = consulta.filter(Product.nombre_producto.ilike(f"%{texto}%"))
        productos = consulta.order_by(Product.nombre_producto).limit(max(1, min(limite, 50))).all()
        return [self._producto_out(p) for p in productos]

    # ---------- stock de una fórmula guardada ----------
    def _producto_de(self, med) -> Product | None:
        if med.idProducto:
            p = self.db.query(Product).filter(Product.idProducto == med.idProducto, Product.estado == "activo").first()
            if p:
                return p
        nombre = (med.nombre_medicamento or "").strip()
        if not nombre:
            return None
        exacto = self.db.query(Product).filter(
            Product.estado == "activo", func.lower(Product.nombre_producto) == nombre.lower(),
        ).first()
        if exacto:
            return exacto
        return self.db.query(Product).filter(
            Product.estado == "activo", Product.nombre_producto.ilike(f"%{nombre}%"),
        ).order_by(Product.stock.desc()).first()

    def de_formula(self, idFormula: int) -> dict:
        formula = self.db.query(FormulaMedica).filter(FormulaMedica.idFormula == idFormula).first()
        if not formula:
            raise HTTPException(status_code=404, detail=f"La fórmula con id {idFormula} no existe en el sistema.")

        filas = []
        for m in formula.medicamentos:
            producto = self._producto_de(m)
            requerida = m.cantidad
            if not producto:
                estado, faltan, salida = "sin_inventario", 0, None
            else:
                salida = self._producto_out(producto)
                stock = salida["stock"]
                if stock <= 0:
                    estado, faltan = "agotado", requerida or 0
                elif requerida and stock < requerida:
                    estado, faltan = "insuficiente", requerida - stock
                else:
                    estado, faltan = "disponible", 0
            filas.append(dict(
                idFormulaMedicamento=m.idFormulaMedicamento, nombre_medicamento=m.nombre_medicamento,
                cantidad_requerida=requerida, en_inventario=producto is not None,
                estado=estado, faltan=faltan, producto=salida,
            ))
        return dict(idFormula=formula.idFormula,
                    hay_faltantes=any(f["estado"] in ("agotado", "insuficiente") for f in filas),
                    medicamentos=filas)