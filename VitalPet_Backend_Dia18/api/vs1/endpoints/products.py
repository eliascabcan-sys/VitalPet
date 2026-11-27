from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_current_active_user, require_roles
from models.user import User
from schemas.product import ProductCreate, ProductOut, ProductUpdate
from service.products import ProductService

router = APIRouter()

@router.get("/", response_model=list[ProductOut])
def obtener_productos(db: Session = Depends(get_db)):
    """Publico: cualquiera puede ver los productos."""
    return ProductService(db).get_all()

@router.get("/{id}", response_model=ProductOut)
def obtener_producto(id: int, db: Session = Depends(get_db)):
    return ProductService(db).get_by_id(id)

@router.post("/", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def crear_producto(data: ProductCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador"))):
    return ProductService(db).create(data)

@router.put("/{id}", response_model=ProductOut)
def actualizar_producto(id: int, data: ProductUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador"))):
    return ProductService(db).update(id, data)

@router.delete("/{id}", status_code=status.HTTP_200_OK)
def eliminar_producto(id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador"))):
    ProductService(db).soft_delete(id)
    return {"mensaje": f"Producto {id} eliminado correctamente."}
