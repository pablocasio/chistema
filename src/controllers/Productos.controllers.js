// src/controllers/Productos.controllers.js
import Producto from "../models/productos.models.js";
import Categoria from "../models/categorias.models.js";
import Proveedor from "../models/proveedores.models.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import multer from "multer";
// Configuración de multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "src/public/uploads"); // carpeta donde guardar las imágenes
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });
// ---------------- LISTAR PRODUCTOS ----------------
export const getProductos = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  try {
    const {
      codigo,
      nombre,
      categoria,
      stock,
      precio,
      proveedor,
      stock_critico,
    } = req.query;
    const filtros = { estado: { $ne: "inactivo" } };

    if (codigo) filtros.codigo = new RegExp(codigo, "i");
    if (nombre) filtros.nombre = new RegExp(nombre, "i");
    if (categoria) filtros.categoria_id = categoria;
    if (stock_critico) filtros.stock = { $lte: 10 };
    else if (stock) filtros.stock = { $gte: Number(stock) };
    if (precio) filtros.precio = { $lte: Number(precio) };
    if (proveedor) filtros.proveedor_id = proveedor;

    const productos = await Producto.find(filtros)
      .populate("categoria_id", "nombre")
      .populate("proveedor_id", "razon_social")
      .sort({ fecha_creacion: -1 });

    res.render("productos", { productos });
  } catch (error) {
    console.error("❌ Error al listar productos:", error);
    res.send("Error al cargar productos.");
  }
};

// ---------------- FORMULARIO REGISTRAR ----------------
export const getProductosRegistrar = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  try {
    const categorias = await Categoria.find().sort({ nombre: 1 });
    const proveedores = await Proveedor.find().sort({ razon_social: 1 });

    res.render("registrarProductos", {
      categorias,
      proveedores,
      productos: [],
    });
  } catch (error) {
    console.error("❌ Error cargando registrar producto:", error);
    res.send("Error al cargar categorías/proveedores.");
  }
};

// ---------------- REGISTRAR PRODUCTO ----------------
export const postProductosRegistrar = async (req, res) => {
  if (!req.body) return res.status(400).send("No hay datos del formulario");

  try {
    const {
      codigo,
      nombre,
      descripcion,
      categoria_id,
      precio,
      precio_costo,
      margen_ganancia,
      stock,
      stock_minimo,
      proveedor_id,
      unidad_medida,
      estado,
      codigo_barras,
    } = req.body;

    const nuevaImagen = req.file ? req.file.filename : null;

    const nuevoProducto = new Producto({
      codigo,
      nombre,
      descripcion,
      categoria_id,
      precio,
      precio_costo,
      margen_ganancia,
      stock,
      stock_minimo,
      proveedor_id,
      unidad_medida,
      estado: estado || "activo",
      codigo_barras,
      imagen: nuevaImagen,
    });

    await nuevoProducto.save();

    console.log("✅ Producto registrado:", nuevoProducto._id);
    res.redirect("/productos");
  } catch (error) {
    console.error("❌ Error al registrar producto:", error);
    res.send("Error al guardar producto.");
  }
};

// ---------------- EGRESO ----------------
export const getProductosEgresoID = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.send("❌ Producto no encontrado");
    res.render("egresoProducto", { producto });
  } catch (error) {
    res.send("❌ Error al cargar producto");
  }
};

export const postProductosEgresoID = async (req, res) => {
  try {
    const { cantidad, motivo } = req.body;
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.send("❌ Producto no encontrado");

    const cantidadEgreso = parseInt(cantidad);
    if (producto.stock < cantidadEgreso)
      return res.send("❌ Stock insuficiente");

    producto.stock -= cantidadEgreso;
    await producto.save();

    console.log("✅ Egreso registrado:", motivo || "Egreso manual");
    res.redirect("/productos");
  } catch (error) {
    console.error("❌ Error en egreso:", error);
    res.send("Error al registrar egreso");
  }
};

// ---------------- EDITAR ----------------
export const getProductosEditarID = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.send("Producto no encontrado");

    const categorias = await Categoria.find();
    const proveedores = await Proveedor.find();

    res.render("editarProductos", { producto, categorias, proveedores });
  } catch (error) {
    res.send("Error cargando edición de producto.");
  }
};

export const postProductosEditarID = async (req, res) => {
  try {
    const datos = { ...req.body };
    if (req.file) datos.imagen = req.file.filename;
    datos.fecha_actualizacion = new Date();

    await Producto.findByIdAndUpdate(req.params.id, datos);
    res.redirect("/productos");
  } catch (error) {
    res.send("Error al actualizar producto.");
  }
};

// ---------------- ELIMINAR ----------------
export const getProductosEliminarID = async (req, res) => {
  try {
    await Producto.findByIdAndUpdate(req.params.id, { estado: "inactivo" });
    res.redirect("/productos");
  } catch (error) {
    res.send("Error al desactivar producto.");
  }
};

// ---------------- EXPORTAR EXCEL ----------------
export const getProductosExportarExcel = async (req, res) => {
  try {
    const productos = await Producto.find({ estado: { $ne: "inactivo" } })
      .populate("categoria_id", "nombre")
      .populate("proveedor_id", "razon_social");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Productos");

    worksheet.columns = [
      { header: "Código", key: "codigo", width: 15 },
      { header: "Nombre", key: "nombre", width: 25 },
      { header: "Descripción", key: "descripcion", width: 30 },
      { header: "Categoría", key: "categoria", width: 20 },
      { header: "Precio", key: "precio", width: 15 },
      { header: "Stock", key: "stock", width: 10 },
      { header: "Estado", key: "estado", width: 10 },
      { header: "Proveedor", key: "proveedor", width: 25 },
    ];

    productos.forEach((p) =>
      worksheet.addRow({
        codigo: p.codigo,
        nombre: p.nombre,
        descripcion: p.descripcion,
        categoria: p.categoria_id?.nombre,
        precio: p.precio,
        stock: p.stock,
        estado: p.estado,
        proveedor: p.proveedor_id?.razon_social,
      })
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=productos.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.send("Error al exportar productos a Excel.");
  }
};

// ---------------- EXPORTAR PDF ----------------
export const getProductosExportarPDF = async (req, res) => {
  try {
    const productos = await Producto.find({ estado: { $ne: "inactivo" } })
      .populate("categoria_id", "nombre")
      .populate("proveedor_id", "razon_social");

    const doc = new PDFDocument({ size: "A4", margin: 30 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=productos.pdf");

    doc.pipe(res);
    doc.fontSize(18).text("Productos", { align: "center" }).moveDown();

    productos.forEach((p) => {
      doc
        .fontSize(12)
        .text(`Código: ${p.codigo}`)
        .text(`Nombre: ${p.nombre}`)
        .text(`Descripción: ${p.descripcion || "N/A"}`)
        .text(`Categoría: ${p.categoria_id?.nombre || "N/A"}`)
        .text(`Precio: S/ ${p.precio}`)
        .text(`Stock: ${p.stock}`)
        .text(`Estado: ${p.estado}`)
        .text(`Proveedor: ${p.proveedor_id?.razon_social || "N/A"}`)
        .moveDown();
    });

    doc.end();
  } catch (error) {
    res.send("Error al exportar productos a PDF.");
  }
};
