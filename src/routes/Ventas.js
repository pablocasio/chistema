import express from "express";
import {
  getVentas,
  getVentasNueva,
  postVentasRegistrar,
  getVentasVerPreboleta,
  getVentasEnviarBoleta,
  getVentasEnviarPDFWhatsApp,
  getVentasEnviarPDFemail,
  postEliminarid,
  getHistorialVentas,
} from "../controllers/Ventas.controllers.js";

const router = express.Router();

// GET: Vista login
router.get("/ventas", getVentas);
router.get("/ventas/nueva", getVentasNueva);
router.post("/ventas/registrar", postVentasRegistrar);
router.get("/ventas/preboleta/:id", getVentasVerPreboleta);
router.get("/ventas/enviar-boleta/:id", getVentasEnviarBoleta);
router.get("/ventas/enviar-pdf-whatsapp/:id", getVentasEnviarPDFWhatsApp);
router.get("/ventas/enviar-pdf-email/:id", getVentasEnviarPDFemail);
router.post("/ventas/eliminar/:id", postEliminarid);
router.get("/ventas/historial", getHistorialVentas);

export default router;
