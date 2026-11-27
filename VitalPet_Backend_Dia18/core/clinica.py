"""Datos de la clínica para documentos (PDF de certificados). Se pueden cambiar desde el .env."""
import os

CLINICA_NOMBRE = os.getenv("CLINICA_NOMBRE", "Clínica Veterinaria VitalPet")
CLINICA_DIRECCION = os.getenv("CLINICA_DIRECCION", "Cra. 15 #45-20 — Bogotá, Colombia")
CLINICA_TELEFONO = os.getenv("CLINICA_TELEFONO", "(601) 234-5678")
# Correo general de la clínica: recibe las alertas graves además del personal registrado.
CLINICA_EMAIL = os.getenv("CLINICA_EMAIL", "")