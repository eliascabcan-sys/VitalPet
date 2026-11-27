"""Limitador simple en memoria para endpoints públicos (por IP, ventana deslizante)."""
import time
from collections import defaultdict, deque


class LimitadorPorIP:
    def __init__(self, maximo: int = 20, ventana_segundos: int = 60):
        self.maximo = maximo
        self.ventana = ventana_segundos
        self._visitas: dict[str, deque] = defaultdict(deque)

    def permitir(self, ip: str, ahora: float | None = None) -> bool:
        ahora = time.monotonic() if ahora is None else ahora
        cola = self._visitas[ip]
        while cola and ahora - cola[0] > self.ventana:
            cola.popleft()
        if len(cola) >= self.maximo:
            return False
        cola.append(ahora)
        return True