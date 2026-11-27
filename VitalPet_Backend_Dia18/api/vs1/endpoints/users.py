from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import create_access_token, get_current_active_user, require_roles
from core.email import enviar_email_bienvenida, enviar_email_notificacion_login
from models.user import User
from schemas.user import Token, UserCreate, UserCreateAdmin, UserLogin, UserOut, UserUpdate, UserSelfUpdate
from service.users import UserService

router = APIRouter()


# ── Públicos ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def registrar_dueno(
    usuario: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Registro público. Siempre crea un dueño. Envía email de bienvenida."""
    nuevo = UserService(db).create_dueno(usuario)
    background_tasks.add_task(
        enviar_email_bienvenida,
        email  = nuevo.email,
        nombre = nuevo.nombre
    )
    return nuevo


@router.post("/login", response_model=Token)
def login(credenciales: UserLogin, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    usuario = UserService(db).login(credenciales.email, credenciales.contrasena)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos."
        )
    access_token = create_access_token(data={"sub": usuario.email})

    background_tasks.add_task(
        enviar_email_notificacion_login,
        email  = usuario.email,
        nombre = usuario.nombre
    )

    return {
        "access_token": access_token,
        "token_type":   "bearer",
        "rol":          usuario.rol,
        "idUsuario":    usuario.idUsuario,
        "nombre":       usuario.nombre,
        "apellido":     usuario.apellido,
        "email":        usuario.email,
    }


# ── Solo admin ────────────────────────────────────────────────────────────────

@router.post("/staff", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def crear_staff(
    usuario: UserCreateAdmin,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador"))
):
    """Solo el admin puede crear veterinarios y otros administradores."""
    return UserService(db).create_staff(usuario)


@router.get("/", response_model=list[UserOut])
def obtener_usuarios(
    buscar: str | None = Query(None, max_length=100),
    incluir_inactivos: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador"))
):
    return UserService(db).get_all(incluir_inactivos=incluir_inactivos, buscar=buscar)


@router.get("/duenos", response_model=list[UserOut])
def obtener_duenos(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador", "veterinario"))
):
    return UserService(db).get_by_rol("dueno")


@router.get("/veterinarios-lista", response_model=list[UserOut])
def obtener_veterinarios(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador"))
):
    return UserService(db).get_by_rol("veterinario")


@router.get("/administradores", response_model=list[UserOut])
def obtener_administradores(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador"))
):
    """
    Antes no existia forma de filtrar solo administradores: solo estaban
    /duenos y /veterinarios-lista. GET /users/ trae TODOS los roles
    mezclados. Este endpoint completa el patron.
    """
    return UserService(db).get_by_rol("administrador")




@router.get("/me", response_model=UserOut)
def mi_perfil(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.put("/me", response_model=UserOut)
def actualizar_mi_perfil(
    datos: UserSelfUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Cualquier usuario autenticado (dueño, veterinario o admin) edita sus
    propios datos: nombre, apellido, documento, telefono, email, contrasena.
    NO puede cambiar su rol ni su estado desde aqui.
    """
    return UserService(db).update_self(current_user, datos)


@router.get("/{id}", response_model=UserOut)
def obtener_usuario(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador"))
):
    usuario = UserService(db).get_by_id(id)
    if not usuario:
        raise HTTPException(status_code=404, detail=f"Usuario con id {id} no encontrado.")
    return usuario


@router.put("/{id}", response_model=UserOut)
def actualizar_usuario(
    id: int,
    usuario: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador"))
):
    return UserService(db).update(id, usuario)


@router.delete("/{id}", status_code=status.HTTP_200_OK)
def eliminar_usuario(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("administrador"))
):
    UserService(db).soft_delete(id, id_usuario_actual=current_user.idUsuario)
    return {"mensaje": f"Usuario {id} eliminado correctamente."}


@router.put("/{id}/reactivar", response_model=UserOut)
def reactivar_usuario(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador"))
):
    """
    Solo un administrador puede reactivar una cuenta inactiva (dueño o
    veterinario). No existe auto-reactivación: si un usuario intenta
    entrar con su cuenta inactiva, el login le responde 403 explicando
    que debe contactar a un administrador — este es el endpoint que
    usa ese administrador para resolverlo.
    """
    return UserService(db).reactivar(id)