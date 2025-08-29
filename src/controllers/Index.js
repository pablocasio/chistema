import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import Usuario from "../models/usuarios.models.js";
import Producto from "../models/productos.models.js";
import MovimientoInventario from "../models/movimientosInventario.models.js"; // crea este esquema
import Configuracion from "../models/configuracion.models.js"; // crea este esquema

export const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de almacenamiento multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), "src", "public", "uploads"));
  },
  filename: (req, file, cb) => {
    const nombre = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, nombre);
  },
});
export const upload = multer({ storage });

////////////////////////////
// HISTORIAL INVENTARIO
export const getInventarioHistorial = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const { producto_id, tipo, desde, hasta } = req.query;

  // Crear filtro dinámico
  let filtro = {};
  if (producto_id) filtro.producto_id = producto_id;
  if (tipo) filtro.tipo_movimiento = tipo.trim().toLowerCase();
  if (desde || hasta) filtro.fecha_movimiento = {};
  if (desde) filtro.fecha_movimiento.$gte = new Date(`${desde}T00:00:00`);
  if (hasta) filtro.fecha_movimiento.$lte = new Date(`${hasta}T23:59:59`);

  try {
    const movimientos = await MovimientoInventario.find(filtro)
      .populate("producto_id", "nombre") // asumiendo relación con Producto
      .populate("usuario_id", "nombre_usuario") // relación con Usuario
      .sort({ fecha_movimiento: -1 })
      .lean();

    const productos = await Producto.find().sort({ nombre: 1 }).lean();

    // Renombramos tipo_movimiento a tipo
    const movimientosRenombrados = movimientos.map((m) => ({
      ...m,
      tipo: m.tipo_movimiento,
    }));

    res.render("historialInventario", {
      movimientos: movimientosRenombrados,
      productos,
      filtro: {
        producto_id: producto_id || "",
        tipo: tipo || "",
        desde: desde || "",
        hasta: hasta || "",
      },
    });
  } catch (error) {
    console.error(error);
    res.send("Error al obtener el historial.");
  }
};

////////////////////////////
// CONFIGURACION
export const getConfiguracion = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  if (req.session.usuario.rol === "cajero") {
    req.session.mensajeError =
      "No tienes acceso a Configuración porque eres cajero.";
    return res.redirect("/sin-acceso");
  }

  try {
    const configuracion = await Configuracion.findOne().lean();
    res.render("configuracion", {
      configuracion: configuracion || {},
      mensajeExito: req.session.mensajeExito || null,
      mensajeError: req.session.mensajeError || null,
    });

    req.session.mensajeExito = null;
    req.session.mensajeError = null;
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al consultar configuración");
  }
};

export const postConfiguracionGuardar = async (req, res) => {
  if (!req.session.usuario || req.session.usuario.rol !== "admin") {
    return res.redirect("/login");
  }

  const datos = {
    nombre_empresa: req.body.nombre_empresa,
    ruc: req.body.ruc,
    direccion: req.body.direccion,
    telefono: req.body.telefono,
    email: req.body.email,
    porcentaje_igv: req.body.porcentaje_igv,
    mensaje_pie: req.body.mensaje_pie,
    logo_url: req.body.logo_url,
  };

  try {
    let configuracion = await Configuracion.findOne();
    if (configuracion) {
      await Configuracion.updateOne({ _id: configuracion._id }, datos);
      req.session.mensajeExito = "Configuración actualizada correctamente";
    } else {
      await Configuracion.create(datos);
      req.session.mensajeExito = "Configuración guardada correctamente";
    }
    res.redirect("/configuracion");
  } catch (error) {
    console.error(error);
    req.session.mensajeError = "Error al guardar configuración";
    res.redirect("/configuracion");
  }
};

export const getSincacceso = (req, res) => {
  res.render("sin-acceso", {
    mensajeError: req.session.mensajeError || "Acceso no permitido",
  });
  req.session.mensajeError = null;
};

export default router;
