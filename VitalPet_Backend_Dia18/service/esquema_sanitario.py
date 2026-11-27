from datetime import date

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.esquema_sanitario import Aplicacion, calcular_esquema
from models.mascota import Mascota
from models.user import User
from models.vacuna import Vacuna


class EsquemaSanitarioService:
    def __init__(self, db: Session):
        self.db = db

    def _mascota(self, idMascota: int, usuario: User) -> Mascota:
        m = self.db.query(Mascota).filter(Mascota.idMascota == idMascota).first()
        if not m:
            raise HTTPException(status_code=404, detail=f"La mascota con id {idMascota} no existe en el sistema.")
        if usuario.rol == "dueno" and m.idUsuario != usuario.idUsuario:
            raise HTTPException(status_code=403, detail="No puedes consultar el esquema de una mascota que no te pertenece.")
        return m

    def de_mascota(self, m: Mascota, hoy: date | None = None) -> dict:
        filas = (
            self.db.query(Vacuna)
            .filter(Vacuna.idMascota == m.idMascota, Vacuna.estado == "activo")
            .order_by(Vacuna.fecha_aplicacion.asc())
            .all()
        )
        por_tipo: dict[str, list[Aplicacion]] = {"vacuna": [], "desparasitacion": [], "antipulgas": []}
        for v in filas:
            por_tipo.setdefault(v.tipo or "vacuna", []).append(
                Aplicacion(v.idVacuna, v.nombre_vacuna, v.fecha_aplicacion, v.proxima_dosis)
            )
        calculo = calcular_esquema(m.especie, m.fechaNacimiento, por_tipo, hoy)
        return {
            "idMascota": m.idMascota, "nombre_mascota": m.nombre_mascota, "especie": m.especie,
            "fechaNacimiento": m.fechaNacimiento, "edad_semanas": calculo["edad_semanas"],
            "tiene_esquema": calculo["tiene_esquema"], "nota": calculo["nota"],
            "resumen": calculo["resumen"], "items": [vars(r) for r in calculo["items"]],
        }

    def por_mascota(self, idMascota: int, usuario: User):
        return self.de_mascota(self._mascota(idMascota, usuario))

    def del_dueno(self, usuario: User):
        mascotas = (self.db.query(Mascota)
                    .filter(Mascota.idUsuario == usuario.idUsuario, Mascota.estado != "inactivo")
                    .order_by(Mascota.nombre_mascota).all())
        return [self.de_mascota(m) for m in mascotas]
