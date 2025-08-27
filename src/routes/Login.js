import express from "express";
import {
  mostrarLogin,
  getLogin,
  Postlogin,
  PostRegistro,
  getLogout,
  getDashboard,
  getRegistrar,
} from "../controllers/Login.controllers.js";

const router = express.Router();

// GET: Vista login
router.get("/", mostrarLogin);
router.get("/login", getLogin);
router.post("/login", Postlogin);
//ReGISTRO
router.get("/registrar", getRegistrar);
router.post("/registro", PostRegistro);
router.get("/logout", getLogout);
router.get("/deshboard", getDashboard);

export default router;
