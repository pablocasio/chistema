import express from "express";
import session from "express-session";
import path from "path";

// Rutas
import loginRoutes from "./routes/Login.js";
import Clientes from "./routes/Clientes.js";
import Productos from "./routes/Productos.js";
import Ventas from "./routes/Ventas.js";
import Prove from "./routes/Proveedore.js";
import Reportes from "./routes/Reportes.js";

const app = express();

// Middleware para leer formularios y JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos
app.use(express.static(path.join(process.cwd(), "src", "public")));
app.use(
  "/boletas",
  express.static(path.join(process.cwd(), "src", "public/boletas"))
);

// Configurar sesiones
app.use(
  session({
    secret: "secreto123",
    resave: false,
    saveUninitialized: false,
  })
);

// Configurar motor de vistas EJS
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "src/views"));

// Rutas principales
app.use("/", loginRoutes); // Login y dashboard
app.use("/clientes", Clientes);
app.use("/productos", Productos);
app.use("/ventas", Ventas);
app.use("/proveedores", Prove);
app.use("/reportes", Reportes);

// 🚨 Ruta raíz: redirige al login
app.get("/", (req, res) => {
  res.redirect("/login");
});

// Ruta fallback para cualquier otra no definida
app.use((req, res) => {
  res.status(404).send("❌ Página no encontrada");
});

export default app;
