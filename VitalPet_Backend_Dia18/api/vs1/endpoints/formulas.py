from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_active_user, require_roles
from models.user import User
from schemas.formula import FormulaCreate, FormulaIn, FormulaOut
from schemas.formula_stock import FormulaStockOut, ProductoStockOut
from service.formula import FormulaService
from service.formula_stock import FormulaStockService
from service.historial import HistorialService

router = APIRouter()


@router.get("/historial/{idHistorial}", response_model=list[FormulaOut])
def formulas_del_historial(idHistorial: int, db: Session = Depends(get_db),
                           current_user: User = Depends(get_current_active_user)):
    historial = HistorialService(db).get_by_id(idHistorial)
    if current_user.rol == "dueno" and (not historial.mascota or historial.mascota.idUsuario != current_user.idUsuario):
        raise HTTPException(status_code=403, detail="No puedes consultar una fórmula que no te pertenece.")
    return FormulaService(db).get_by_historial(idHistorial)


# ── Día 12 · P1: stock desde la fórmula (solo personal clínico) ─────────────
@router.get("/stock", response_model=list[ProductoStockOut])
def buscar_stock_medicamentos(
    q: Optional[str] = Query(None, max_length=100, description="Parte del nombre del medicamento"),
    idSubcategoria: Optional[int] = None,
    solo_medicamentos: bool = True,
    limite: int = Query(15, ge=1, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador", "veterinario")),
):
    """Mientras se escribe la fórmula: productos que coinciden, con sus unidades y el total del mismo tipo."""
    return FormulaStockService(db).buscar(q, idSubcategoria, solo_medicamentos, limite)


@router.get("/{idFormula}/stock", response_model=FormulaStockOut)
def stock_de_la_formula(idFormula: int, db: Session = Depends(get_db),
                        _: User = Depends(require_roles("administrador", "veterinario"))):
    """Para cada medicamento de una fórmula guardada: si hay unidades suficientes en el inventario."""
    return FormulaStockService(db).de_formula(idFormula)


@router.post("/", response_model=FormulaOut, status_code=status.HTTP_201_CREATED)
def crear_formula(data: FormulaCreate, db: Session = Depends(get_db),
                  _: User = Depends(require_roles("administrador", "veterinario"))):
    return FormulaService(db).crear(data.idHistorial, FormulaIn(**data.model_dump(exclude={"idHistorial"})))


@router.put("/{idFormula}", response_model=FormulaOut)
def actualizar_formula(idFormula: int, data: FormulaIn, db: Session = Depends(get_db),
                       _: User = Depends(require_roles("administrador", "veterinario"))):
    return FormulaService(db).actualizar(idFormula, data)


@router.delete("/{idFormula}", status_code=status.HTTP_200_OK)
def anular_formula(idFormula: int, db: Session = Depends(get_db),
                   _: User = Depends(require_roles("administrador", "veterinario"))):
    FormulaService(db).anular(idFormula)
    return {"mensaje": f"Fórmula {idFormula} anulada correctamente."}