import os
import logging
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from dotenv import load_dotenv
from html import escape

load_dotenv()

logger = logging.getLogger("vitalpet.email")


async def _enviar_seguro(mensaje: MessageSchema):
    try:
        fm = FastMail(_mail_config())
        await fm.send_message(mensaje)
    except Exception as exc:
        logger.error(
            "No se pudo enviar el correo '%s' a %s: %s",
            mensaje.subject, mensaje.recipients, exc
        )


def _mail_config():
    username = os.getenv("MAIL_USERNAME", "").strip()
    password = os.getenv("MAIL_PASSWORD", "").strip()
    mail_from = os.getenv("MAIL_FROM", "").strip()
    if not username or not password or not mail_from:
        raise RuntimeError(
            "Correo no configurado. Completa MAIL_USERNAME, MAIL_PASSWORD y MAIL_FROM en backend/.env antes de usar funciones de correo."
        )
    return ConnectionConfig(
        MAIL_USERNAME=username,
        MAIL_PASSWORD=password,
        MAIL_FROM=mail_from,
        MAIL_PORT=int(os.getenv("MAIL_PORT", "587")),
        MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
    )


async def enviar_email_recuperacion(email: str, token: str, nombre: str):
    url = f"{_frontend()}/recuperar-contrasena?token={token}"

    mensaje = MessageSchema(
        subject="VitalPet — Recupera tu contraseña",
        recipients=[email],
        body=f"""
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e0e0e0;border-radius:12px;">
            <h2 style="color:#2D6A4F;">🐾 VitalPet</h2>
            <p>Hola <strong>{nombre}</strong>,</p>
            <p>Recibimos una solicitud para recuperar la contraseña de tu cuenta.</p>
            <p>Haz clic en el botón para continuar. El enlace expira en <strong>30 minutos</strong>.</p>
            <a href="{url}"
               style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2D6A4F;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
               Recuperar contraseña
            </a>
            <p style="margin-top:24px;font-size:12px;color:#999;">
                Si no solicitaste esto, ignora este mensaje. Tu contraseña no cambiará.
            </p>
        </div>
        """,
        subtype="html"
    )

    await _enviar_seguro(mensaje)


async def enviar_email_bienvenida(email: str, nombre: str):
    mensaje = MessageSchema(
        subject="¡Bienvenido a VitalPet! 🐾",
        recipients=[email],
        body=f"""
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e0e0e0;border-radius:12px;">
            <h2 style="color:#2D6A4F;">🐾 VitalPet</h2>
            <p>Hola <strong>{nombre}</strong>, ¡tu cuenta fue creada exitosamente!</p>
            <p>Ya puedes iniciar sesión y registrar a tus mascotas.</p>
            <a href="{_frontend()}/login"
               style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2D6A4F;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
               Ir a VitalPet
            </a>
        </div>
        """,
        subtype="html"
    )
    await _enviar_seguro(mensaje)

async def enviar_email_google_bienvenida(email: str, nombre: str):
    mensaje = MessageSchema(
        subject="Acceso con Google vinculado — VitalPet 🐾",
        recipients=[email],
        body=f"""
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e0e0e0;border-radius:12px;">
            <h2 style="color:#2D6A4F;">🐾 VitalPet</h2>
            <p>Hola <strong>{nombre}</strong>,</p>
            <p>Tu cuenta de VitalPet ha sido vinculada exitosamente con <strong>Google</strong>.</p>
            <p>A partir de ahora puedes iniciar sesión usando el botón <strong>"Continuar con Google"</strong>.</p>
            <p style="margin-top:24px;font-size:12px;color:#999;">
                Si no fuiste tú, cambia tu contraseña inmediatamente.
            </p>
        </div>
        """,
        subtype="html"
    )
    await _enviar_seguro(mensaje)


async def enviar_email_login_google(email: str, nombre: str):
    await enviar_email_notificacion_login(email, nombre, metodo="Google")


async def enviar_email_notificacion_login(email: str, nombre: str, metodo: str = "tu correo y contraseña"):
    from datetime import datetime
    hora = datetime.now().strftime("%d/%m/%Y %H:%M")
    mensaje = MessageSchema(
        subject="Nuevo acceso a tu cuenta VitalPet 🐾",
        recipients=[email],
        body=f"""
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e0e0e0;border-radius:12px;">
            <h2 style="color:#2D6A4F;">🐾 VitalPet</h2>
            <p>Hola <strong>{nombre}</strong>,</p>
            <p>Detectamos un nuevo inicio de sesión en tu cuenta usando <strong>{metodo}</strong>.</p>
            <p><strong>Fecha y hora:</strong> {hora}</p>
            <a href="{_frontend()}/login"
               style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2D6A4F;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
               Ir a VitalPet
            </a>
            <p style="margin-top:24px;font-size:12px;color:#999;">
                Si no fuiste tú, cambia tu contraseña inmediatamente o contáctanos.
            </p>
        </div>
        """,
        subtype="html"
    )
    await _enviar_seguro(mensaje)

async def enviar_email_pregunta_seguimiento(email: str, nombre_dueno: str, nombre_mascota: str, texto_pregunta: str):
    mensaje = MessageSchema(
        subject=f"VitalPet — ¿Cómo sigue {nombre_mascota}? 🐾",
        recipients=[email],
        body=f"""
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e0e0e0;border-radius:12px;">
            <h2 style="color:#2D6A4F;">🐾 VitalPet</h2>
            <p>Hola <strong>{nombre_dueno}</strong>,</p>
            <p>Queremos saber cómo sigue <strong>{nombre_mascota}</strong>:</p>
            <p style="padding:12px;background:#f5f5f5;border-radius:8px;">{texto_pregunta}</p>
            <a href="{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/dueno/seguimiento"
               style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2D6A4F;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
               Responder ahora
            </a>
        </div>
        """,
        subtype="html"
    )
    await _enviar_seguro(mensaje)


async def enviar_email_alerta_veterinario(email: str, nombre_mascota: str, nivel: str, motivo: str):
    colores = {"rojo": "#B42318", "naranja": "#C2410C", "amarillo": "#FACC15", "verde": "#15803D"}
    color = colores.get(nivel, "#2D6A4F")
    mensaje = MessageSchema(
        subject=f"VitalPet — Alerta {nivel.upper()}: {nombre_mascota}",
        recipients=[email],
        body=f"""
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e0e0e0;border-radius:12px;">
            <h2 style="color:#2D6A4F;">🐾 VitalPet</h2>
            <p style="display:inline-block;padding:4px 12px;border-radius:20px;background:{color};color:#fff;font-weight:700;">{nivel.upper()}</p>
            <p><strong>Mascota:</strong> {nombre_mascota}</p>
            <p><strong>Motivo:</strong> {motivo}</p>
            <a href="{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/admin/alertas"
               style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2D6A4F;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
               Ver alertas
            </a>
        </div>
        """,
        subtype="html"
    )
    await _enviar_seguro(mensaje)

def html_pendientes(nombre_mascota: str, pendientes: dict | None) -> str:
    """Bloque 'lo que falta' para el correo de cita próxima. Vacío si no hay datos."""
    if not pendientes:
        return ""
    mascota = escape(nombre_mascota)
    if pendientes["al_dia"]:
        return (
            '<div style="margin-top:18px;padding:12px 16px;background:#F1F8F4;border-radius:10px;color:#2D6A4F;">'
            f"✅ <strong>{mascota}</strong> está al día con su esquema y no tiene exámenes pendientes.</div>"
        )

    def lista(titulo: str, filas: list[str]) -> str:
        if not filas:
            return ""
        items = "".join(f'<li style="margin:3px 0;">{f}</li>' for f in filas)
        return f'<p style="margin:12px 0 2px;font-size:13px;color:#555;"><strong>{titulo}</strong></p><ul style="margin:0;padding-left:20px;font-size:14px;">{items}</ul>'

    vacunas = [f"{escape(v['nombre'])} — {escape(v['mensaje'])}" if v["mensaje"] else escape(v["nombre"])
               for v in pendientes["vacunas"]]
    examenes = [f"{escape(e['tipo_examen'])} — {'en proceso' if e['estado'] == 'en_proceso' else 'por realizar'}"
                for e in pendientes["examenes"]]
    return (
        '<div style="margin-top:18px;padding:14px 16px;background:#FFF6F1;border-radius:10px;">'
        f'<p style="margin:0;color:#B35330;"><strong>Antes de la cita, a {mascota} le falta:</strong></p>'
        + lista("💉 Vacunas y desparasitación", vacunas)
        + lista("🧪 Exámenes", examenes)
        + "</div>"
    )

async def enviar_email_recordatorio_cita(email: str, nombre_dueno: str, nombre_mascota: str, fecha_hora, motivo: str | None = None, franja: str | None = None, pendientes: dict | None = None):
    fecha = fecha_hora.strftime("%d/%m/%Y")
    # Las citas por franja no tienen hora exacta: se informa la franja del día.
    linea_hora = f"<p><strong>Franja:</strong> {franja}</p>" if franja else f"<p><strong>Hora:</strong> {fecha_hora.strftime('%I:%M %p')}</p>"
    linea_motivo = f"<p><strong>Motivo:</strong> {motivo}</p>" if motivo else ""
    mensaje = MessageSchema(
        subject=(f"VitalPet — Cita de {nombre_mascota}: te faltan {pendientes['total']} pendiente(s) 🐾"
                if pendientes and pendientes["total"] else f"VitalPet — Recordatorio de cita de {nombre_mascota} 🐾"),
        recipients=[email],
        body=f"""
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e0e0e0;border-radius:12px;">
            <h2 style="color:#2D6A4F;">🐾 VitalPet</h2>
            <p>Hola <strong>{nombre_dueno}</strong>,</p>
            <p>Te recordamos que <strong>{nombre_mascota}</strong> tiene una cita programada.</p>
            <p><strong>Fecha:</strong> {fecha}</p>
            {linea_hora}
            {linea_motivo}
            {html_pendientes(nombre_mascota, pendientes)}
            <p>Por favor asiste a tiempo. Si necesitas cancelar o reprogramar, comunícate con VitalPet.</p>
            <a href="{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/dueno/citas"
               style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2D6A4F;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
               Ver mis citas
            </a>
        </div>
        """,
        subtype="html"
    )
    await _enviar_seguro(mensaje)

def _frontend() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:5173")


def html_alerta_grave_dueno(nombre_dueno: str, nombre_mascota: str, motivo: str, telefono_clinica: str) -> str:
    """Correo para el dueño: tranquilo, claro y con una sola acción (llamar a la clínica)."""
    tel = escape(telefono_clinica)
    tel_link = "".join(c for c in telefono_clinica if c.isdigit() or c == "+")
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;border:1px solid #e0e0e0;border-radius:12px;overflow:hidden;">
        <div style="background:#B42318;color:#fff;padding:14px 24px;font-weight:700;letter-spacing:.04em;">🚨 ALERTA GRAVE</div>
        <div style="padding:24px 30px;">
            <p>Hola <strong>{escape(nombre_dueno)}</strong>,</p>
            <p>Por lo que se registró, <strong>{escape(nombre_mascota)}</strong> podría estar en riesgo y necesita atención veterinaria pronto.</p>
            <p style="background:#FEF3F2;border-radius:8px;padding:10px 14px;font-size:14px;"><strong>Qué se registró:</strong> {escape(motivo)}</p>
            <p style="margin-bottom:4px;"><strong>Qué hacer ahora:</strong></p>
            <ol style="margin-top:4px;padding-left:20px;">
                <li>Llama a la clínica: <strong>{tel}</strong>.</li>
                <li>Si no logras comunicarte, lleva a {escape(nombre_mascota)} a urgencias veterinarias.</li>
            </ol>
            <p style="font-size:14px;color:#555;">Nuestro equipo ya recibió este aviso y puede comunicarse contigo.</p>
            <a href="tel:{tel_link}"
               style="display:inline-block;margin-top:8px;padding:12px 24px;background:#B42318;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
               Llamar a la clínica
            </a>
        </div>
    </div>
    """


def html_alerta_grave_clinica(nombre_mascota: str, nombre_dueno: str, telefono_dueno: str | None, motivo: str, origen: str) -> str:
    """Correo para la clínica: todo lo necesario para actuar sin abrir el sistema."""
    contacto = escape(telefono_dueno) if telefono_dueno else "sin teléfono registrado"
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;border:1px solid #e0e0e0;border-radius:12px;overflow:hidden;">
        <div style="background:#B42318;color:#fff;padding:14px 24px;font-weight:700;letter-spacing:.04em;">🚨 ALERTA GRAVE — atender ya</div>
        <div style="padding:24px 30px;">
            <p><strong>Mascota:</strong> {escape(nombre_mascota)}</p>
            <p><strong>Dueño:</strong> {escape(nombre_dueno)} · {contacto}</p>
            <p><strong>Motivo:</strong> {escape(motivo)}</p>
            <p><strong>Origen:</strong> {escape(origen)}</p>
            <p style="font-size:14px;color:#555;">Se avisó también al dueño con la indicación de llamar a la clínica.</p>
            <a href="{_frontend()}/admin/alertas"
               style="display:inline-block;margin-top:8px;padding:12px 24px;background:#2D6A4F;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
               Ver alertas
            </a>
        </div>
    </div>
    """


async def enviar_email_alerta_grave_dueno(email: str, nombre_dueno: str, nombre_mascota: str, motivo: str, telefono_clinica: str):
    await _enviar_seguro(MessageSchema(
        subject=f"🚨 VitalPet — {nombre_mascota} necesita atención ahora",
        recipients=[email],
        body=html_alerta_grave_dueno(nombre_dueno, nombre_mascota, motivo, telefono_clinica),
        subtype="html",
    ))


async def enviar_email_alerta_grave_clinica(email: str, nombre_mascota: str, nombre_dueno: str, telefono_dueno: str | None, motivo: str, origen: str):
    await _enviar_seguro(MessageSchema(
        subject=f"🚨 VitalPet — ALERTA GRAVE: {nombre_mascota}",
        recipients=[email],
        body=html_alerta_grave_clinica(nombre_mascota, nombre_dueno, telefono_dueno, motivo, origen),
        subtype="html",
    ))
