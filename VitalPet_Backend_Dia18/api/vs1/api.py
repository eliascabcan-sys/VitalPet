from fastapi import APIRouter
from api.vs1.endpoints.users        import router as users_router
from api.vs1.endpoints.mascota      import router as mascota_router
from api.vs1.endpoints.mascota_foto import router as mascota_foto_router      
from api.vs1.endpoints.categorias   import router as categorias_router
from api.vs1.endpoints.products     import router as products_router
from api.vs1.endpoints.citas        import router as citas_router
from api.vs1.endpoints.historial    import router as historial_router
from api.vs1.endpoints.ventas       import router as ventas_router
from api.vs1.endpoints.veterinarios import router as veterinarios_router
from api.vs1.endpoints.seguimientos import router as seguimientos_router
from api.vs1.endpoints.auth         import router as auth_router
from api.vs1.auth_google            import router as google_router
from api.vs1.endpoints.vacuna import router as vacuna_router
from api.vs1.endpoints.derivaciones import router as derivaciones_router
from api.vs1.endpoints.reportes_salud import router as reportes_salud_router
from api.vs1.endpoints.triaje import router as triaje_router
from api.vs1.endpoints.automatizacion import router as automatizacion_router
from api.vs1.endpoints.formulas import router as formulas_router
from api.vs1.endpoints.laboratorio import router as laboratorio_router
from api.vs1.endpoints.esquema_sanitario import router as esquema_sanitario_router
from api.vs1.endpoints.certificados import router as certificados_router
from api.vs1.endpoints.ficha import router as ficha_router
from api.vs1.endpoints.subcategorias import router as subcategorias_router
from api.vs1.endpoints.autorizaciones import router as autorizaciones_router
from api.vs1.endpoints.contacto_directo import router as contacto_directo_router

api_router = APIRouter()
api_router.include_router(users_router,        prefix="/users",        tags=["Usuarios"])
api_router.include_router(mascota_router,      prefix="/mascotas",     tags=["Mascotas"])
api_router.include_router(mascota_foto_router, prefix="/mascotas",     tags=["Foto de mascota"])   
api_router.include_router(categorias_router,   prefix="/categorias",   tags=["Categorias"])
api_router.include_router(products_router,     prefix="/products",     tags=["Productos"])
api_router.include_router(citas_router,        prefix="/citas",        tags=["Citas"])
api_router.include_router(historial_router,    prefix="/historial",    tags=["Historial Clinico"])
api_router.include_router(ventas_router,       prefix="/ventas",       tags=["Ventas"])
api_router.include_router(veterinarios_router, prefix="/veterinarios", tags=["Veterinarios"])
api_router.include_router(seguimientos_router, prefix="/seguimientos", tags=["Seguimiento Automatico"])
api_router.include_router(auth_router,         prefix="/auth",         tags=["Autenticacion"])
api_router.include_router(google_router,       prefix="/auth",         tags=["Google OAuth2"])
api_router.include_router(vacuna_router,       prefix="/vacunas",      tags=["Vacunación"])
api_router.include_router(derivaciones_router, prefix="/derivaciones", tags=["Derivaciones"])
api_router.include_router(reportes_salud_router, prefix="/reportes-salud", tags=["Reportes de salud"])
api_router.include_router(triaje_router, prefix="/triaje", tags=["Triaje"])
api_router.include_router(automatizacion_router, prefix="/automatizacion", tags=["Automatización"])
api_router.include_router(formulas_router, prefix="/formulas", tags=["Fórmulas"])
api_router.include_router(laboratorio_router, prefix="/laboratorio", tags=["Laboratorio clínico"])
api_router.include_router(esquema_sanitario_router, prefix="/esquema-sanitario", tags=["Esquema sanitario"])
api_router.include_router(certificados_router, prefix="/certificados", tags=["Certificados"])
api_router.include_router(ficha_router, prefix="/ficha", tags=["Ficha del paciente"])
api_router.include_router(subcategorias_router, prefix="/subcategorias", tags=["Subcategorias"])
api_router.include_router(autorizaciones_router, prefix="/autorizaciones", tags=["Autorizaciones (adultos mayores)"])
api_router.include_router(contacto_directo_router, prefix="/contacto-directo", tags=["Contacto directo"])