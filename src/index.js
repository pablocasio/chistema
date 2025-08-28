import express from "express";
import app from "./app.js";
import dontev from "dotenv";
import conectarDB from "./b.js";
conectarDB();
dontev.config(); //carga la variable de entorno
// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
