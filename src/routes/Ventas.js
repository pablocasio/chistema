import express from "express";
import {
  getVentas,
  getNuevaVenta, // corregido
  postRegistrarVenta, // corregido
  getVerPreboleta, // corregido
  getEnviarBoletaID, // corregido
  getVentasEnviarPDFWhatsApp,
  getEnviarPDFemail, // corregido
  postVentasEliminarID, // corregido
  getHistorialVentas,
} from "../controllers/Ventas.controllers.js";

const router = express.Router();

// GET: Vista ventas
router.get("/ventas", getVentas);
router.get("/ventas/nueva", getNuevaVenta);
router.post("/ventas/registrar", postRegistrarVenta);
router.get("/ventas/verPreboleta/:id", getVerPreboleta);
router.get("/ventas/enviarBoleta/:id", getEnviarBoletaID);
router.get("//ventas/enviarPdfWhatsApp/:id", getVentasEnviarPDFWhatsApp);
router.get("/ventas/enviarPdfEmail/:id", getEnviarPDFemail);
router.post("/ventas/eliminar/:id", postVentasEliminarID);
router.get("//historial-ventas", getHistorialVentas);

export default router;
