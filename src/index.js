import express from "express";
import app from "./app.js";
import dotenv from "dotenv";
import conectarDB from "./b.js";

// Cargar variables de entorno antes de usarlas
dotenv.config();

// Conectar a la BD
conectarDB();

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
