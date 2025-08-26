const mongoose = require("mongoose");

const usuarioSchema = new mongoose.Schema({
  dni: {
    type: String,
    required: true,
    unique: true,
    maxlength: 8,
  },
  nombre_usuario: {
    type: String,
    required: true,
    unique: true,
    maxlength: 50,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    maxlength: 100,
  },
  contrasena_hash: {
    type: String,
    required: true,
    maxlength: 255,
  },
  rol: {
    type: String,
    enum: ["admin", "cajero"],
    default: "cajero",
  },
  intentos_fallidos: {
    type: Number,
    default: 0,
    min: 0,
  },
  bloqueado_hasta: {
    type: Date,
    default: null,
  },
  estado: {
    type: String,
    enum: ["pendiente", "activo", "inactivo"],
    default: "pendiente",
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
usuarioSchema.pre("save", function (next) {
  this.fecha_actualizacion = Date.now();
  next();
});

module.exports = mongoose.model("Usuario", usuarioSchema);
