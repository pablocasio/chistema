const mongoose = require("mongoose");

const loteProductoSchema = new mongoose.Schema({
  producto_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Producto",
    required: true,
  },
  codigo_lote: {
    type: String,
    required: true,
    maxlength: 50,
  },
  fecha_vencimiento: {
    type: Date,
    required: true,
  },
  cantidad: {
    type: Number,
    required: true,
    min: 0,
  },
  fecha_registro: {
    type: Date,
    default: Date.now,
  },
});

// Middleware para actualizar la fecha_registro si es necesario
loteProductoSchema.pre("save", function (next) {
  if (!this.fecha_registro) {
    this.fecha_registro = Date.now();
  }
  next();
});

module.exports = mongoose.model("LoteProducto", loteProductoSchema);
