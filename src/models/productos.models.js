import mongoose from "mongoose";

const productoSchema = new mongoose.Schema({
  categoria_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Categoria",
    required: true,
  },
  proveedor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Proveedor",
  },
  codigo: {
    type: String,
    required: true,
    maxlength: 50,
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
  precio_costo: {
    type: Number,
    min: 0,
  },
  margen_ganancia: {
    type: Number,
    min: 0,
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
  },
  stock_minimo: {
    type: Number,
    min: 0,
  },
  unidad_medida: {
    type: String,
  },
  codigo_barras: {
    type: String,
  },
  imagen: {
    type: String,
  },
  estado: {
    type: String,
    enum: ["activo", "inactivo", "descontinuado"],
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

// Middleware para actualizar fecha_actualizacion automáticamente
productoSchema.pre("save", function (next) {
  this.fecha_actualizacion = Date.now();
  next();
});

export default mongoose.model("Producto", productoSchema);
