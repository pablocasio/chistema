import express from "express";
import {
  mostrarLogin,
  getLogin,
  Postlogin,
} from "../controllers/Login.controllers.js";

const router = express.Router();

// GET: Vista login
router.get("/", mostrarLogin);
router.get("/login", getLogin);
router.post("/login", Postlogin);

export default router;
