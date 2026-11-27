from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from core.security import hash_password, verify_password
from models.user import User
from models.mascota import Mascota
from schemas.user import UserCreate, UserCreateAdmin, UserUpdate, UserSelfUpdate


class UserService:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self, incluir_inactivos: bool = False, buscar: str | None = None):
        query = self.db.query(User)
        if not incluir_inactivos:
            query = query.filter(User.estado == "activo")
        if buscar:
            patron = f"%{buscar.strip()}%"
            query = query.filter(
                (User.nombre.ilike(patron))
                | (User.apellido.ilike(patron))
                | (User.email.ilike(patron))
                | (User.documento.ilike(patron))
            )
        return query.order_by(User.nombre.asc(), User.apellido.asc()).all()

    def get_by_id(self, user_id: int):
        return self.db.query(User).filter(
            User.idUsuario == user_id,
            User.estado == "activo"
        ).first()

    def get_by_email(self, email: str):
        return self.db.query(User).filter(User.email == email).first()

    def get_by_rol(self, rol: str):
        return self.db.query(User).filter(
            User.rol == rol,
            User.estado == "activo"
        ).all()

    def get_by_id_cualquier_estado(self, user_id: int):
        """A diferencia de get_by_id, esta SÍ trae usuarios inactivos
        (se necesita para poder reactivarlos)."""
        return self.db.query(User).filter(User.idUsuario == user_id).first()

    def login(self, email: str, contrasena: str):
        usuario = self.get_by_email(email)
        if not usuario:
            return None
        if not verify_password(contrasena, usuario.contrasena):
            return None
        if usuario.estado != "activo":
            # Cuenta y contraseña válidas, pero desactivada: lo decimos
            # explícito en vez de mezclarlo con "credenciales incorrectas".
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Esta cuenta está inactiva. Un administrador debe "
                    "reactivarla antes de que puedas iniciar sesión de nuevo."
                )
            )
        return usuario

    def create_dueno(self, user_in: UserCreate):
        """Registro público — siempre queda como dueno sin importar lo que mande."""
        if self.get_by_email(user_in.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo ya está registrado."
            )
        data = user_in.model_dump()
        data["contrasena"] = hash_password(data["contrasena"])
        data["rol"] = "dueno"  # Forzado siempre
        db_user = User(**data)
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def create_staff(self, user_in: UserCreateAdmin):
        """Solo el admin puede crear veterinarios y otros admins."""
        if self.get_by_email(user_in.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo ya está registrado."
            )
        data = user_in.model_dump()
        data["contrasena"] = hash_password(data["contrasena"])
        db_user = User(**data)
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def update(self, user_id: int, user_in: UserUpdate):
        db_user = self.get_by_id(user_id)
        if not db_user:
            raise HTTPException(status_code=404, detail=f"Usuario con id {user_id} no encontrado.")
        update_data = user_in.model_dump(exclude_unset=True)
        if "contrasena" in update_data and update_data["contrasena"]:
            update_data["contrasena"] = hash_password(update_data["contrasena"])
        if "email" in update_data:
            existing = self.get_by_email(update_data["email"])
            if existing and existing.idUsuario != user_id:
                raise HTTPException(status_code=400, detail="El correo ya está registrado.")
        for key, value in update_data.items():
            setattr(db_user, key, value)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def update_self(self, current_user: User, user_in: UserSelfUpdate):
        """El propio usuario edita sus datos. Nunca puede tocar rol ni estado."""
        update_data = user_in.model_dump(exclude_unset=True)
        if "contrasena" in update_data and update_data["contrasena"]:
            update_data["contrasena"] = hash_password(update_data["contrasena"])
        if "email" in update_data and update_data["email"]:
            existing = self.get_by_email(update_data["email"])
            if existing and existing.idUsuario != current_user.idUsuario:
                raise HTTPException(status_code=400, detail="El correo ya está registrado.")
        for key, value in update_data.items():
            setattr(current_user, key, value)
        self.db.commit()
        self.db.refresh(current_user)
        return current_user

    def soft_delete(self, user_id: int, id_usuario_actual: int | None = None):
        db_user = self.get_by_id(user_id)
        if not db_user:
            raise HTTPException(status_code=404, detail=f"Usuario con id {user_id} no encontrado.")
        if id_usuario_actual == user_id:
            raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta desde este panel.")
        mascotas_activas = self.db.query(Mascota).filter(
            Mascota.idUsuario == user_id,
            Mascota.estado == "activo",
        ).count()
        if mascotas_activas:
            raise HTTPException(
                status_code=400,
                detail=f"No se puede desactivar el usuario porque tiene {mascotas_activas} mascota(s) activa(s)."
            )
        db_user.estado = "inactivo"
        self.db.commit()
        return True

    def reactivar(self, user_id: int):
        """Solo un administrador puede reactivar una cuenta (dueño o
        veterinario) que fue desactivada. Si es veterinario, también
        reactiva su registro profesional en la tabla veterinarios."""
        db_user = self.get_by_id_cualquier_estado(user_id)
        if not db_user:
            raise HTTPException(status_code=404, detail=f"Usuario con id {user_id} no encontrado.")
        if db_user.estado == "activo":
            raise HTTPException(status_code=400, detail="Este usuario ya está activo.")

        db_user.estado = "activo"

        if db_user.rol == "veterinario" and db_user.veterinario:
            db_user.veterinario.estado = "activo"

        self.db.commit()
        self.db.refresh(db_user)
        return db_user