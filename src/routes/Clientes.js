import express from "express";
import {
  getClientes,
  getRegistrarCliente,
  postRegistrarCliente,
  getExportarClientesPDF,
  getExportarClientesExcel,
  getClientesEliminar,
  getClientesEditar,
  postClientesEditar,
} from "../controllers/Clientes.controllers.js";

const router = express.Router();

router.get("/clientes", getClientes);
router.get("/clientes/registrar", getRegistrarCliente);
router.post("/clientes/registrar", postRegistrarCliente);
router.get("/clientes/exportar/pdf", getExportarClientesPDF);
router.get("/clientes/exportar/excel", getExportarClientesExcel);
router.get("/clientes/eliminar/:id", getClientesEliminar);
router.get("/clientes/editar/:id", getClientesEditar);
router.post("/clientes/editar/:id", postClientesEditar);

export default router;
