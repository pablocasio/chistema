const mongoose = require("mongoose");

const movimientoInventarioSchema = new mongoose.Schema({
  producto_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Producto",
    required: true,
  },
  tipo: {
    type: String,
    enum: ["entrada", "salida"],
    required: true,
  },
  cantidad: {
    type: Number,
    required: true,
    min: 1,
  },
  detalle: {
    type: String,
    default: "",
  },
  fecha_movimiento: {
    type: Date,
    default: Date.now,
  },
});

// Middleware para actualizar fecha de modificación si se necesita
movimientoInventarioSchema.pre("save", function (next) {
  this.fecha_movimiento = Date.now();
  next();
});

module.exports = mongoose.model(
  "MovimientoInventario",
  movimientoInventarioSchema
);
