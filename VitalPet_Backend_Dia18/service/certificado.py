"""
Certificados: emisión, consulta y anulación.

Reglas:
  * Solo emite un veterinario con tarjeta profesional (queda congelada en el certificado,
    junto con su nombre, la firma, la mascota y el dueño).
  * Un certificado emitido NO se edita ni se borra: no existe ninguna operación para eso
    (y migracion_p2_certificados.sql lo impide también en la base de datos). Solo se anula.
  * Cada certificado guarda una huella SHA-256 de su contenido: si alguien altera la base
    de datos a mano, `es_integro()` deja de dar True.
"""
import hashlib
import json
import secrets

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.certificado import Certificado
from models.historial import HistorialClinico
from models.mascota import Mascota
from models.user import User
from schemas.certificado import CertificadoCreate
import hashlib
import json
import re
from datetime import date, datetime


from sqlalchemy import or_


# Sin 0/O/1/I/L para que el código se pueda dictar o copiar sin confundirse.
_ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _codigo_verificacion() -> str:
    return "".join(secrets.choice(_ALFABETO) for _ in range(10))


def calcular_huella(c: Certificado) -> str:
    """SHA-256 de todo lo que no debe cambiar jamás en un certificado emitido."""
    base = {
        "codigo": c.codigo,
        "codigo_verificacion": c.codigo_verificacion,
        "tipo": c.tipo,
        "idMascota": c.idMascota,
        "idHistorial": c.idHistorial,
        "idUsuario": c.idUsuario,
        "fechaEmision": c.fechaEmision.replace(microsecond=0).isoformat() if c.fechaEmision else None,
        "vigenciaHasta": c.vigenciaHasta.isoformat() if c.vigenciaHasta else None,
        "contenido": c.contenido,
        "mascota_nombre": c.mascota_nombre,
        "mascota_especie": c.mascota_especie,
        "mascota_raza": c.mascota_raza,
        "dueno_nombre": c.dueno_nombre,
        "nombre_veterinario": c.nombre_veterinario,
        "tarjeta_profesional": c.tarjeta_profesional,
        "lote": c.lote,
    }
    texto = json.dumps(base, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()


def es_integro(c: Certificado) -> bool:
    return bool(c.huella) and c.huella == calcular_huella(c)


def _nombre(u: User | None) -> str:
    return f"{u.nombre} {u.apellido or ''}".strip() if u else ""


class CertificadoService:
    def __init__(self, db: Session):
        self.db = db

    # ---------- utilidades ----------
    def _mascota(self, idMascota: int) -> Mascota:
        m = self.db.query(Mascota).filter(Mascota.idMascota == idMascota).first()
        if not m or m.estado == "inactivo":
            raise HTTPException(status_code=404, detail=f"La mascota con id {idMascota} no existe en el sistema.")
        return m

    def _veterinario(self, usuario: User):
        vet = usuario.veterinario
        if not vet or vet.estado != "activo":
            raise HTTPException(
                status_code=403,
                detail="Solo un veterinario con tarjeta profesional activa puede emitir o anular certificados.",
            )
        return vet

    @staticmethod
    def _puede_ver(c: Certificado, m: Mascota, usuario: User):
        if usuario.rol == "dueno" and m.idUsuario != usuario.idUsuario:
            raise HTTPException(status_code=403, detail="No puedes consultar un certificado de una mascota que no te pertenece.")

    @staticmethod
    def _a_out(c: Certificado) -> Certificado:
        c.__dict__["integro"] = es_integro(c)
        return c

    def _codigo_unico(self, columna, generar) -> str:
        for _ in range(8):
            valor = generar()
            if not self.db.query(Certificado.idCertificado).filter(columna == valor).first():
                return valor
        raise HTTPException(status_code=500, detail="No se pudo generar un código único. Intenta de nuevo.")

    # ---------- firma del veterinario ----------
    def firma_de(self, usuario: User) -> dict:
        vet = self._veterinario(usuario)
        return {"registrada": bool(vet.firma), "firma": vet.firma}

    def guardar_firma(self, usuario: User, firma: str) -> dict:
        vet = self._veterinario(usuario)
        vet.firma = firma
        self.db.commit()
        return {"registrada": True, "firma": vet.firma}

    # ---------- emitir ----------
    def emitir(self, data: CertificadoCreate, usuario: User) -> Certificado:
        vet = self._veterinario(usuario)
        mascota = self._mascota(data.idMascota)

        if data.tipo == "vacunacion" and not data.lote:
            raise HTTPException(
                status_code=400,
                detail="Un certificado de vacunación necesita el lote de la vacuna aplicada.",
            )
        if data.idHistorial is not None:
            h = self.db.query(HistorialClinico).filter(HistorialClinico.idHistorial == data.idHistorial).first()
            if not h or h.idMascota != mascota.idMascota:
                raise HTTPException(status_code=400, detail="El historial indicado no pertenece a esta mascota.")

        ahora = datetime.now().replace(microsecond=0)
        anio = ahora.year
        c = Certificado(
            codigo=self._codigo_unico(Certificado.codigo, lambda: f"CERT-{anio}-{secrets.token_hex(3).upper()}"),
            codigo_verificacion=self._codigo_unico(Certificado.codigo_verificacion, _codigo_verificacion),
            tipo=data.tipo,
            idMascota=mascota.idMascota,
            idHistorial=data.idHistorial,
            idUsuario=usuario.idUsuario,
            fechaEmision=ahora,
            vigenciaHasta=data.vigenciaHasta,
            contenido=data.contenido,
            lote=data.lote,
            estado="emitido",
            # --- datos congelados ---
            mascota_nombre=mascota.nombre_mascota,
            mascota_especie=mascota.especie,
            mascota_raza=mascota.raza,
            dueno_nombre=_nombre(mascota.dueno),
            nombre_veterinario=_nombre(usuario),
            tarjeta_profesional=vet.tarjetaProfesional,
            firma_veterinario=vet.firma,
        )
        c.huella = calcular_huella(c)
        self.db.add(c)
        self.db.commit()
        self.db.refresh(c)
        return self._a_out(c)

    # ---------- consultar ----------
    def por_mascota(self, idMascota: int, usuario: User):
        m = self._mascota(idMascota)
        if usuario.rol == "dueno" and m.idUsuario != usuario.idUsuario:
            raise HTTPException(status_code=403, detail="No puedes consultar los certificados de una mascota que no te pertenece.")
        filas = (self.db.query(Certificado)
                 .filter(Certificado.idMascota == idMascota)
                 .order_by(Certificado.fechaEmision.desc(), Certificado.idCertificado.desc()).all())
        return [self._a_out(c) for c in filas]

    def obtener(self, idCertificado: int, usuario: User) -> Certificado:
        c = self.db.query(Certificado).filter(Certificado.idCertificado == idCertificado).first()
        if not c:
            raise HTTPException(status_code=404, detail=f"El certificado con id {idCertificado} no existe.")
        self._puede_ver(c, self._mascota(c.idMascota), usuario)
        return self._a_out(c)

    # ---------- anular (lo único que se puede hacer después de emitir) ----------
    def anular(self, idCertificado: int, motivo: str, usuario: User) -> Certificado:
        c = self.db.query(Certificado).filter(Certificado.idCertificado == idCertificado).first()
        if not c:
            raise HTTPException(status_code=404, detail=f"El certificado con id {idCertificado} no existe.")
        if usuario.rol != "administrador" and c.idUsuario != usuario.idUsuario:
            raise HTTPException(status_code=403, detail="Solo el veterinario que emitió el certificado (o un administrador) puede anularlo.")
        if c.estado == "anulado":
            raise HTTPException(status_code=400, detail="El certificado ya estaba anulado.")
        c.estado = "anulado"
        c.motivo_anulacion = motivo
        c.fechaAnulacion = datetime.now().replace(microsecond=0)
        self.db.commit()
        self.db.refresh(c)
        return self._a_out(c)

        # ---------- verificación pública (sin sesión) ----------
    def verificar_publico(self, codigo: str) -> dict:
        """Acepta el código de verificación (ABCDE-FGHJK o ABCDEFGHJK) o el número CERT-2026-XXXXXX."""
        limpio = (codigo or "").strip().upper()
        if re.fullmatch(r"[A-Z0-9]{5}-[A-Z0-9]{5}", limpio):
            limpio = limpio.replace("-", "")
        if not 6 <= len(limpio) <= 30:
            raise HTTPException(status_code=404, detail="No existe un certificado con ese código.")
        c = (self.db.query(Certificado)
             .filter(or_(Certificado.codigo_verificacion == limpio, Certificado.codigo == limpio))
             .first())
        if not c:
            raise HTTPException(status_code=404, detail="No existe un certificado con ese código.")

        integro = es_integro(c)
        anulado = c.estado == "anulado"
        vigente = c.vigenciaHasta is None or c.vigenciaHasta >= date.today()
        if not integro:
            mensaje = "NO VÁLIDO: el contenido de este certificado no coincide con el que se emitió originalmente."
        elif anulado:
            mensaje = "Certificado ANULADO: fue auténtico pero ya no tiene validez."
        elif not vigente:
            mensaje = "Certificado auténtico, pero su vigencia ya venció."
        else:
            mensaje = "Certificado auténtico y vigente."
        return {
            "valido": integro and not anulado and vigente,
            "estado": c.estado, "integro": integro, "vigente": vigente, "mensaje": mensaje,
            "codigo": c.codigo, "tipo": c.tipo, "fechaEmision": c.fechaEmision,
            "vigenciaHasta": c.vigenciaHasta, "fechaAnulacion": c.fechaAnulacion,
            "mascota_nombre": c.mascota_nombre, "mascota_especie": c.mascota_especie,
            "nombre_veterinario": c.nombre_veterinario, "tarjeta_profesional": c.tarjeta_profesional,
            "lote": c.lote,
        }

    # ---------- PDF ----------
    def pdf(self, idCertificado: int, usuario: User, url_base_verificacion: str = "") -> tuple[bytes, str]:
        from service.certificado_pdf import generar_pdf_certificado
        c = self.obtener(idCertificado, usuario)          # valida permisos (el dueño solo ve los suyos)
        if not c.integro:
            raise HTTPException(
                status_code=409,
                detail="Este certificado fue alterado después de emitirse; no se puede generar su PDF.",
            )
        url = f"{url_base_verificacion.rstrip('/')}/verificar/{c.codigo_verificacion}" if url_base_verificacion else None
        return generar_pdf_certificado(c, url), f"{c.codigo}.pdf"
