from typing import Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import require_roles
from models.user import User
from schemas.subcategoria import SubcategoriaCreate, SubcategoriaOut, SubcategoriaUpdate
from service.subcategorias import SubcategoriaService

router = APIRouter()


@router.get("/", response_model=list[SubcategoriaOut])
def obtener_subcategorias(idCategoria: Optional[int] = None, db: Session = Depends(get_db)):
    """Público (como las categorías). Filtra con ?idCategoria=3."""
    return SubcategoriaService(db).get_all(idCategoria)


@router.get("/{id}", response_model=SubcategoriaOut)
def obtener_subcategoria(id: int, db: Session = Depends(get_db)):
    return SubcategoriaService(db).get_by_id(id)


@router.post("/", response_model=SubcategoriaOut, status_code=status.HTTP_201_CREATED)
def crear_subcategoria(data: SubcategoriaCreate, db: Session = Depends(get_db),
                       _: User = Depends(require_roles("administrador"))):
    return SubcategoriaService(db).create(data)


@router.put("/{id}", response_model=SubcategoriaOut)
def actualizar_subcategoria(id: int, data: SubcategoriaUpdate, db: Session = Depends(get_db),
                            _: User = Depends(require_roles("administrador"))):
    return SubcategoriaService(db).update(id, data)


@router.delete("/{id}", status_code=status.HTTP_200_OK)
def eliminar_subcategoria(id: int, db: Session = Depends(get_db),
                          _: User = Depends(require_roles("administrador"))):
    SubcategoriaService(db).soft_delete(id)
    return {"mensaje": f"Subcategoria {id} eliminada correctamente."}