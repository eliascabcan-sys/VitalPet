"""
==========================================================================
 ESCUDO ANTI-XSS / ANTI-SCRIPTING (Frontera Segura - Pydantic)
==========================================================================
Validador reutilizable para todos los DTOs (schemas/*.py) de la API.

Si un usuario intenta meter etiquetas HTML, código JavaScript o
manejadores de eventos inline (onerror, onload, onclick, etc.) en
cualquier campo de texto, la petición es rechazada por Pydantic en
la frontera de la API (HTTP 422 Unprocessable Entity), antes de que
el dato llegue a la lógica de negocio o a la base de datos.
==========================================================================
"""
import re

_PATRON_SCRIPTING = re.compile(
    r"<[^>]*>|javascript:|on(error|load|click|mouseover|focus)\s*=",
    re.IGNORECASE,
)


def anti_xss(valor: str) -> str:
    """
    Detecta y bloquea intentos de scripting/HTML en un campo de texto.

    Uso en un schema:
        @field_validator("campo")
        @classmethod
        def validar_campo(cls, valor):
            return anti_xss(valor)
    """
    if valor is None:
        return valor

    if _PATRON_SCRIPTING.search(valor):
        raise ValueError(
            "❌ VALIDACIÓN BLOQUEADA: no se permiten etiquetas HTML ni código de scripting."
        )

    return valor.strip()
