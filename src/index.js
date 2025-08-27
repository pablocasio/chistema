import express from "express";
import app from "./app.js";
import conectarDB from "./b.js";
conectarDB();
// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
