from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from models.vacuna import Vacuna
from models.mascota import Mascota
from schemas.vacuna import VacunaCreate, VacunaUpdate


class VacunaService:

    def __init__(self, db: Session):
        self.db = db

    def _enriquecer(self, v: Vacuna):
        if v and v.mascota:
            v.__dict__["nombre_mascota"] = v.mascota.nombre_mascota
        return v

    def get_all(self):
        vacunas = (
            self.db.query(Vacuna)
            .options(joinedload(Vacuna.mascota))
            .filter(Vacuna.estado == "activo")
            .order_by(Vacuna.fecha_aplicacion.desc())
            .all()
        )
        return [self._enriquecer(v) for v in vacunas]

    def get_by_mascota(self, idMascota: int):
        mascota = (
            self.db.query(Mascota)
            .filter(Mascota.idMascota == idMascota)
            .first()
        )

        if not mascota:
            raise HTTPException(
                status_code=404,
                detail=f"La mascota con id {idMascota} no existe."
            )

        return (
            self.db.query(Vacuna)
            .filter(
                Vacuna.idMascota == idMascota,
                Vacuna.estado == "activo"
            )
            .order_by(Vacuna.fecha_aplicacion.desc())
            .all()
        )

    def get_by_id(self, id: int):
        vacuna = (
            self.db.query(Vacuna)
            .filter(Vacuna.idVacuna == id)
            .first()
        )

        if not vacuna:
            raise HTTPException(
                status_code=404,
                detail=f"La vacuna con id {id} no existe."
            )

        return vacuna

    def create(self, data: VacunaCreate):
        mascota = (
            self.db.query(Mascota)
            .filter(Mascota.idMascota == data.idMascota)
            .first()
        )

        if not mascota:
            raise HTTPException(
                status_code=404,
                detail=f"La mascota con id {data.idMascota} no existe."
            )

        if mascota.estado == "inactivo":
            raise HTTPException(
                status_code=400,
                detail="No se puede registrar una vacuna para una mascota inactiva."
            )

        db_vacuna = Vacuna(**data.model_dump())

        self.db.add(db_vacuna)
        self.db.commit()
        self.db.refresh(db_vacuna)

        return db_vacuna

    def update(self, id: int, data: VacunaUpdate):
        db_vacuna = self.get_by_id(id)

        datos = data.model_dump(exclude_unset=True)

        nueva_aplicacion = datos.get("fecha_aplicacion", db_vacuna.fecha_aplicacion)
        nueva_proxima    = datos.get("proxima_dosis", db_vacuna.proxima_dosis)
        if nueva_proxima and nueva_aplicacion and nueva_proxima <= nueva_aplicacion:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"La proxima dosis ({nueva_proxima}) debe ser una fecha "
                    f"posterior a la fecha de aplicacion ({nueva_aplicacion})."
                )
            )

        for key, value in datos.items():
            setattr(db_vacuna, key, value)

        self.db.commit()
        self.db.refresh(db_vacuna)

        return db_vacuna

    def soft_delete(self, id: int):
        db_vacuna = self.get_by_id(id)
        db_vacuna.estado = "inactivo"
        self.db.commit()
        return True

    def reactivar(self, id: int):
        db_vacuna = self.get_by_id(id)
        db_vacuna.estado = "activo"
        self.db.commit()
        self.db.refresh(db_vacuna)
        return db_vacuna