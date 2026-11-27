from datetime import date, datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.acudiente import Acudiente
from models.consentimiento import Consentimiento
from models.user import User
from schemas.autorizacion import AcudienteCreate, AcudienteUpdate, ConsentimientoCreate

# En Colombia se considera adulto mayor a partir de los 60 años (Ley 1251 de 2008).
EDAD_ADULTO_MAYOR = 60
VERSION_TEXTO = "v1"
TEXTO_CONSENTIMIENTO = (
    "Autorizo a VitalPet a contactar a mi acudiente para confirmar citas y "
    "procedimientos de mis mascotas, y a entregarle información sobre su "
    "estado de salud, cuando yo no pueda atender personalmente."
)


def calcular_edad(fecha_nacimiento: date | None, hoy: date | None = None) -> int | None:
    if not fecha_nacimiento:
        return None
    hoy = hoy or date.today()
    antes_del_cumple = (hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day)
    return hoy.year - fecha_nacimiento.year - (1 if antes_del_cumple else 0)


class AutorizacionService:
    def __init__(self, db: Session):
        self.db = db

    # ---------- acudientes ----------
    def listar_acudientes(self, idUsuario: int) -> list[Acudiente]:
        return (
            self.db.query(Acudiente)
            .filter(Acudiente.idUsuario == idUsuario, Acudiente.estado == "activo")
            .order_by(Acudiente.nombre.asc())
            .all()
        )

    def _acudiente_propio(self, idUsuario: int, idAcudiente: int) -> Acudiente:
        acudiente = self.db.query(Acudiente).filter(
            Acudiente.idAcudiente == idAcudiente,
            Acudiente.idUsuario == idUsuario,
            Acudiente.estado == "activo",
        ).first()
        if not acudiente:
            raise HTTPException(status_code=404, detail="Acudiente no encontrado.")
        return acudiente

    def crear_acudiente(self, idUsuario: int, data: AcudienteCreate) -> Acudiente:
        acudiente = Acudiente(idUsuario=idUsuario, autorizado=True, estado="activo", **data.model_dump())
        self.db.add(acudiente)
        self.db.commit()
        self.db.refresh(acudiente)
        return acudiente

    def actualizar_acudiente(self, idUsuario: int, idAcudiente: int, data: AcudienteUpdate) -> Acudiente:
        acudiente = self._acudiente_propio(idUsuario, idAcudiente)
        for campo, valor in data.model_dump(exclude_unset=True).items():
            setattr(acudiente, campo, valor)
        self.db.commit()
        self.db.refresh(acudiente)
        return acudiente

    def quitar_acudiente(self, idUsuario: int, idAcudiente: int) -> None:
        """Baja lógica. Si el consentimiento vigente dependía de este acudiente, se revoca."""
        acudiente = self._acudiente_propio(idUsuario, idAcudiente)
        acudiente.estado = "inactivo"
        vigente = self.consentimiento_vigente(idUsuario)
        if vigente and vigente.idAcudiente == idAcudiente:
            self._revocar(vigente)
        self.db.commit()

    # ---------- consentimiento ----------
    def consentimiento_vigente(self, idUsuario: int) -> Consentimiento | None:
        return self.db.query(Consentimiento).filter(
            Consentimiento.idUsuario == idUsuario,
            Consentimiento.vigente.is_(True),
        ).first()

    def _revocar(self, consentimiento: Consentimiento) -> None:
        consentimiento.vigente = False
        consentimiento.fechaRevocacion = datetime.now()

    def registrar_consentimiento(self, idUsuario: int, data: ConsentimientoCreate) -> Consentimiento:
        if not data.acepta:
            raise HTTPException(status_code=400, detail="Debes aceptar el consentimiento para continuar.")
        acudiente = self._acudiente_propio(idUsuario, data.idAcudiente)
        if not acudiente.autorizado:
            raise HTTPException(status_code=400, detail="Ese acudiente no está autorizado.")

        anterior = self.consentimiento_vigente(idUsuario)
        if anterior:
            self._revocar(anterior)
            self.db.flush()  # libera el índice único antes de insertar el nuevo

        nuevo = Consentimiento(idUsuario=idUsuario, idAcudiente=acudiente.idAcudiente,
                            version_texto=VERSION_TEXTO, vigente=True)
        self.db.add(nuevo)
        self.db.commit()
        self.db.refresh(nuevo)
        return nuevo

    def revocar_consentimiento(self, idUsuario: int) -> None:
        vigente = self.consentimiento_vigente(idUsuario)
        if not vigente:
            raise HTTPException(status_code=404, detail="No tienes un consentimiento vigente.")
        self._revocar(vigente)
        self.db.commit()

    # ---------- estado general ----------
    def estado(self, usuario: User, hoy: date | None = None) -> dict:
        edad = calcular_edad(usuario.fechaNacimiento, hoy)
        es_mayor = edad is not None and edad >= EDAD_ADULTO_MAYOR
        acudientes = [a for a in self.listar_acudientes(usuario.idUsuario) if a.autorizado]
        consentimiento = self.consentimiento_vigente(usuario.idUsuario)

        pendientes = []
        if es_mayor and not acudientes:
            pendientes.append("Registrar al menos un acudiente.")
        if es_mayor and not consentimiento:
            pendientes.append("Firmar el consentimiento.")

        return {
            "es_adulto_mayor": es_mayor,
            "edad": edad,
            "fecha_nacimiento_registrada": usuario.fechaNacimiento is not None,
            "requiere_autorizacion": es_mayor,
            "tiene_acudiente": bool(acudientes),
            "tiene_consentimiento": consentimiento is not None,
            "completa": not pendientes,
            "pendientes": pendientes,
            "acudientes": self.listar_acudientes(usuario.idUsuario),
            "consentimiento": consentimiento,
            "texto_consentimiento": TEXTO_CONSENTIMIENTO,
        }

    def exigir_para_cita(self, usuario: User) -> None:
        """Se llama al agendar una cita: un adulto mayor sin autorización completa no puede agendar."""
        estado = self.estado(usuario)
        if estado["requiere_autorizacion"] and not estado["completa"]:
            faltan = " ".join(estado["pendientes"])
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Para agendar citas falta completar las autorizaciones (menú Autorizaciones). {faltan}",
            )