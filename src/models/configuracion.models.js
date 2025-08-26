const mongoose = require("mongoose");

const configuracionSchema = new mongoose.Schema({
  clave: {
    type: String,
    required: true,
    unique: true,
    maxlength: 100,
  },
  valor: {
    type: String,
    required: true,
    default: "",
  },
  descripcion: {
    type: String,
    default: "",
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
configuracionSchema.pre("save", function (next) {
  this.fecha_actualizacion = Date.now();
  next();
});

module.exports = mongoose.model("Configuracion", configuracionSchema);
