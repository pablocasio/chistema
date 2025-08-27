import mongoose from "mongoose";
const ventaSchema = new mongoose.Schema({
  cliente_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cliente",
    required: true,
  },
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
  },
  fecha_venta: {
    type: Date,
    default: Date.now,
  },
  tipo_comprobante: {
    type: String,
    enum: ["boleta", "factura", "nota_credito"],
    required: true,
  },
  numero_orden: {
    type: String,
    required: true,
    maxlength: 50,
  },
  subtotal_general: {
    type: Number,
    required: true,
    min: 0,
  },
  impuesto_total: {
    type: Number,
    required: true,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
  forma_pago: {
    type: String,
    enum: ["efectivo", "yape", "tarjeta", "otros"],
    required: true,
  },
  monto_pagado: {
    type: Number,
    required: true,
    min: 0,
  },
  cambio_devuelto: {
    type: Number,
    required: true,
    min: 0,
  },
  estado: {
    type: String,
    enum: ["activo", "anulado"],
    default: "activo",
  },
  codigo_qr: {
    type: String,
    default: "",
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

// Middleware para actualizar fecha_actualizacion automáticamente
ventaSchema.pre("save", function (next) {
  this.fecha_actualizacion = Date.now();
  next();
});

export default mongoose.model("Venta", ventaSchema);
