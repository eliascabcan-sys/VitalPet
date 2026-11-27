from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from models.mascota import Mascota
from models.historial import HistorialClinico
from schemas.mascota import MascotaCreate, MascotaUpdate


class MascotaService:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self):
        mascotas = (
            self.db.query(Mascota)
            .options(joinedload(Mascota.dueno))
            .filter(Mascota.estado == "activo")
            .all()
        )
        for m in mascotas:
            d = m.dueno
            m.nombre_dueno = f"{d.nombre} {d.apellido or ''}".strip() if d else None
        return mascotas

    def get_by_id(self, mascota_id: int):
        mascota = (
            self.db.query(Mascota)
            .filter(Mascota.idMascota == mascota_id)
            .first()
        )

        if not mascota:
            raise HTTPException(
                status_code=404,
                detail=f"La mascota con id {mascota_id} no existe en el sistema."
            )

        if mascota.estado == "inactivo":
            raise HTTPException(
                status_code=404,
                detail=(
                    f"La mascota con id {mascota_id} "
                    "no se puede modificar porque fue eliminada del sistema."
                )
            )

        return mascota

    def get_by_usuario(self, usuario_id: int):
        return (
            self.db.query(Mascota)
            .filter(
                Mascota.idUsuario == usuario_id,
                Mascota.estado == "activo"
            )
            .all()
        )

    def create(
        self,
        mascota_in: MascotaCreate,
        idUsuario_responsable: int
    ):
        """
        RQF-12:
        Al registrar una mascota se crea automáticamente
        un historial clínico vacío.
        """

        try:
            # ---------------------------------------------------------
            # 1. Crear mascota
            # ---------------------------------------------------------
            datos_mascota = mascota_in.model_dump()

            db_mascota = Mascota(**datos_mascota)

            self.db.add(db_mascota)

            # Generar el ID de la mascota antes del historial
            self.db.flush()

            # ---------------------------------------------------------
            # 2. Crear historial clínico inicial
            # ---------------------------------------------------------
            historial_inicial = HistorialClinico(
                idMascota=db_mascota.idMascota,
                idUsuario=idUsuario_responsable,
                motivo_consulta=None,
                diagnostico=None,
                tratamiento=None,
                medicamentos=None,
                observaciones=(
                    "Historial creado automaticamente "
                    "al registrar la mascota."
                ),
                peso_consulta=None,
                temperatura=None,
                proxima_cita=None,
                estado="activo",
                prescripcionUsada=False
            )

            self.db.add(historial_inicial)

            # ---------------------------------------------------------
            # 3. Guardar mascota + historial en una sola transacción
            # ---------------------------------------------------------
            self.db.commit()

            # ---------------------------------------------------------
            # 4. Actualizar mascota con los datos generados por BD
            # ---------------------------------------------------------
            self.db.refresh(db_mascota)

            return db_mascota

        except IntegrityError as e:
            self.db.rollback()

            # Mostrar el error original de PostgreSQL
            error_original = getattr(e, "orig", e)

            print("=" * 80)
            print("ERROR DE INTEGRIDAD AL CREAR MASCOTA")
            print("TIPO:", type(error_original).__name__)
            print("DETALLE:", str(error_original))
            print("=" * 80)

            raise HTTPException(
                status_code=400,
                detail=f"Error de integridad en la base de datos: {error_original}"
            )

        except SQLAlchemyError as e:
            self.db.rollback()

            # Mostrar el error original
            error_original = getattr(e, "orig", e)

            print("=" * 80)
            print("ERROR DE SQLALCHEMY AL CREAR MASCOTA")
            print("TIPO:", type(error_original).__name__)
            print("DETALLE:", str(error_original))
            print("=" * 80)

            raise HTTPException(
                status_code=500,
                detail=f"Error de base de datos: {error_original}"
            )

        except Exception as e:
            self.db.rollback()

            print("=" * 80)
            print("ERROR INESPERADO AL CREAR MASCOTA")
            print("TIPO:", type(e).__name__)
            print("DETALLE:", str(e))
            print("=" * 80)

            raise HTTPException(
                status_code=500,
                detail=f"Error interno: {str(e)}"
            )

    def update(
        self,
        mascota_id: int,
        mascota_in: MascotaUpdate
    ):
        try:
            db_mascota = self.get_by_id(mascota_id)

            datos = mascota_in.model_dump(exclude_unset=True)

            for key, value in datos.items():
                setattr(db_mascota, key, value)

            self.db.commit()
            self.db.refresh(db_mascota)

            return db_mascota

        except HTTPException:
            raise

        except SQLAlchemyError as e:
            self.db.rollback()

            error_original = getattr(e, "orig", e)

            print("=" * 80)
            print("ERROR AL ACTUALIZAR MASCOTA")
            print(str(error_original))
            print("=" * 80)

            raise HTTPException(
                status_code=500,
                detail=f"Error de base de datos: {error_original}"
            )

    def soft_delete(self, mascota_id: int):
        """
        Borrado lógico.

        RQF-11:
        Al desactivar la mascota también se desactiva
        todo su historial clínico asociado.
        """

        try:
            db_mascota = self.get_by_id(mascota_id)

            db_mascota.estado = "inactivo"

            self.db.query(HistorialClinico).filter(
                HistorialClinico.idMascota == mascota_id,
                HistorialClinico.estado == "activo"
            ).update(
                {"estado": "inactivo"},
                synchronize_session=False
            )

            self.db.commit()

            return True

        except HTTPException:
            raise

        except SQLAlchemyError as e:
            self.db.rollback()

            error_original = getattr(e, "orig", e)

            print("=" * 80)
            print("ERROR AL ELIMINAR MASCOTA")
            print(str(error_original))
            print("=" * 80)

            raise HTTPException(
                status_code=500,
                detail=f"Error de base de datos: {error_original}"
            )

    def reactivar(self, mascota_id: int):
        """
        Reactiva una mascota previamente desactivada.
        """

        try:
            db_mascota = (
                self.db.query(Mascota)
                .filter(Mascota.idMascota == mascota_id)
                .first()
            )

            if not db_mascota:
                raise HTTPException(
                    status_code=404,
                    detail=f"Mascota con id {mascota_id} no encontrada."
                )

            db_mascota.estado = "activo"

            self.db.commit()
            self.db.refresh(db_mascota)

            return db_mascota

        except HTTPException:
            raise

        except SQLAlchemyError as e:
            self.db.rollback()

            error_original = getattr(e, "orig", e)

            print("=" * 80)
            print("ERROR AL REACTIVAR MASCOTA")
            print(str(error_original))
            print("=" * 80)

            raise HTTPException(
                status_code=500,
                detail=f"Error de base de datos: {error_original}"
            )