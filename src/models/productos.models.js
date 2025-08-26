const mongoose = require("mongoose");

const productoSchema = new mongoose.Schema({
  categoria_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Categoria",
    required: true,
  },
  nombre: {
    type: String,
    required: true,
    maxlength: 150,
  },
  descripcion: {
    type: String,
    default: "",
  },
  precio: {
    type: Number,
    required: true,
    min: 0,
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
  },
  estado: {
    type: String,
    enum: ["activo", "inactivo"],
    default: "activo",
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
productoSchema.pre("save", function (next) {
  this.fecha_actualizacion = Date.now();
  next();
});

module.exports = mongoose.model("Producto", productoSchema);
