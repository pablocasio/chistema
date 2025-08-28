import express from "express";
import {
  getReportes,
  getReportesVentas,
  getReportesProductos,
  getReportesProveedores,
  getReportesVentasExportarExcel,
  getReportesVentasExportarPDF,
} from "../controllers/Reportes.controllers.js";

const router = express.Router();

router.get("/reportes", getReportes);
router.get("/reportes/ventas", getReportesVentas);
router.get("/reportes/productos", getReportesProductos);
router.get("/reportes/proveedores", getReportesProveedores);
router.get("/reportes/ventas/exportar/excel", getReportesVentasExportarExcel);
router.get("/reportes/ventas/exportar/pdf", getReportesVentasExportarPDF);
export default router;
