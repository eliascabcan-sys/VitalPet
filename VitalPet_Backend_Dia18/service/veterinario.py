from fastapi import HTTPException
from sqlalchemy.orm import Session
from core.security import hash_password
from models.user import User
from models.veterinario import Veterinario
from schemas.veterinario import VeterinarioCreate, VeterinarioUpdate


class VeterinarioService:
    def __init__(self, db: Session):
        self.db = db

    def _enriquecer(self, vet: Veterinario):
        if vet and vet.usuario:
            vet.__dict__["nombre"]   = vet.usuario.nombre
            vet.__dict__["apellido"] = vet.usuario.apellido
            vet.__dict__["email"]    = vet.usuario.email
        return vet

    def get_all(self, incluir_inactivos: bool = False):
        query = self.db.query(Veterinario)
        if not incluir_inactivos:
            query = query.filter(Veterinario.estado == "activo")
        vets = query.order_by(Veterinario.idVeterinario.asc()).all()
        return [self._enriquecer(v) for v in vets]

    def get_by_id(self, id: int):
        vet = self.db.query(Veterinario).filter(Veterinario.idVeterinario == id).first()
        if not vet:
            raise HTTPException(status_code=404, detail=f"El veterinario con id {id} no existe en el sistema.")
        return self._enriquecer(vet)

    def get_by_idUsuario(self, idUsuario: int):
        """Para que un veterinario vea su propio perfil profesional
        (especialidad, tarjeta profesional) a partir de su cuenta de login."""
        vet = self.db.query(Veterinario).filter(Veterinario.idUsuario == idUsuario).first()
        if not vet:
            raise HTTPException(
                status_code=404,
                detail="No se encontró un registro de veterinario asociado a tu cuenta."
            )
        return self._enriquecer(vet)

    def create(self, data: VeterinarioCreate):
        """
        Solo lo llama un administrador (RQF-16). Crea el Usuario (login,
        rol='veterinario', contrasena fija definida por el admin) y el
        registro profesional en la misma transaccion.
        """
        if self.db.query(User).filter(User.email == data.email).first():
            raise HTTPException(status_code=400, detail="El correo ya esta registrado.")
        if data.documento and self.db.query(User).filter(User.documento == data.documento).first():
            raise HTTPException(status_code=400, detail="El documento ya esta registrado.")
        if self.db.query(Veterinario).filter(Veterinario.tarjetaProfesional == data.tarjetaProfesional).first():
            raise HTTPException(status_code=400, detail="Ya existe un veterinario con esa tarjeta profesional.")

        nuevo_usuario = User(
            nombre=data.nombre,
            apellido=data.apellido,
            documento=data.documento,
            telefono=data.telefono,
            email=data.email,
            contrasena=hash_password(data.contrasena),
            rol="veterinario",
            estado="activo",
        )
        self.db.add(nuevo_usuario)
        self.db.flush()  # para obtener idUsuario antes del commit

        nuevo_vet = Veterinario(
            especialidad=data.especialidad,
            tarjetaProfesional=data.tarjetaProfesional,
            idUsuario=nuevo_usuario.idUsuario,
        )
        self.db.add(nuevo_vet)
        self.db.commit()
        self.db.refresh(nuevo_vet)
        return self._enriquecer(nuevo_vet)

    def update(self, id: int, data: VeterinarioUpdate):
        vet = self.get_by_id(id)
        update_data = data.model_dump(exclude_unset=True)

        if "contrasena" in update_data and update_data["contrasena"]:
            vet.usuario.contrasena = hash_password(update_data.pop("contrasena"))

        for key, value in update_data.items():
            setattr(vet, key, value)

        self.db.commit()
        self.db.refresh(vet)
        return self._enriquecer(vet)

    def soft_delete(self, id: int):
        """
        Borrado logico. RQF-18: no se puede desactivar un veterinario que
        tenga citas futuras pendientes (evita dejar citas sin atender).
        """
        vet = self.get_by_id(id)

        from models.cita import Cita
        from datetime import datetime
        citas_futuras = self.db.query(Cita).filter(
            Cita.idVeterinario == id,
            Cita.estado != "cancelada",
            Cita.fechaHora > datetime.now(),
        ).count()
        if citas_futuras > 0:
            raise HTTPException(
                status_code=400,
                detail=f"No se puede desactivar: este veterinario tiene {citas_futuras} cita(s) futura(s) pendiente(s). "
                       f"Reasigna o cancela esas citas primero."
            )

        vet.estado = "inactivo"
        vet.usuario.estado = "inactivo"
        self.db.commit()
        return True

    def reactivar(self, id: int):
        """Solo un administrador puede reactivar un veterinario desactivado (via FastAPI)."""
        vet = self.db.query(Veterinario).filter(Veterinario.idVeterinario == id).first()
        if not vet:
            raise HTTPException(status_code=404, detail=f"El veterinario con id {id} no existe en el sistema.")
        vet.estado = "activo"
        vet.usuario.estado = "activo"
        self.db.commit()
        self.db.refresh(vet)
        return self._enriquecer(vet)