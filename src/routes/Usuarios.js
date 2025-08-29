import express from "express";
import {
  getPerfil,
  checkAdmin,
  getAdmin,
  postUsuariosIdActivar,
  postUsuariosIdDesactivar,
  postUsuariosIdEliminar,
} from "../controllers/Usuarios.controllers.js";

const router = express.Router();

router.get("/perfil", getPerfil);
router.get("/admin", checkAdmin, getAdmin);
router.post("/usuarios/:id/activar", checkAdmin, postUsuariosIdActivar);
router.post("/usuarios/:id/desactivar", checkAdmin, postUsuariosIdDesactivar);
router.post("/usuarios/:id/eliminar", checkAdmin, postUsuariosIdEliminar);

export default router;
