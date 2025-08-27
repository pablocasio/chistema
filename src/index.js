import express from "express";
import session from "express-session";
import myConnection from "express-myconnection";
import mysql from "mysql2";
import path from "path";
import routes from "./routes/index.js";
import loginRoutes from "./routes/Login.js";

const app = express();

// Middleware para leer formularios y JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos
app.use(express.static(path.join(process.cwd(), "src", "public")));
app.use(
  "/boletas",
  express.static(path.join(process.cwd(), "src", "public", "boletas"))
);

// Configurar sesiones
app.use(
  session({
    secret: "secreto123", // 🔒 Cambia esto en producción por una variable de entorno
    resave: false,
    saveUninitialized: false,
  })
);

// Conexión a MySQL
app.use(
  myConnection(
    mysql,
    {
      host: "localhost",
      user: "root",
      password: "tu_contraseña", // 🔐 Reemplaza con tu contraseña real o usa dotenv
      database: "sistema_ventas",
    },
    "single"
  )
);

// Configurar motor de vistas EJS
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "src", "views"));

// Usar las rutas
app.use("/", loginRoutes);
app.use("/", routes);

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
