import express from "express";
import {
  router,
  upload,
  getInventarioHistorial,
  getConfiguracion,
  postConfiguracionGuardar,
  getSincacceso,
} from "../controllers/Index.js";

const router = express.Router();

router.get("/inventario/historial", getInventarioHistorial);
router.get("/configuracion", getConfiguracion);
router.post("/configuracion/guardar", postConfiguracionGuardar);
router.get("/sin-acceso", getSincacceso);

export default router;
