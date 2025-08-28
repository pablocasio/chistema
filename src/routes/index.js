// src/routes/index.js
import { Router } from "express";
import bcrypt from "bcrypt";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import puppeteer from "puppeteer";
import nodemailer from "nodemailer";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import multer from "multer";

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), "src", "public", "uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const nombre = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, nombre);
  },
});

// Middleware multer
const upload = multer({ storage });
const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

///////////PARTE DEL PERFIL/////////////
// Ruta para ver el perfil
// GET perfil
// GET perfil
router.get("/perfil", (req, res) => {
  if (!req.session.usuario || !req.session.usuario.id) {
    return res.redirect("/login");
  }

  req.getConnection((err, conn) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error de conexión");
    }

    // Obtenemos usuario + perfil adicional
    conn.query(
      "SELECT * FROM usuarios WHERE id = ?",
      [req.session.usuario.id],
      (err, userRows) => {
        if (err) {
          console.error(err);
          return res.status(500).send("Error en la consulta de usuario");
        }

        if (userRows.length === 0) {
          return res.status(404).send("Usuario no encontrado");
        }

        const usuario = userRows[0];

        // Ahora buscamos en la tabla perfiles
        conn.query(
          "SELECT * FROM perfiles WHERE usuario_id = ?",
          [usuario.id],
          (err, perfilRows) => {
            if (err) {
              console.error(err);
              return res.status(500).send("Error en la consulta de perfil");
            }

            const perfil = perfilRows.length > 0 ? perfilRows[0] : null;

            res.render("perfil", { usuario, perfil });
          }
        );
      }
    );
  });
});

/////////////////////////////
//////////////USUARIOS///////////////

// Middleware: Solo admins pueden acceder
function checkAdmin(req, res, next) {
  if (req.session.usuario && req.session.usuario.rol === "admin") {
    return next();
  }
  return res.status(403).send("Acceso denegado");
}

// Vista de usuarios (solo admin)
router.get("/usuarios", checkAdmin, (req, res) => {
  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión");

    conn.query("SELECT * FROM usuarios", (err, usuarios) => {
      if (err) return res.send("Error al obtener usuarios");

      res.render("usuarios", {
        usuarios,
        rol: req.session.usuario?.rol || "",
      });
    });
  });
});

// Activar usuario
router.post("/usuarios/:id/activar", checkAdmin, (req, res) => {
  const id = req.params.id;
  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión");
    conn.query(
      "UPDATE usuarios SET estado = 'activo' WHERE id = ?",
      [id],
      (err) => {
        if (err) return res.send("Error al activar usuario");
        res.redirect("/usuarios");
      }
    );
  });
});

// Desactivar usuario
router.post("/usuarios/:id/desactivar", checkAdmin, (req, res) => {
  const id = req.params.id;
  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión");
    conn.query(
      "UPDATE usuarios SET estado = 'pendiente' WHERE id = ?",
      [id],
      (err) => {
        if (err) return res.send("Error al desactivar usuario");
        res.redirect("/usuarios");
      }
    );
  });
});

// Eliminar usuario
router.post("/usuarios/:id/eliminar", checkAdmin, (req, res) => {
  const id = req.params.id;
  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión");

    conn.query("DELETE FROM usuarios WHERE id = ?", [id], (err) => {
      if (err) return res.send("Error al eliminar usuario");
      res.redirect("/usuarios");
    });
  });
});

/////////////////////////////
// routes/usuarios.js o auth.js
//ESTA TAMBIEN EL REGISTROOOOOOOOO
// GET: Vista login
// Ruta principal: Redirige al login

//////////////////////////////////////////////////////
//////////////////////////////////////////////////////

//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
//ESTA EN LOGIN CRJJJ MRDDDD GAAAAAAAAAAAAAA//
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////

//////////////////////////////////////////////////////

//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
////////////////CLIENTESSSSSSSSS TAMBIEN YA EST//////////////////////////////////////
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////

//paraconsultar a la reniec//
// Reemplaza este token por el tuyo
// Token personal de apis.net.pe
// Token personal de apis.net.pe

////////////////////////////////////////////
// NO necesitas importar mysql2/promise al inicio si usas req.getConnection
// Solo usa req.getConnection con callbacks o con .promise()
//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////
//////////////////////-VENTAS-/////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////--PRODUCTOS--////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////
/////////////////////PROVEEDORES//////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
// Ruta para alternar estado activo/inactivo

///////////////////////////////////////////////
////////////////////REPORTES////////////////////////
// Ejemplo básico usando MySQL con req.getConnection (como en tus otros ejemplos)
// Ruta principal de reportes
///////////////////////////////////////////////
///////////////////////////////////////////////
///////////////////////////////////////////////
///////////////////////////////////////////////
///////////////////////////////////////////////

////////////////////////////////////////////
////////////////////--HISTORIAL INVENTARIO--/////////////////////////
router.get("/inventario/historial", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const { producto_id, tipo, desde, hasta } = req.query;

  let condiciones = [];
  let valores = [];

  if (producto_id) {
    condiciones.push("mi.producto_id = ?");
    valores.push(producto_id);
  }

  if (tipo) {
    condiciones.push("mi.tipo_movimiento = ?");
    valores.push(tipo.trim().toLowerCase()); // ingreso, egreso, ajuste
  }

  if (desde) {
    condiciones.push("mi.fecha_movimiento >= ?");
    valores.push(`${desde} 00:00:00`);
  }

  if (hasta) {
    condiciones.push("mi.fecha_movimiento <= ?");
    valores.push(`${hasta} 23:59:59`);
  }

  const whereClause =
    condiciones.length > 0 ? "WHERE " + condiciones.join(" AND ") : "";

  const sql = `
    SELECT mi.*, 
           p.nombre AS nombre_producto, 
           u.nombre_usuario AS usuario
    FROM movimientos_inventario mi
    JOIN productos p ON mi.producto_id = p.id
    JOIN usuarios u ON mi.usuario_id = u.id
    ${whereClause}
    ORDER BY mi.fecha_movimiento DESC
  `;

  req.getConnection((err, conn) => {
    if (err) {
      console.error("❌ Error de conexión:", err);
      return res.send("Error de conexión a la base de datos.");
    }

    conn.query(sql, valores, (err, movimientosRaw) => {
      if (err) {
        console.error("❌ Error al obtener movimientos:", err);
        return res.send("Error al obtener el historial.");
      }

      // Renombramos 'tipo_movimiento' como 'tipo' para evitar errores en EJS
      const movimientos = movimientosRaw.map((m) => ({
        ...m,
        tipo: m.tipo_movimiento,
      }));

      conn.query(
        "SELECT id, nombre FROM productos ORDER BY nombre",
        (err2, productos) => {
          if (err2) {
            console.error("❌ Error al obtener productos:", err2);
            return res.send("Error al cargar productos.");
          }

          res.render("historialInventario", {
            movimientos,
            productos,
            filtro: {
              producto_id: producto_id || "",
              tipo: tipo || "",
              desde: desde || "",
              hasta: hasta || "",
            },
          });
        }
      );
    });
  });
});
////////////////////////////////////////////
////////////////////////////////////////////

// RUTA PARA VER LA CONFIGURACIÓN
router.get("/configuracion", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  // Si el rol es "cajero", mostrar SweetAlert y redirigir
  if (req.session.usuario.rol === "cajero") {
    req.session.mensajeError =
      "No tienes acceso a Configuración porque eres cajero.";
    return res.redirect("/sin-acceso");
  }

  req.getConnection((err, conn) => {
    if (err) return res.status(500).send("Error de conexión");

    conn.query("SELECT * FROM configuracion LIMIT 1", (err, rows) => {
      if (err) return res.status(500).send("Error al consultar configuración");

      const configuracion = rows[0] || {};
      res.render("configuracion", {
        configuracion,
        mensajeExito: req.session.mensajeExito || null,
        mensajeError: req.session.mensajeError || null,
      });

      req.session.mensajeExito = null;
      req.session.mensajeError = null;
    });
  });
});
router.get("/sin-acceso", (req, res) => {
  res.render("sin-acceso", {
    mensajeError: req.session.mensajeError || "Acceso no permitido",
  });
  req.session.mensajeError = null;
});
router.post("/configuracion/guardar", (req, res) => {
  if (!req.session.usuario || req.session.usuario.rol !== "admin") {
    return res.redirect("/login");
  }

  const {
    nombre_empresa,
    ruc,
    direccion,
    telefono,
    email,
    porcentaje_igv,
    mensaje_pie,
    logo_url,
  } = req.body;

  req.getConnection((err, conn) => {
    if (err) {
      req.session.mensajeError = "Error de conexión a la base de datos";
      return res.redirect("/configuracion");
    }

    const datos = {
      nombre_empresa,
      ruc,
      direccion,
      telefono,
      email,
      porcentaje_igv,
      mensaje_pie,
      logo_url,
    };

    // Verificar si ya hay una fila
    conn.query("SELECT id FROM configuracion LIMIT 1", (err, rows) => {
      if (err) {
        req.session.mensajeError = "Error al leer la configuración";
        return res.redirect("/configuracion");
      }

      if (rows.length > 0) {
        // Si existe, actualizar
        conn.query(
          "UPDATE configuracion SET ? WHERE id = ?",
          [datos, rows[0].id],
          (err) => {
            if (err) {
              req.session.mensajeError = "Error al actualizar datos";
            } else {
              req.session.mensajeExito =
                "Configuración actualizada correctamente";
            }
            return res.redirect("/configuracion");
          }
        );
      } else {
        // Si no existe, insertar nueva fila
        conn.query("INSERT INTO configuracion SET ?", datos, (err) => {
          if (err) {
            req.session.mensajeError = "Error al guardar configuración";
          } else {
            req.session.mensajeExito = "Configuración guardada correctamente";
          }
          return res.redirect("/configuracion");
        });
      }
    });
  });
});

export default router;
