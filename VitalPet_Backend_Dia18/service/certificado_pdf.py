"""Generación del PDF de un certificado (A4) con reportlab."""
import base64
import io
import re
from datetime import date, datetime
from typing import Optional
from xml.sax.saxutils import escape

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

from core.clinica import CLINICA_DIRECCION, CLINICA_NOMBRE, CLINICA_TELEFONO
from models.certificado import Certificado

ETIQUETA_TIPO = {
    "salud": "Salud", "vacunacion": "Vacunación", "viaje": "Viaje",
    "esterilizacion": "Esterilización", "defuncion": "Defunción", "otro": "Otro",
}
AZUL = colors.HexColor("#1A6FA8")
GRIS = colors.HexColor("#55606b")


def _fecha(v: Optional[date | datetime]) -> str:
    if not v:
        return "—"
    meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
             "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    return f"{v.day} de {meses[v.month - 1]} de {v.year}"


def _codigo_legible(c: Optional[str]) -> str:
    return f"{c[:5]}-{c[5:]}" if c and len(c) == 10 else (c or "—")


def _imagen_firma(data_url: Optional[str]):
    if not data_url:
        return None
    m = re.match(r"^data:image/(png|jpeg);base64,(.+)$", data_url)
    if not m:
        return None
    try:
        return ImageReader(io.BytesIO(base64.b64decode(m.group(2))))
    except Exception:
        return None


def generar_pdf_certificado(c: Certificado, url_verificacion: Optional[str] = None) -> bytes:
    buf = io.BytesIO()
    pdf = canvas.Canvas(buf, pagesize=A4)
    pdf.setTitle(f"Certificado {c.codigo}")
    pdf.setAuthor(CLINICA_NOMBRE)
    ancho, alto = A4
    mx = 2 * cm
    util = ancho - 2 * mx
    y = alto - 2 * cm

    # --- Encabezado ---
    pdf.setFillColor(AZUL)
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(mx, y, CLINICA_NOMBRE)
    pdf.setFillColor(GRIS)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(mx, y - 14, f"{CLINICA_DIRECCION} · Tel. {CLINICA_TELEFONO}")
    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawRightString(ancho - mx, y, f"N.º {c.codigo}")
    pdf.setFont("Helvetica", 9)
    pdf.drawRightString(ancho - mx, y - 14, f"Emitido el {_fecha(c.fechaEmision)}")
    y -= 26
    pdf.setStrokeColor(AZUL)
    pdf.setLineWidth(1.5)
    pdf.line(mx, y, ancho - mx, y)

    # --- Título ---
    y -= 1.2 * cm
    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawCentredString(ancho / 2, y, f"CERTIFICADO DE {ETIQUETA_TIPO.get(c.tipo, c.tipo).upper()}")

    # --- Datos del paciente ---
    y -= 1.0 * cm
    filas = [("Paciente", c.mascota_nombre, "Especie", c.mascota_especie),
             ("Raza", c.mascota_raza, "Propietario", c.dueno_nombre)]
    pdf.setLineWidth(0.5)
    pdf.setStrokeColor(colors.HexColor("#b8c2cc"))
    for et1, v1, et2, v2 in filas:
        pdf.rect(mx, y - 18, util, 22, stroke=1, fill=0)
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(mx + 6, y - 11, et1)
        pdf.drawString(mx + util / 2 + 6, y - 11, et2)
        pdf.setFont("Helvetica", 10)
        pdf.drawString(mx + 70, y - 11, (v1 or "—")[:34])
        pdf.drawString(mx + util / 2 + 76, y - 11, (v2 or "—")[:30])
        y -= 22

    # --- Cuerpo ---
    y -= 0.8 * cm
    estilo = ParagraphStyle("cuerpo", fontName="Helvetica", fontSize=11, leading=16)
    texto = escape(c.contenido).replace("\n", "<br/>")
    p = Paragraph(texto, estilo)
    _, h = p.wrap(util, alto)
    p.drawOn(pdf, mx, y - h)
    y -= h + 0.4 * cm
    if c.vigenciaHasta:
        pdf.setFont("Helvetica-Oblique", 10)
        pdf.drawString(mx, y - 10, f"Válido hasta el {_fecha(c.vigenciaHasta)}.")
        y -= 0.8 * cm

    # --- Lote y recuadro para sticker ---
    y -= 0.6 * cm
    pdf.setStrokeColor(colors.black)
    pdf.setLineWidth(0.7)
    pdf.rect(mx, y - 2.2 * cm, 6 * cm, 2.2 * cm, stroke=1, fill=0)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(mx + 6, y - 12, "LOTE")
    pdf.setFont("Helvetica", 12)
    pdf.drawString(mx + 6, y - 1.5 * cm, c.lote or "")
    pdf.setDash(3, 3)
    pdf.setStrokeColor(GRIS)
    pdf.rect(mx + 7 * cm, y - 2.2 * cm, 6 * cm, 2.2 * cm, stroke=1, fill=0)
    pdf.setDash()
    pdf.setFillColor(GRIS)
    pdf.setFont("Helvetica", 8)
    pdf.drawCentredString(mx + 10 * cm, y - 1.1 * cm, "Espacio para sticker")
    pdf.setFillColor(colors.black)
    y -= 2.2 * cm + 1.2 * cm

    # --- Firma ---
    firma = _imagen_firma(c.firma_veterinario)
    if firma:
        try:
            pdf.drawImage(firma, mx, y - 1.4 * cm, width=5 * cm, height=1.6 * cm,
                          preserveAspectRatio=True, mask="auto")
        except Exception:
            pass
    pdf.setStrokeColor(colors.black)
    pdf.line(mx, y - 1.6 * cm, mx + 7 * cm, y - 1.6 * cm)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(mx, y - 2.1 * cm, c.nombre_veterinario or "Médico veterinario")
    pdf.setFont("Helvetica", 9)
    pdf.drawString(mx, y - 2.6 * cm, f"Médico veterinario · T.P. {c.tarjeta_profesional or '—'}")

    # --- Pie: código de verificación y QR ---
    pdf.setStrokeColor(colors.HexColor("#b8c2cc"))
    pdf.setLineWidth(0.5)
    pdf.line(mx, 3.4 * cm, ancho - mx, 3.4 * cm)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(mx, 2.8 * cm, f"Código de verificación: {_codigo_legible(c.codigo_verificacion)}")
    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(GRIS)
    pdf.drawString(mx, 2.35 * cm, "Compruebe que este documento es auténtico ingresando el código en la página de verificación.")
    if url_verificacion:
        pdf.drawString(mx, 1.95 * cm, url_verificacion[:95])
    pdf.drawString(mx, 1.4 * cm, "Documento generado por VitalPet. Un certificado emitido no se puede modificar;")
    pdf.drawString(mx, 1.05 * cm, "si tiene un error se anula y se emite uno nuevo.")
    if url_verificacion:
        widget = qr.QrCodeWidget(url_verificacion)
        x0, y0, x1, y1 = widget.getBounds()
        lado = 2.6 * cm
        d = Drawing(lado, lado, transform=[lado / (x1 - x0), 0, 0, lado / (y1 - y0), 0, 0])
        d.add(widget)
        renderPDF.draw(d, pdf, ancho - mx - lado, 0.9 * cm)

    # --- Marca de agua si está anulado ---
    if c.estado == "anulado":
        pdf.saveState()
        pdf.setFillColor(colors.Color(0.8, 0.1, 0.1, alpha=0.25))
        pdf.setFont("Helvetica-Bold", 90)
        pdf.translate(ancho / 2, alto / 2)
        pdf.rotate(35)
        pdf.drawCentredString(0, 0, "ANULADO")
        pdf.restoreState()

    pdf.showPage()
    pdf.save()
    return buf.getvalue()