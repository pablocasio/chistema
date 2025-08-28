import express from "express";
import {
  getProveedores,
  getProveedoresRegistrar,
  postProveedoresGuardar,
  getProveedoresEditar,
  postProveedoresActualizarId,
  getProveedoresEliminarFisicoID,
  getProveedoresEliminarID,
} from "../controllers/Proveedores.Controllers.js";

const router = express.Router();

router.get("/proveedores", getProveedores);
router.get("/proveedores/registrar", getProveedoresRegistrar);
router.post("/proveedores/guardar", postProveedoresGuardar);
router.get("/proveedores/editar/:id", getProveedoresEditar);
router.post("/proveedores/actualizar/:id", postProveedoresActualizarId);
router.get("/proveedores/eliminar-fisico/:id", getProveedoresEliminarFisicoID);
router.get("/proveedores/eliminar/:id", getProveedoresEliminarID);

export default router;
