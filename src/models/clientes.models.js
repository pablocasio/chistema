import mongoose from "mongoose";

const clienteSchema = new mongoose.Schema({
  tipo_doc: {
    type: String,
    enum: ["DNI", "RUC", "CE", "PASAPORTE"],
    required: true,
  },
  numero_doc: {
    type: String,
    required: true,
    unique: true,
    maxlength: 20,
  },
  nombre: {
    type: String,
    required: true,
    maxlength: 100,
  },
  apellido_paterno: {
    type: String,
    required: true,
    maxlength: 100,
  },
  apellido_materno: {
    type: String,
    required: true,
    maxlength: 100,
  },
  cod_verif: {
    type: String,
    maxlength: 5,
    default: "",
  },
  direccion: {
    type: String,
    maxlength: 200,
    default: "",
  },
  telefono: {
    type: String,
    maxlength: 20,
    default: "",
  },
  correo: {
    type: String,
    required: true,
    maxlength: 100,
    unique: true,
  },
  categoria: {
    type: String,
    default: "Sin categoría",
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

// 📌 Middleware para actualizar `fecha_actualizacion` automáticamente
clienteSchema.pre("save", function (next) {
  this.fecha_actualizacion = Date.now();
  next();
});

export default mongoose.model("Cliente", clienteSchema);
