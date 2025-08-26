const mongoose = require("mongoose");

const perfilSchema = new mongoose.Schema({
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
  },
  foto_url: {
    type: String,
    default: "",
    maxlength: 255,
  },
  telefono: {
    type: String,
    default: "",
    maxlength: 20,
  },
  direccion: {
    type: String,
    default: "",
    maxlength: 255,
  },
  fecha_nacimiento: {
    type: Date,
  },
  ultimo_login: {
    type: Date,
    default: null,
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
perfilSchema.pre("save", function (next) {
  this.fecha_actualizacion = Date.now();
  next();
});

module.exports = mongoose.model("Perfil", perfilSchema);
