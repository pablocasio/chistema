import express from "express";
import dotenv from "dotenv";
import app from "./app.js";

import conectarDB from "./b.js";
dotenv.config();
conectarDB();

const PORT = process.env.PORT || 8000; // 👈 forzamos 8000 si no hay PORT
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
