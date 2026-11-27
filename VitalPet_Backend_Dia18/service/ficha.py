"""
Ficha del paciente: todo lo de una mascota en una sola respuesta (anamnesis, exámenes,
fórmulas, controles, compras, desparasitación, inyecciones...), para que el veterinario
no tenga que abrir cinco pantallas distintas.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from models.certificado import Certificado
from models.cita import Cita
from models.historial import HistorialClinico
from models.laboratorio import ExamenLaboratorio
from models.mascota import Mascota
from models.user import User
from models.vacuna import Vacuna
from models.venta import Venta
from service.historial import HistorialService
from service.laboratorio import LaboratorioService


def _nombre(u: User | None) -> str | None:
    return f"{u.nombre} {u.apellido or ''}".strip() if u else None


def _aplicacion(v: Vacuna) -> dict:
    return {
        "idVacuna": v.idVacuna, "nombre": v.nombre_vacuna, "fecha_aplicacion": v.fecha_aplicacion,
        "proxima_dosis": v.proxima_dosis, "lote": v.lote, "veterinario": v.veterinario,
        "observaciones": v.observaciones,
    }


class FichaService:
    def __init__(self, db: Session):
        self.db = db

    def de_mascota(self, idMascota: int, usuario: User) -> dict:
        m = self.db.query(Mascota).options(joinedload(Mascota.dueno)).filter(Mascota.idMascota == idMascota).first()
        if not m or m.estado == "inactivo":
            raise HTTPException(status_code=404, detail=f"La mascota con id {idMascota} no existe en el sistema.")

        # Consultas activas, de la más reciente a la más antigua.
        historiales = (
            self.db.query(HistorialClinico)
            .options(joinedload(HistorialClinico.secciones), joinedload(HistorialClinico.formulas),
                     joinedload(HistorialClinico.veterinario))
            .filter(HistorialClinico.idMascota == idMascota, HistorialClinico.estado == "activo")
            .order_by(HistorialClinico.fechaRegistro.desc(), HistorialClinico.idHistorial.desc())
            .all()
        )
        # Registros "vacíos" (el que se crea solo al registrar la mascota) no son un control.
        controles_h = [h for h in historiales if self._es_consulta(h)]
        por_id = {h.idHistorial: h for h in historiales}

        controles, inyecciones, formulas = [], [], []
        for h in controles_h:
            sec = {s.tipo: s.contenido for s in h.secciones}
            controles.append({
                "idHistorial": h.idHistorial, "fecha": h.fechaRegistro,
                "motivo_consulta": h.motivo_consulta, "diagnostico": h.diagnostico,
                "tratamiento": h.tratamiento, "observaciones": h.observaciones,
                "peso_consulta": h.peso_consulta, "temperatura": h.temperatura,
                "frecuencia_cardiaca": h.frecuencia_cardiaca, "frecuencia_respiratoria": h.frecuencia_respiratoria,
                "mucosas": h.mucosas, "hidratacion": h.hidratacion, "condicion_corporal": h.condicion_corporal,
                "proxima_cita": h.proxima_cita, "nombre_veterinario": _nombre(h.veterinario),
                "anamnesis": sec.get("anamnesis"), "examen_fisico": sec.get("examen_fisico"),
                "procedimientos": sec.get("procedimientos"), "inyectologia": sec.get("inyectologia"),
            })
            if sec.get("inyectologia"):
                inyecciones.append({"idHistorial": h.idHistorial, "fecha": h.fechaRegistro, "contenido": sec["inyectologia"]})
        for h in historiales:
            for f in h.formulas:
                if f.estado != "anulada":
                    f.__dict__["diagnostico"] = h.diagnostico
                    formulas.append(f)
        formulas.sort(key=lambda f: (f.fecha is None, f.fecha), reverse=True)

        # Esquema sanitario: vacunas, desparasitaciones y antipulgas (tabla vacunas, campo tipo).
        aplicaciones = (
            self.db.query(Vacuna)
            .filter(Vacuna.idMascota == idMascota, Vacuna.estado == "activo")
            .order_by(Vacuna.fecha_aplicacion.desc()).all()
        )
        por_tipo = {"vacuna": [], "desparasitacion": [], "antipulgas": []}
        for v in aplicaciones:
            por_tipo.setdefault(v.tipo or "vacuna", []).append(_aplicacion(v))

        examenes = (
            self.db.query(ExamenLaboratorio)
            .options(joinedload(ExamenLaboratorio.mascota))
            .filter(ExamenLaboratorio.idMascota == idMascota, ExamenLaboratorio.estado != "cancelado")
            .order_by(ExamenLaboratorio.fecha_solicitud.desc()).all()
        )
        lab = LaboratorioService(self.db)
        examenes = [lab._enriquecer(e) for e in examenes]

        # Compras: las ventas ligadas a una consulta de ESTA mascota.
        ventas = []
        if por_id:
            ventas = (
                self.db.query(Venta)
                .options(joinedload(Venta.detalles))
                .filter(Venta.idHistorial.in_(list(por_id)), Venta.estado != "cancelada")
                .order_by(Venta.fecha.desc()).all()
            )
        compras = [{
            "idVenta": v.idVenta, "fecha": v.fecha, "total": v.total, "estado": v.estado,
            "idHistorial": v.idHistorial,
            "items": [{"nombre_producto": d.producto.nombre_producto if d.producto else f"Producto #{d.idProducto}",
                       "cantidad": d.cantidad, "subtotal": d.subtotal} for d in v.detalles],
        } for v in ventas]

        citas = (
            self.db.query(Cita)
            .options(joinedload(Cita.franja), joinedload(Cita.veterinario))
            .filter(Cita.idMascota == idMascota)
            .order_by(Cita.fechaHora.desc()).all()
        )
        citas_out = [{
            "idCita": c.idCita, "fechaHora": c.fechaHora, "estado": c.estado, "motivo": c.motivo,
            "franja": c.franja.nombre if c.franja else None,
            "nombre_veterinario": _nombre(c.veterinario.usuario) if c.veterinario else None,
        } for c in citas]

        certificados = (
            self.db.query(Certificado).filter(Certificado.idMascota == idMascota)
            .order_by(Certificado.fechaEmision.desc(), Certificado.idCertificado.desc()).all()
        )

        pesos = HistorialService(self.db).pesos_por_mascota(idMascota)
        dueno = m.dueno
        return {
            "mascota": m,
            "dueno": dueno,
            "resumen": {
                "total_controles": len(controles), "total_formulas": len(formulas),
                "total_examenes": len(examenes), "total_aplicaciones": len(aplicaciones),
                "total_compras": len(compras), "total_certificados": len(certificados),
                "ultima_consulta": controles[0]["fecha"] if controles else None,
                "peso_actual": m.peso_kg,
            },
            "controles": controles,
            "formulas": formulas,
            "laboratorio": examenes,
            "vacunas": por_tipo["vacuna"],
            "desparasitaciones": por_tipo["desparasitacion"],
            "antipulgas": por_tipo["antipulgas"],
            "inyecciones": inyecciones,
            "compras": compras,
            "citas": citas_out,
            "certificados": certificados,
            "pesos": pesos,
            "cita_control": HistorialService(self.db)._cita_control(idMascota),
        }

    @staticmethod
    def _es_consulta(h: HistorialClinico) -> bool:
        """Misma idea que HistorialService._consultas_previas: tiene algún dato clínico real."""
        return bool(
            (h.motivo_consulta or "").strip() or (h.diagnostico or "").strip() or (h.tratamiento or "").strip()
            or h.peso_consulta is not None or h.temperatura is not None or h.secciones
        )
