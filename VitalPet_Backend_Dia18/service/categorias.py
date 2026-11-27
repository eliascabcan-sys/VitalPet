from fastapi import HTTPException
from sqlalchemy.orm import Session
from models.categoria import Categoria
from schemas.categoria import CategoriaCreate, CategoriaUpdate


class CategoriaService:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self):
        return self.db.query(Categoria).filter(Categoria.estado == "activo").all()

    def get_by_id(self, id: int):
        cat = self.db.query(Categoria).filter(Categoria.idCategoria == id).first()
        if not cat:
            raise HTTPException(
                status_code=404,
                detail=f"La categoria con id {id} no existe en el sistema."
            )
        if cat.estado == "inactivo":
            raise HTTPException(
                status_code=404,
                detail=f"La categoria con id {id} no se puede modificar porque fue eliminada del sistema."
            )
        return cat

    def create(self, data: CategoriaCreate):
        db_cat = Categoria(**data.model_dump())
        self.db.add(db_cat)
        self.db.commit()
        self.db.refresh(db_cat)
        return db_cat

    def update(self, id: int, data: CategoriaUpdate):
        db_cat = self.get_by_id(id)
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(db_cat, key, value)
        self.db.commit()
        self.db.refresh(db_cat)
        return db_cat

    def soft_delete(self, id: int):
        db_cat = self.get_by_id(id)
        db_cat.estado = "inactivo"
        self.db.commit()
        return True
