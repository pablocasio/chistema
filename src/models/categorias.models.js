import mongoose from "mongoose";
const categoriaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    maxlength: 100,
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
categoriaSchema.pre("save", function (next) {
  this.fecha_actualizacion = Date.now();
  next();
});

export default mongoose.model("Categoria", categoriaSchema);
