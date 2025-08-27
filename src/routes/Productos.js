import express from "express";
import {
  getProductos,
  getProductosRegistrar,
  postProductosRegistrar,
  getProductosEgresoID,
  postProductosEgresoID,
  getProductosEditarID,
  postProductosEditarID,
  getProductosEliminarID,
  getProductosExportarExcel,
} from "../controllers/Productos.controllers.js";

const router = express.Router();

// GET: Listar productos
router.get("/productos", getProductos);
router.get("/productos/registrar", getProductosRegistrar);
router.post("/productos/registrar", postProductosRegistrar);
router.get("/productos/egreso/:id", getProductosEgresoID);
router.post("/productos/egreso/:id", postProductosEgresoID);
router.get("/productos/editar/:id", getProductosEditarID);
router.post("/productos/editar/:id", postProductosEditarID);
router.get("/productos/eliminar/:id", getProductosEliminarID);
router.get("/productos/exportar/excel", getProductosExportarExcel);

export default router;
