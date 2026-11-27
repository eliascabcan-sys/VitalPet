from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_current_active_user, require_roles
from models.user import User
from schemas.categoria import CategoriaCreate, CategoriaOut, CategoriaUpdate
from service.categorias import CategoriaService

router = APIRouter()

@router.get("/", response_model=list[CategoriaOut])
def obtener_categorias(db: Session = Depends(get_db)):
    """Publico: cualquiera puede ver las categorias."""
    return CategoriaService(db).get_all()

@router.get("/{id}", response_model=CategoriaOut)
def obtener_categoria(id: int, db: Session = Depends(get_db)):
    return CategoriaService(db).get_by_id(id)

@router.post("/", response_model=CategoriaOut, status_code=status.HTTP_201_CREATED)
def crear_categoria(data: CategoriaCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador"))):
    return CategoriaService(db).create(data)

@router.put("/{id}", response_model=CategoriaOut)
def actualizar_categoria(id: int, data: CategoriaUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador"))):
    return CategoriaService(db).update(id, data)

@router.delete("/{id}", status_code=status.HTTP_200_OK)
def eliminar_categoria(id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador"))):
    CategoriaService(db).soft_delete(id)
    return {"mensaje": f"Categoria {id} eliminada correctamente."}
