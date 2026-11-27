from datetime import date
from typing import Literal
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_active_user, require_roles
from models.user import User
from schemas.cita import (
    AgendaOut, AsignarVeterinario, CitaAgendaOut, CitaCreate, CitaListaOut, CitaOut, CitaPendienteOut,
    CitaUpdate, FranjaDisponibilidad, FranjaOut,
)
from service.citas import CitaService
from schemas.pendientes_cita import PreparacionCitaOut
from service.pendientes_cita import preparacion_de_citas_del_dueno

router = APIRouter()


@router.get("/", response_model=list[CitaListaOut])
def obtener_citas(db: Session = Depends(get_db), _: User = Depends(require_roles("administrador", "veterinario"))):
    return CitaService(db).get_all()


@router.get("/pendientes", response_model=list[CitaListaOut])
def citas_pendientes(db: Session = Depends(get_db), _: User = Depends(require_roles("administrador", "veterinario"))):
    return CitaService(db).get_pendientes()


@router.get("/mias", response_model=list[CitaOut])
def mis_citas(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return CitaService(db).get_by_usuario(current_user.idUsuario)


@router.get("/mias/pendientes", response_model=list[CitaPendienteOut])
def mis_citas_pendientes(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Citas pendientes del dueño, cada una con un mensaje listo para mostrar."""
    return CitaService(db).pendientes_del_dueno(current_user.idUsuario)

@router.get("/mias/preparacion", response_model=list[PreparacionCitaOut])
def mis_citas_preparacion(db: Session = Depends(get_db), current_user: User = Depends(require_roles("dueno"))):
    """Por cada cita próxima del dueño: qué le falta a la mascota (vacunas, exámenes)."""
    return preparacion_de_citas_del_dueno(db, current_user)

@router.get("/agenda", response_model=AgendaOut)
def agenda_del_veterinario(
    fecha: date | None = Query(None, description="Día de referencia (AAAA-MM-DD); por defecto hoy. En vista semana se usa su semana lunes-domingo; en vista mes, el mes completo."),
    vista: Literal["dia", "semana", "mes"] = Query("dia"),
    idVeterinario: int | None = Query(None, description="Solo administrador: de qué veterinario ver la agenda"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("administrador", "veterinario"))
):
    """Disponibilidad (cupos por franja) y citas del veterinario, por día o por semana."""
    servicio = CitaService(db)
    vet = servicio.veterinario_de_usuario(current_user, idVeterinario)
    return servicio.agenda_veterinario(vet.idVeterinario, fecha or date.today(), vista)


@router.get("/sin-asignar", response_model=list[CitaAgendaOut])
def citas_sin_asignar(db: Session = Depends(get_db), _: User = Depends(require_roles("administrador", "veterinario"))):
    """Citas pendientes que todavía no tienen veterinario."""
    return CitaService(db).get_sin_asignar()


@router.get("/veterinario/{id}", response_model=list[CitaOut])
def citas_ocupadas_por_veterinario(
    id: int,
    fecha: date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user)
):
    return CitaService(db).get_ocupadas_por_veterinario(id, fecha)


@router.get("/mascota/{mascota_id}", response_model=list[CitaOut])
def citas_por_mascota(
    mascota_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    mascota = CitaService(db)._verificar_mascota(mascota_id)
    if current_user.rol == "dueno" and mascota.idUsuario != current_user.idUsuario:
        raise HTTPException(status_code=403, detail="No puedes consultar citas de una mascota que no te pertenece.")
    return CitaService(db).get_by_mascota(mascota_id)


@router.get("/franjas", response_model=list[FranjaOut])
def listar_franjas(db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    """Franjas del día en las que se puede pedir cita (mañana, tarde...)."""
    return CitaService(db).get_franjas()


@router.get("/franjas/disponibilidad", response_model=list[FranjaDisponibilidad])
def disponibilidad_de_franjas(
    fecha: date = Query(..., description="Día que se quiere consultar (AAAA-MM-DD)"),
    idVeterinario: int | None = Query(None, description="Opcional: ver los cupos de un veterinario"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user)
):
    """Para cada franja, cuántos cupos quedan ese día y si todavía se puede agendar."""
    return CitaService(db).disponibilidad_franjas(fecha, idVeterinario)


@router.get("/{id}", response_model=CitaOut)
def obtener_cita(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    cita = CitaService(db).get_by_id(id)
    if current_user.rol == "dueno" and cita.idUsuario != current_user.idUsuario:
        raise HTTPException(status_code=403, detail="No puedes consultar una cita que no te pertenece.")
    return cita


@router.post("/", response_model=CitaOut, status_code=status.HTTP_201_CREATED)
def crear_cita(
    data: CitaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.rol == "dueno":
        data = data.model_copy(update={"idUsuario": current_user.idUsuario})
    return CitaService(db).create(data, rol_usuario_actual=current_user.rol)


@router.put("/{id}", response_model=CitaOut)
def actualizar_cita(
    id: int,
    data: CitaUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador", "veterinario"))
):
    return CitaService(db).update(id, data)


@router.put("/{id}/asignar", response_model=CitaOut)
def asignar_cita(
    id: int,
    data: AsignarVeterinario,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("administrador", "veterinario"))
):
    """Asigna la cita a un veterinario (el veterinario solo puede asignársela a sí mismo)."""
    return CitaService(db).asignar_veterinario(id, data.idVeterinario, current_user, data.confirmar)


@router.delete("/{id}", status_code=status.HTTP_200_OK)
def cancelar_cita(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    cita = CitaService(db).get_by_id(id)
    if current_user.rol == "dueno" and cita.idUsuario != current_user.idUsuario:
        raise HTTPException(status_code=403, detail="No puedes cancelar una cita que no te pertenece.")
    CitaService(db).cancelar(id)
    return {"mensaje": f"Cita {id} cancelada correctamente."}


@router.post("/recordatorios/enviar")
def enviar_recordatorios(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador")),
    dias_antes: int = Query(1, ge=0, le=30)
):
    return CitaService(db).enviar_recordatorios_pendientes(dias_antes)