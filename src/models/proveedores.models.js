import mongoose from "mongoose";
const proveedorSchema = new mongoose.Schema({
  ruc: {
    type: String,
    required: true,
    unique: true,
    maxlength: 11,
  },
  razon_social: {
    type: String,
    required: true,
    maxlength: 150,
  },
  contacto: {
    type: String,
    default: "",
    maxlength: 100,
  },
  telefono: {
    type: String,
    default: "",
    maxlength: 20,
  },
  correo_electronico: {
    type: String,
    default: "",
    maxlength: 100,
  },
  direccion: {
    type: String,
    default: "",
    maxlength: 150,
  },
  tipo_productos: {
    type: String,
    default: "",
    maxlength: 150,
  },
  estado: {
    type: String,
    enum: ["activo", "inactivo"],
    default: "activo",
  },
  fecha_registro: {
    type: Date,
    default: Date.now,
  },
});

// Middleware para actualizar fecha_registro si se requiere
proveedorSchema.pre("save", function (next) {
  if (!this.fecha_registro) {
    this.fecha_registro = Date.now();
  }
  next();
});

export default mongoose.model("Proveedor", proveedorSchema);
