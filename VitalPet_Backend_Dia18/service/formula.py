from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.formula import FormulaMedica, FormulaMedicamento
from models.historial import HistorialClinico
from schemas.formula import FormulaIn, MedicamentoIn


def resumen_medicamento(m) -> str:
    nombre = m.nombre_medicamento + (f" {m.presentacion}" if m.presentacion else "")
    detalle = [m.dosis]
    if m.via_administracion:
        detalle.append(f"vía {m.via_administracion}")
    detalle.append(m.frecuencia)
    if m.duracion_dias:
        detalle.append(f"por {m.duracion_dias} día{'s' if m.duracion_dias != 1 else ''}")
    return f"{nombre}: " + ", ".join(detalle)


class FormulaService:
    def __init__(self, db: Session):
        self.db = db

    def _historial(self, idHistorial: int) -> HistorialClinico:
        h = self.db.query(HistorialClinico).filter(HistorialClinico.idHistorial == idHistorial).first()
        if not h or h.estado == "inactivo":
            raise HTTPException(status_code=404, detail=f"El historial con id {idHistorial} no existe en el sistema.")
        return h

    def get_by_id(self, idFormula: int) -> FormulaMedica:
        f = self.db.query(FormulaMedica).filter(FormulaMedica.idFormula == idFormula).first()
        if not f:
            raise HTTPException(status_code=404, detail=f"La fórmula con id {idFormula} no existe en el sistema.")
        return f

    def get_by_historial(self, idHistorial: int, incluir_anuladas: bool = False):
        self._historial(idHistorial)
        q = self.db.query(FormulaMedica).filter(FormulaMedica.idHistorial == idHistorial)
        if not incluir_anuladas:
            q = q.filter(FormulaMedica.estado != "anulada")
        return q.order_by(FormulaMedica.fecha.desc(), FormulaMedica.idFormula.desc()).all()

    @staticmethod
    def _armar(items: list[MedicamentoIn]) -> list[FormulaMedicamento]:
        return [FormulaMedicamento(**m.model_dump()) for m in items]

    def _texto_legado(self, h: HistorialClinico):
        """historial_clinico.medicamentos queda como resumen de la fórmula activa (búsquedas)."""
        activa = next((f for f in h.formulas if f.estado != "anulada"), None)
        h.medicamentos = "\n".join(resumen_medicamento(m) for m in activa.medicamentos) \
            if activa and activa.medicamentos else None

    def guardar_para_historial_sin_commit(self, h: HistorialClinico, data: FormulaIn) -> FormulaMedica:
        """Crea la fórmula o reemplaza la activa. NO hace commit (lo hace HistorialService)."""
        activa = next((f for f in h.formulas if f.estado != "anulada"), None)
        if activa:
            activa.indicaciones_generales = data.recomendaciones
            activa.medicamentos.clear()
            self.db.flush()
            activa.medicamentos.extend(self._armar(data.medicamentos))
            formula = activa
        else:
            formula = FormulaMedica(
                idHistorial=h.idHistorial, indicaciones_generales=data.recomendaciones,
                estado="activa", medicamentos=self._armar(data.medicamentos),
            )
            self.db.add(formula)
        self.db.flush()
        self.db.refresh(h)
        self._texto_legado(h)
        return formula

    def crear(self, idHistorial: int, data: FormulaIn) -> FormulaMedica:
        h = self._historial(idHistorial)
        formula = FormulaMedica(
            idHistorial=h.idHistorial, indicaciones_generales=data.recomendaciones,
            estado="activa", medicamentos=self._armar(data.medicamentos),
        )
        self.db.add(formula)
        self.db.flush()
        self.db.refresh(h)
        self._texto_legado(h)
        self.db.commit()
        self.db.refresh(formula)
        return formula

    def actualizar(self, idFormula: int, data: FormulaIn) -> FormulaMedica:
        formula = self.get_by_id(idFormula)
        if formula.estado == "anulada":
            raise HTTPException(status_code=400, detail="La fórmula está anulada y no se puede modificar.")
        formula.indicaciones_generales = data.recomendaciones
        formula.medicamentos.clear()
        self.db.flush()
        formula.medicamentos.extend(self._armar(data.medicamentos))
        self.db.flush()
        h = self._historial(formula.idHistorial)
        self.db.refresh(h)
        self._texto_legado(h)
        self.db.commit()
        self.db.refresh(formula)
        return formula

    def anular(self, idFormula: int) -> bool:
        formula = self.get_by_id(idFormula)
        if formula.estado == "anulada":
            raise HTTPException(status_code=400, detail="La fórmula ya estaba anulada.")
        formula.estado = "anulada"
        self.db.flush()
        h = self._historial(formula.idHistorial)
        self.db.refresh(h)
        self._texto_legado(h)
        self.db.commit()
        return True