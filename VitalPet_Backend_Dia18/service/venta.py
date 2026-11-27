from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from models.venta import Venta
from models.detalle_venta import DetalleVenta
from models.product import Product
from models.historial import HistorialClinico
from models.mascota import Mascota
from schemas.venta import VentaCreate, VentaUpdate

class VentaService:
    def __init__(self, db: Session):
        self.db = db

    def _query_base(self):
        return self.db.query(Venta).options(joinedload(Venta.detalles).joinedload(DetalleVenta.producto))

    def _enriquecer(self, venta: Venta):
        if venta:
            for d in venta.detalles:
                if d.producto:
                    d.__dict__["nombre_producto"] = d.producto.nombre_producto
                    d.__dict__["requierePrescripcion"] = d.producto.requierePrescripcion
        return venta

    def _validar_prescripcion(self, data: VentaCreate, requiere_receta: list[Product]):
        """
        RQF: una venta que incluya productos que requierePrescripcion
        solo puede crearse si viene amarrada (idHistorial) a un
        historial clínico ACTIVO, de una mascota del mismo dueño que
        compra, y que todavía no haya sido usado en otra venta.
        """
        nombres = ", ".join(p.nombre_producto for p in requiere_receta)

        if not data.idHistorial:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Los siguientes productos requieren receta médica y no se pueden "
                    f"vender sin una cita/historial clínico asociado: {nombres}. "
                    f"Envía 'idHistorial' con el historial donde se prescribió."
                ),
            )

        historial = self.db.query(HistorialClinico).filter(
            HistorialClinico.idHistorial == data.idHistorial
        ).first()

        if not historial:
            raise HTTPException(
                status_code=404,
                detail=f"El historial clínico con id {data.idHistorial} no existe.",
            )

        if historial.estado == "inactivo":
            raise HTTPException(
                status_code=400,
                detail="El historial clínico indicado fue eliminado y no es válido para justificar la venta.",
            )

        if historial.prescripcionUsada:
            raise HTTPException(
                status_code=400,
                detail=f"La prescripción del historial {historial.idHistorial} ya fue utilizada en otra venta.",
            )

        mascota = self.db.query(Mascota).filter(Mascota.idMascota == historial.idMascota).first()
        if not mascota or mascota.idUsuario != data.idUsuario:
            raise HTTPException(
                status_code=400,
                detail="El historial clínico indicado no pertenece a una mascota de este dueño.",
            )

        return historial

    def get_all(self):
        return [self._enriquecer(v) for v in self._query_base().all()]

    def get_by_usuario(self, usuario_id: int):
        ventas = self._query_base().filter(Venta.idUsuario == usuario_id).all()
        return [self._enriquecer(v) for v in ventas]

    def get_by_id(self, id: int):
        venta = self._query_base().filter(Venta.idVenta == id).first()
        if not venta:
            raise HTTPException(status_code=404, detail=f"La venta con id {id} no existe en el sistema.")
        return self._enriquecer(venta)

    def create(self, data: VentaCreate):
        total = 0
        detalles = []
        productos_con_receta = []
        productos_reservados = []

        # Primero validamos TODO. No tocamos el stock hasta que la venta
        # sea válida; así una validación fallida nunca deja cambios
        # pendientes en la transacción.
        for item in data.items:
            producto = self.db.query(Product).filter(Product.idProducto == item.idProducto).first()
            if not producto:
                raise HTTPException(status_code=404, detail=f"El producto con id {item.idProducto} no existe en el sistema.")
            if producto.estado == "inactivo":
                raise HTTPException(status_code=404, detail=f"El producto con id {item.idProducto} fue eliminado del sistema.")
            if producto.stock < item.cantidad:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para '{producto.nombre_producto}'. Disponible: {producto.stock}."
                )

            if producto.requierePrescripcion:
                productos_con_receta.append(producto)

            subtotal = producto.precio * item.cantidad
            total += subtotal
            productos_reservados.append((producto, item.cantidad, subtotal))
            detalles.append(DetalleVenta(
                idProducto=producto.idProducto,
                cantidad=item.cantidad,
                precioUnitario=producto.precio,
                subtotal=subtotal,
            ))

        historial = None
        if productos_con_receta:
            historial = self._validar_prescripcion(data, productos_con_receta)

        # Ahora sí se descuenta stock.
        for producto, cantidad, _ in productos_reservados:
            producto.stock -= cantidad

        db_venta = Venta(
            idUsuario=data.idUsuario,
            total=total,
            estado="pendiente",
            idHistorial=historial.idHistorial if historial else None,
        )
        db_venta.detalles = detalles
        self.db.add(db_venta)

        if historial:
            historial.prescripcionUsada = True

        try:
            self.db.commit()
            self.db.refresh(db_venta)
        except Exception:
            self.db.rollback()
            raise

        return self.get_by_id(db_venta.idVenta)

    def update(self, id: int, data: VentaUpdate):
        """RQF-41: admin actualiza el estado de una venta."""
        db_venta = self.get_by_id(id)
        update_data = data.model_dump(exclude_unset=True)
        if "estado" in update_data:
            estado = update_data["estado"]
            if estado not in {"pendiente", "pagada", "cancelada"}:
                raise HTTPException(status_code=400, detail="Estado de venta no válido.")
            if db_venta.estado == "cancelada" and estado != "cancelada":
                raise HTTPException(status_code=400, detail="Una venta cancelada no puede reabrirse.")
        for key, value in update_data.items():
            setattr(db_venta, key, value)
        self.db.commit()
        self.db.refresh(db_venta)
        return self.get_by_id(id)

    def cancelar(self, id: int):
        db_venta = self.get_by_id(id)
        if db_venta.estado == "cancelada":
            raise HTTPException(status_code=400, detail="La venta ya esta cancelada.")
        for d in db_venta.detalles:
            producto = self.db.query(Product).filter(Product.idProducto == d.idProducto).first()
            if producto:
                producto.stock += d.cantidad

        if db_venta.idHistorial:
            historial = self.db.query(HistorialClinico).filter(
                HistorialClinico.idHistorial == db_venta.idHistorial
            ).first()
            if historial:
                # Libera la prescripción: al cancelarse la venta, vuelve
                # a estar disponible para generar una nueva venta.
                historial.prescripcionUsada = False

        db_venta.estado = "cancelada"
        self.db.commit()
        return True