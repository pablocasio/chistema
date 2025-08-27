import mongoose from "mongoose";
const clienteSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    maxlength: 100,
  },
  apellido: {
    type: String,
    required: true,
    maxlength: 100,
  },
  email: {
    type: String,
    required: true,
    maxlength: 100,
    unique: true,
  },
  telefono: {
    type: String,
    maxlength: 20,
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
clienteSchema.pre("save", function (next) {
  this.fecha_actualizacion = Date.now();
  next();
});
export default mongoose.model("Cliente", clienteSchema);
