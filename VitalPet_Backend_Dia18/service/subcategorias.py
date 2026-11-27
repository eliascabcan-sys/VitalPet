from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.categoria import Categoria
from models.product import Product
from models.subcategoria import Subcategoria
from schemas.subcategoria import SubcategoriaCreate, SubcategoriaUpdate


class SubcategoriaService:
    def __init__(self, db: Session):
        self.db = db

    def _categoria_activa(self, idCategoria: int) -> Categoria:
        cat = self.db.query(Categoria).filter(Categoria.idCategoria == idCategoria).first()
        if not cat or cat.estado == "inactivo":
            raise HTTPException(status_code=404, detail=f"La categoria con id {idCategoria} no existe en el sistema.")
        return cat

    def get_all(self, idCategoria: int | None = None):
        q = self.db.query(Subcategoria).filter(Subcategoria.estado == "activo")
        if idCategoria is not None:
            q = q.filter(Subcategoria.idCategoria == idCategoria)
        return q.order_by(Subcategoria.idCategoria, Subcategoria.nombre_subcategoria).all()

    def get_by_id(self, id: int) -> Subcategoria:
        sub = self.db.query(Subcategoria).filter(Subcategoria.idSubcategoria == id).first()
        if not sub or sub.estado == "inactivo":
            raise HTTPException(status_code=404, detail=f"La subcategoria con id {id} no existe en el sistema.")
        return sub

    def _existente(self, idCategoria: int, nombre: str, excepto: int | None = None):
        q = self.db.query(Subcategoria).filter(
            Subcategoria.idCategoria == idCategoria,
            func.lower(Subcategoria.nombre_subcategoria) == nombre.lower(),
        )
        if excepto is not None:
            q = q.filter(Subcategoria.idSubcategoria != excepto)
        return q.first()

    def create(self, data: SubcategoriaCreate) -> Subcategoria:
        self._categoria_activa(data.idCategoria)
        previa = self._existente(data.idCategoria, data.nombre_subcategoria)
        if previa:
            if previa.estado == "activo":
                raise HTTPException(status_code=400, detail="Ya existe una subcategoria con ese nombre en esta categoria.")
            previa.estado = "activo"          # la unicidad en BD incluye las inactivas: se reactiva
            self.db.commit()
            self.db.refresh(previa)
            return previa
        sub = Subcategoria(idCategoria=data.idCategoria, nombre_subcategoria=data.nombre_subcategoria)
        self.db.add(sub)
        self.db.commit()
        self.db.refresh(sub)
        return sub

    def update(self, id: int, data: SubcategoriaUpdate) -> Subcategoria:
        sub = self.get_by_id(id)
        if data.nombre_subcategoria:
            if self._existente(sub.idCategoria, data.nombre_subcategoria, excepto=id):
                raise HTTPException(status_code=400, detail="Ya existe una subcategoria con ese nombre en esta categoria.")
            sub.nombre_subcategoria = data.nombre_subcategoria
        self.db.commit()
        self.db.refresh(sub)
        return sub

    def soft_delete(self, id: int) -> bool:
        sub = self.get_by_id(id)
        en_uso = (self.db.query(Product.idProducto)
                  .filter(Product.idSubcategoria == id, Product.estado == "activo").count())
        if en_uso:
            raise HTTPException(
                status_code=400,
                detail=f"No se puede eliminar: {en_uso} producto(s) activo(s) usan esta subcategoria. Muévelos primero.",
            )
        sub.estado = "inactivo"
        self.db.commit()
        return True