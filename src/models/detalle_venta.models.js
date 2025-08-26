const mongoose = require("mongoose");

const detalleVentaSchema = new mongoose.Schema({
  venta_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Venta",
    required: true,
  },
  producto_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Producto",
    required: true,
  },
  nombre_producto: {
    type: String,
    required: true,
    maxlength: 150,
  },
  precio_unitario: {
    type: Number,
    required: true,
    min: 0,
  },
  cantidad: {
    type: Number,
    required: true,
    min: 1,
  },
  subtotal_producto: {
    type: Number,
    required: true,
    min: 0,
  },
  fecha_creacion: {
    type: Date,
    default: Date.now,
  },
  fecha_actualizacion: {
    type: Date,
    default: Date.now,
  },
});

// Middleware para actualizar la fecha_actualizacion automáticamente
detalleVentaSchema.pre("save", function (next) {
  this.fecha_actualizacion = Date.now();
  next();
});

module.exports = mongoose.model("DetalleVenta", detalleVentaSchema);
