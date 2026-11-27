from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from models.product import Product
from models.categoria import Categoria
from models.subcategoria import Subcategoria
from schemas.product import ProductCreate, ProductUpdate


class ProductService:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self, idCategoria: int | None = None, idSubcategoria: int | None = None):
        q = self.db.query(Product).filter(Product.estado == "activo")
        if idCategoria is not None:
            q = q.filter(Product.idCategoria == idCategoria)
        if idSubcategoria is not None:
            q = q.filter(Product.idSubcategoria == idSubcategoria)
        return q.all()

    def get_by_id(self, id: int):
        prod = self.db.query(Product).filter(Product.idProducto == id).first()
        if not prod:
            raise HTTPException(
                status_code=404,
                detail=f"El producto con id {id} no existe en el sistema."
            )
        if prod.estado == "inactivo":
            raise HTTPException(
                status_code=404,
                detail=f"El producto con id {id} no se puede modificar porque fue eliminado del sistema."
            )
        return prod

    def _verificar_categoria(self, idCategoria: int):
        """Verifica que la categoria exista y este activa antes de guardar."""
        cat = self.db.query(Categoria).filter(Categoria.idCategoria == idCategoria).first()
        if not cat:
            raise HTTPException(
                status_code=404,
                detail=f"La categoria con id {idCategoria} no existe en el sistema."
            )
        if cat.estado == "inactivo":
            raise HTTPException(
                status_code=404,
                detail=f"La categoria con id {idCategoria} fue eliminada del sistema."
            )

    def _verificar_subcategoria(self, idSubcategoria: int | None, idCategoria: int):
        """La subcategoria debe existir, estar activa y pertenecer a la categoria del producto."""
        if idSubcategoria is None:
            return
        sub = self.db.query(Subcategoria).filter(Subcategoria.idSubcategoria == idSubcategoria).first()
        if not sub or sub.estado == "inactivo":
            raise HTTPException(status_code=404, detail=f"La subcategoria con id {idSubcategoria} no existe en el sistema.")
        if sub.idCategoria != idCategoria:
            raise HTTPException(status_code=400, detail="La subcategoria no pertenece a la categoria elegida.")

    def stock_por_tipo(self, idCategoria: int | None = None, idSubcategoria: int | None = None):
        """Cuantas unidades hay por categoria / subcategoria (solo productos activos)."""
        q = (self.db.query(
                Categoria.idCategoria, Categoria.nombre_categoria,
                Subcategoria.idSubcategoria, Subcategoria.nombre_subcategoria,
                func.count(Product.idProducto), func.coalesce(func.sum(Product.stock), 0))
             .select_from(Product)
             .join(Categoria, Categoria.idCategoria == Product.idCategoria)
             .outerjoin(Subcategoria, Subcategoria.idSubcategoria == Product.idSubcategoria)
             .filter(Product.estado == "activo"))
        if idCategoria is not None:
            q = q.filter(Product.idCategoria == idCategoria)
        if idSubcategoria is not None:
            q = q.filter(Product.idSubcategoria == idSubcategoria)
        filas = (q.group_by(Categoria.idCategoria, Categoria.nombre_categoria,
                            Subcategoria.idSubcategoria, Subcategoria.nombre_subcategoria)
                  .order_by(Categoria.nombre_categoria, Subcategoria.nombre_subcategoria).all())
        return [dict(idCategoria=f[0], nombre_categoria=f[1], idSubcategoria=f[2],
                     nombre_subcategoria=f[3], productos=int(f[4]), unidades=int(f[5])) for f in filas]

    def create(self, data: ProductCreate):
        self._verificar_categoria(data.idCategoria)
        self._verificar_subcategoria(data.idSubcategoria, data.idCategoria)
        db_prod = Product(**data.model_dump())
        self.db.add(db_prod)
        self.db.commit()
        self.db.refresh(db_prod)
        return db_prod

    def update(self, id: int, data: ProductUpdate):
        db_prod = self.get_by_id(id)
        cambios = data.model_dump(exclude_unset=True)
        if data.idCategoria:
            self._verificar_categoria(data.idCategoria)
        categoria_final = data.idCategoria or db_prod.idCategoria
        if "idSubcategoria" in cambios:
            self._verificar_subcategoria(data.idSubcategoria, categoria_final)
        elif data.idCategoria and data.idCategoria != db_prod.idCategoria and db_prod.idSubcategoria:
            # cambio de categoria sin indicar subcategoria: la anterior ya no aplica
            db_prod.idSubcategoria = None
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(db_prod, key, value)
        self.db.commit()
        self.db.refresh(db_prod)
        return db_prod

    def soft_delete(self, id: int):
        db_prod = self.get_by_id(id)
        db_prod.estado = "inactivo"
        self.db.commit()
        return True