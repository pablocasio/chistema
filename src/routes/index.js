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
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error al cerrar sesión:", err);
      return res.status(500).send("Error al cerrar sesión");
    }
    res.redirect("/login"); // Redirige a la ruta que muestra login.ejs
  });
});

// GET: Vista dashboard (protegida)
router.get("/deshboard", (req, res) => {
  if (!req.session.usuario) {
    return res.redirect("/login");
  }

  res.render("deshboard", {
    nombreUsuario: req.session.usuario.nombre,
    rol: req.session.usuario.rol,
    mensajeError: req.session.mensajeError || null,
    mensajeExito: req.session.mensajeExito || null,
  });

  // Limpiar mensajes para que no se repitan
  req.session.mensajeError = null;
  req.session.mensajeExito = null;
});

// Mostrar formulario de registro
router.get("/registrar", (req, res) => {
  const mensajeError = req.session.mensajeError || null;
  const mensajeExito = req.session.mensajeExito || null;
  req.session.mensajeError = null;
  req.session.mensajeExito = null;
  res.render("registrar", { mensajeError, mensajeExito });
});

router.post("/registro", async (req, res) => {
  console.log("Datos recibidos:", req.body);

  const { dni, nombre_usuario, email, contrasena } = req.body;

  if (!dni || !nombre_usuario || !email || !contrasena) {
    req.session.mensajeError = "Todos los campos son obligatorios.";
    return res.redirect("/registrar");
  }

  req.getConnection(async (err, connection) => {
    if (err) {
      console.error("Error de conexión:", err);
      req.session.mensajeError = "Error de conexión a la base de datos.";
      return res.redirect("/registrar");
    }

    connection.query(
      "SELECT * FROM usuarios WHERE email = ? OR dni = ?",
      [email, dni],
      async (err, results) => {
        if (err) {
          console.error("Error en consulta:", err);
          req.session.mensajeError = "Error al consultar usuario.";
          return res.redirect("/registrar");
        }

        if (results.length > 0) {
          req.session.mensajeError = "El correo o DNI ya están registrados.";
          return res.redirect("/registrar");
        }

        try {
          const contrasena_hash = await bcrypt.hash(contrasena, 10);
          const rol = "cajero";
          const estado = "pendiente"; // Usuario pendiente de aprobación

          connection.query(
            "INSERT INTO usuarios (dni, nombre_usuario, email, contrasena_hash, rol, estado) VALUES (?, ?, ?, ?, ?, ?)",
            [dni, nombre_usuario, email, contrasena_hash, rol, estado],
            async (err) => {
              if (err) {
                console.error("Error al insertar:", err);
                req.session.mensajeError = "Error al registrar el usuario.";
                return res.redirect("/registrar");
              }

              // Enviar correo al administrador
              const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                  user: "albinopablocasio@gmail.com",
                  pass: "pqcb nvxf heom ksdu", // ← reemplaza por tu clave de aplicación de Gmail
                },
              });

              await transporter.sendMail({
                from: '"Sistema de Ventas" <albinopablocasio@gmail.com>',
                to: "albinopablocasio@gmail.com",
                subject: "📥 Nuevo registro de usuario en espera de aprobación",
                html: `
                  <h2>Nuevo usuario registrado</h2>
                  <p><strong>DNI:</strong> ${dni}</p>
                  <p><strong>Nombre:</strong> ${nombre_usuario}</p>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Rol:</strong> ${rol}</p>
                  <p>Aprueba este usuario desde la base de datos o tu panel de administración.</p>
                `,
              });

              console.log("✅ Usuario registrado y notificado al admin.");
              req.session.mensajeExito =
                "Registro exitoso. Espera aprobación del administrador.";
              return res.redirect("/login?registro=pending");
            }
          );
        } catch (error) {
          console.error("Error al hashear contraseña:", error);
          req.session.mensajeError = "Error interno del servidor.";
          return res.redirect("/registrar");
        }
      }
    );
  });
});
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

router.get("/clientes", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  req.getConnection((err, conn) => {
    if (err) {
      console.error("Error DB:", err);
      return res.send("Error de conexión a la base de datos.");
    }

    conn.query("SELECT * FROM clientes", (err, clientes) => {
      if (err) {
        console.error("Error al obtener clientes:", err);
        return res.send("Error al obtener los datos.");
      }

      res.render("clientes", { clientes });
    });
  });
});

router.get("/clientes/registrar", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  res.render("registrarCliente", {
    mensajeError: req.session.mensajeError || null,
    mensajeExito: req.session.mensajeExito || null,
  });

  req.session.mensajeError = null;
  req.session.mensajeExito = null;
});

router.post("/clientes/registrar", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const {
    tipo_documento,
    numero_documento,
    nombres,
    apellido_paterno,
    apellido_materno,
    codigo_verificacion,
    direccion,
    telefono,
    email,
  } = req.body;

  // Validación de campos obligatorios
  if (
    !tipo_documento ||
    !numero_documento ||
    !nombres ||
    !apellido_paterno ||
    !apellido_materno
  ) {
    req.session.mensajeError = "Por favor, completa los campos obligatorios.";
    return res.redirect("/clientes/registrar");
  }

  req.getConnection((err, conn) => {
    if (err) {
      console.error("Error de conexión:", err);
      req.session.mensajeError = "Error de conexión a la base de datos.";
      return res.redirect("/clientes/registrar");
    }

    const nuevoCliente = {
      tipo_documento: String(tipo_documento || "").trim(),
      documento: String(numero_documento || "").trim(),
      nombres: String(nombres || "").trim(),
      apellido_paterno: String(apellido_paterno || "").trim(),
      apellido_materno: String(apellido_materno || "").trim(),
      codigo_verificacion: String(codigo_verificacion || "").trim(),
      direccion: String(direccion || "").trim(),
      telefono: String(telefono || "").trim(),
      email: String(email || "").trim(),
      fecha_registro: new Date(),
    };

    console.log("Cliente a insertar:", nuevoCliente);

    conn.query("INSERT INTO clientes SET ?", nuevoCliente, (err, result) => {
      if (err) {
        console.error("Error al registrar cliente:", err);
        req.session.mensajeError = "Error al registrar el cliente.";
        return res.redirect("/clientes/registrar");
      }

      // ✅ Guardamos el ID del cliente registrado en sesión
      req.session.clienteSeleccionadoId = result.insertId;
      req.session.mensajeExito =
        "Cliente registrado y seleccionado exitosamente.";

      // ✅ Redirigimos a la venta nueva
      res.redirect("/ventas/nueva");
    });
  });
});
router.get("/clientes/exportar/pdf", (req, res) => {
  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión");

    conn.query("SELECT * FROM clientes", (err, clientes) => {
      if (err) return res.send("Error al obtener clientes");

      const doc = new PDFDocument({ margin: 30, size: "A4" });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=clientes.pdf");

      doc.pipe(res);

      doc.fontSize(16).text("Listado de Clientes", { align: "center" });
      doc.moveDown();

      clientes.forEach((c, i) => {
        doc
          .fontSize(10)
          .text(
            `${i + 1}. ${c.nombres} ${c.apellido_paterno} ${
              c.apellido_materno
            } | ${c.documento} | ${c.telefono} | ${c.email} | Categoría: ${
              c.categoria || "Sin categoría"
            }`
          );
        doc.moveDown(0.5);
      });

      doc.end();
    });
  });
});
router.get("/clientes/exportar/excel", (req, res) => {
  req.getConnection(async (err, conn) => {
    if (err) return res.send("Error de conexión");

    conn.query("SELECT * FROM clientes", async (err, clientes) => {
      if (err) return res.send("Error al obtener datos");

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Clientes");

      sheet.columns = [
        { header: "ID", key: "id" },
        { header: "Tipo Doc", key: "tipo_documento" },
        { header: "Documento", key: "documento" },
        { header: "Nombres", key: "nombres" },
        { header: "Apellido Paterno", key: "apellido_paterno" },
        { header: "Apellido Materno", key: "apellido_materno" },
        { header: "Cod. Verif.", key: "codigo_verificacion" },
        { header: "Dirección", key: "direccion" },
        { header: "Teléfono", key: "telefono" },
        { header: "Correo", key: "email" },
        { header: "Categoría", key: "categoria" },
      ];

      sheet.addRows(clientes);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=clientes.xlsx"
      );

      await workbook.xlsx.write(res);
      res.end();
    });
  });
});
router.get("/clientes/eliminar/:id", (req, res) => {
  const id = req.params.id;

  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión.");

    conn.query("DELETE FROM clientes WHERE id = ?", [id], (err) => {
      if (err) {
        console.error("Error al eliminar cliente:", err);
        return res.send("No se pudo eliminar el cliente.");
      }

      res.redirect("/clientes");
    });
  });
});

router.get("/clientes/editar/:id", (req, res) => {
  const id = req.params.id;

  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión a la base de datos.");

    conn.query("SELECT * FROM clientes WHERE id = ?", [id], (err, results) => {
      if (err || results.length === 0) {
        return res.send("Cliente no encontrado.");
      }

      const cliente = results[0];
      res.render("editarCliente", { cliente });
    });
  });
});
router.post("/clientes/editar/:id", (req, res) => {
  const id = req.params.id;

  const datosActualizados = {
    tipo_documento: req.body.tipo_documento,
    documento: req.body.documento,
    nombres: req.body.nombres,
    apellido_paterno: req.body.apellido_paterno,
    apellido_materno: req.body.apellido_materno,
    codigo_verificacion: req.body.codigo_verificacion,
    direccion: req.body.direccion,
    telefono: req.body.telefono,
    email: req.body.email,
    categoria: req.body.categoria,
  };

  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión.");

    conn.query(
      "UPDATE clientes SET ? WHERE id = ?",
      [datosActualizados, id],
      (err) => {
        if (err) {
          console.error("Error al actualizar cliente:", err);
          return res.send("Error al guardar los cambios.");
        }

        res.redirect("/clientes");
      }
    );
  });
});

//paraconsultar a la reniec//
// Reemplaza este token por el tuyo
// Token personal de apis.net.pe
// Token personal de apis.net.pe

const API_TOKEN = "apis-token-16433.g8U1oX2tVqcR8thWFNGJa7rqUJXj8oo2";

// Consulta a la API de RENIEC
router.post("/clientes/reniec", async (req, res) => {
  const { numero } = req.body;

  if (!numero || numero.length !== 8) {
    return res.status(400).json({ success: false, message: "DNI inválido." });
  }

  try {
    const response = await axios.get(
      `https://api.apis.net.pe/v1/dni?numero=${numero}`,
      {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          Accept: "application/json",
        },
      }
    );

    const data = response.data;

    if (!data || !data.numeroDocumento) {
      return res
        .status(404)
        .json({ success: false, message: "DNI no encontrado." });
    }

    // Enviar datos separados al frontend
    res.json({
      success: true,
      datos: {
        numero_documento: data.numeroDocumento,
        nombres: data.nombres,
        apellido_paterno: data.apellidoPaterno,
        apellido_materno: data.apellidoMaterno,
        codigo_verificacion: data.digitoVerificador || "",
      },
    });
  } catch (error) {
    console.error("Error al consultar apis.net.pe:", error.message);
    res.status(500).json({
      success: false,
      message: "Error al consultar RENIEC en apis.net.pe.",
    });
  }
});

// Validar existencia de cliente en la base de datos
router.post("/clientes/validar-existencia", (req, res) => {
  const { numero } = req.body;

  req.getConnection((err, conn) => {
    if (err)
      return res
        .status(500)
        .json({ success: false, error: "Error de conexión" });

    const query = "SELECT * FROM clientes WHERE documento = ? LIMIT 1";
    conn.query(query, [numero], (err, results) => {
      if (err)
        return res
          .status(500)
          .json({ success: false, error: "Error en la consulta" });

      if (results.length > 0) {
        const cliente = results[0];
        res.json({
          success: true,
          cliente: {
            nombres: cliente.nombres,
            apellido_paterno: cliente.apellido_paterno,
            apellido_materno: cliente.apellido_materno,
            numero_documento: cliente.documento, // Cambié aquí para enviar el campo correcto
            codigo_verificacion: cliente.codigo_verificacion || "",
          },
        });
      } else {
        res.json({ success: false });
      }
    });
  });
});

// Buscar clientes (GET)

router.get("/clientes/buscar", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const q = req.query.q ? req.query.q.trim() : "";

  req.getConnection((err, conn) => {
    if (err) {
      console.error("Error DB:", err);
      return res.send("Error de conexión a la base de datos.");
    }

    let sql;
    let values;

    if (q === "") {
      sql = `SELECT * FROM clientes ORDER BY fecha_registro DESC LIMIT 20`;
      values = [];
    } else {
      sql = `
        SELECT * FROM clientes
        WHERE nombres LIKE ? OR documento LIKE ?
        ORDER BY fecha_registro DESC
        LIMIT 20
      `;
      values = [`%${q}%`, `%${q}%`];
    }

    conn.query(sql, values, (err, clientes) => {
      if (err) {
        console.error("Error al buscar clientes:", err);
        return res.send("Error al realizar la búsqueda.");
      }

      res.render("clientes", {
        clientes,
        mensajeError:
          clientes.length === 0 ? "No se encontraron resultados." : null,
        mensajeExito: null,
        q,
      });
    });
  });
});

////////////////////////////////////////////
// NO necesitas importar mysql2/promise al inicio si usas req.getConnection
// Solo usa req.getConnection con callbacks o con .promise()

/////////////////////////////////////////////
//////////////////////-VENTAS-/////////////////////////

router.get("/ventas", async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const clienteSeleccionado = req.query.cliente_id || null;

  try {
    // Obtener conexión con promesas
    const conn = await new Promise((resolve, reject) => {
      req.getConnection((err, conn) => {
        if (err) reject(err);
        else resolve(conn);
      });
    });

    const connection = conn.promise();

    // Obtener lista de clientes
    const [clientes] = await connection.query(
      "SELECT id, nombres, documento FROM clientes ORDER BY nombres ASC"
    );

    // Obtener productos con stock > 0
    const [productos] = await connection.query(
      "SELECT id, nombre, precio, stock FROM productos WHERE stock > 0 ORDER BY nombre ASC"
    );

    // Obtener el último ID de venta
    const [[ultimaVenta]] = await connection.query(
      "SELECT MAX(id) AS ultimoId FROM ventas"
    );

    const nuevoNumero = ultimaVenta.ultimoId ? ultimaVenta.ultimoId + 1 : 1;
    const numeroOrden = `ORD-${String(nuevoNumero).padStart(5, "0")}`;

    // Renderizar la vista
    res.render("ventas", {
      clientes,
      productos,
      clienteSeleccionado,
      numeroOrden, // ← enviado a EJS
      mensajeError: req.session.mensajeError || null,
      mensajeExito: req.session.mensajeExito || null,
    });

    // Limpiar mensajes de sesión
    req.session.mensajeError = null;
    req.session.mensajeExito = null;
  } catch (error) {
    console.error("Error en la ruta /ventas:", error);
    res.status(500).send("Error interno del servidor");
  }
});

// Ruta para mostrar el formulario de nueva venta
router.get("/ventas/nueva", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  // ✅ Prioriza el cliente recién registrado si existe en sesión
  const clienteSeleccionado =
    req.session.clienteSeleccionadoId || req.query.cliente_id || null;
  delete req.session.clienteSeleccionadoId; // Limpia después de usarlo

  req.getConnection((err, conn) => {
    if (err) {
      console.error("Error DB:", err);
      return res.send("Error de conexión a la base de datos.");
    }

    conn.query(
      "SELECT id, nombres, documento FROM clientes ORDER BY nombres ASC",
      (err, clientes) => {
        if (err) {
          console.error("Error al obtener clientes:", err);
          return res.send("Error al obtener clientes.");
        }

        conn.query(
          "SELECT id, nombre, precio, stock FROM productos WHERE stock > 0 ORDER BY nombre ASC",
          (err, productos) => {
            if (err) {
              console.error("Error al obtener productos:", err);
              return res.send("Error al obtener productos.");
            }

            res.render("ventas", {
              clientes,
              productos,
              clienteSeleccionado,
              mensajeError: req.session.mensajeError || null,
              mensajeExito: req.session.mensajeExito || null,
            });

            req.session.mensajeError = null;
            req.session.mensajeExito = null;
          }
        );
      }
    );
  });
});
////AQUI ESTA LA CATEGORIZACION DE CLIENTE///
router.post("/ventas/registrar", async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const {
    cliente_id,
    tipo_comprobante,
    numero_orden,
    forma_pago,
    monto_pagado,
    productos,
  } = req.body;

  if (
    !cliente_id ||
    !tipo_comprobante ||
    !forma_pago ||
    !productos ||
    !Array.isArray(productos) ||
    productos.length === 0
  ) {
    req.session.mensajeError =
      "Faltan datos obligatorios o no hay productos en la venta.";
    return res.redirect("/ventas");
  }

  let subtotal_general = 0;
  productos.forEach((p) => {
    p.subtotal_producto = p.precio_unitario * p.cantidad;
    subtotal_general += p.subtotal_producto;
  });

  const impuesto_total = +(subtotal_general * 0.18).toFixed(2);
  const total = +(subtotal_general + impuesto_total).toFixed(2);

  let cambio_devuelto = 0;
  if (monto_pagado) {
    cambio_devuelto = +(monto_pagado - total).toFixed(2);
    if (cambio_devuelto < 0) cambio_devuelto = 0;
  }

  req.getConnection(async (err, conn) => {
    if (err) {
      console.error("Error de conexión:", err);
      req.session.mensajeError = "Error de conexión a la base de datos.";
      return res.redirect("/ventas");
    }

    const connection = conn.promise();

    try {
      await connection.beginTransaction();

      const ventaData = {
        cliente_id,
        usuario_id: req.session.usuario.id,
        tipo_comprobante,
        numero_orden: numero_orden || null,
        subtotal_general,
        impuesto_total,
        total,
        forma_pago,
        monto_pagado: monto_pagado || null,
        cambio_devuelto,
        estado: "activo",
        fecha_venta: new Date(),
        codigo_qr: null,
      };

      const [ventaResult] = await connection.query(
        "INSERT INTO ventas SET ?",
        ventaData
      );

      const ventaId = ventaResult.insertId;

      // Insertar detalle y actualizar stock
      for (const p of productos) {
        const [stockResult] = await connection.query(
          "SELECT stock FROM productos WHERE id = ?",
          [p.producto_id]
        );

        if (stockResult.length === 0)
          throw new Error(`Producto ID ${p.producto_id} no encontrado`);
        if (stockResult[0].stock < p.cantidad)
          throw new Error(
            `Stock insuficiente para el producto ${p.nombre_producto}`
          );

        const detalleData = {
          venta_id: ventaId,
          producto_id: p.producto_id,
          nombre_producto: p.nombre_producto,
          precio_unitario: p.precio_unitario,
          cantidad: p.cantidad,
          subtotal_producto: p.subtotal_producto,
        };

        await connection.query("INSERT INTO detalle_ventas SET ?", detalleData);
        await connection.query(
          "UPDATE productos SET stock = stock - ? WHERE id = ?",
          [p.cantidad, p.producto_id]
        );
      }

      // Actualizar categoría del cliente
      const [comprasCliente] = await connection.query(
        "SELECT COUNT(*) AS totalCompras FROM ventas WHERE cliente_id = ? AND estado = 'activo'",
        [cliente_id]
      );

      const cantidadCompras = comprasCliente[0].totalCompras;

      let nuevaCategoria = "Nuevo";
      if (cantidadCompras >= 10) nuevaCategoria = "VIP";
      else if (cantidadCompras >= 5) nuevaCategoria = "Frecuente";
      else if (cantidadCompras === 1) nuevaCategoria = "Nuevo";
      else nuevaCategoria = null;

      if (nuevaCategoria) {
        await connection.query(
          "UPDATE clientes SET categoria = ? WHERE id = ?",
          [nuevaCategoria, cliente_id]
        );
      }

      await connection.commit();

      // Obtener datos cliente para enviar
      const [[clienteData]] = await connection.query(
        "SELECT email, nombres, telefono FROM clientes WHERE id = ?",
        [cliente_id]
      );

      const nombreCliente = clienteData.nombres;
      const correoCliente = clienteData.email;
      const telefonoCliente = clienteData.telefono;
      const nombreProductos = productos
        .map((p) => p.nombre_producto)
        .join(", ");

      // 1. Enviar datos a webhook n8n
      try {
        await fetch("http://localhost:5678/webhook-test/ventas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cliente: nombreCliente,
            correo: correoCliente,
            telefono: telefonoCliente,
            producto: nombreProductos,
            monto: total,
            ventaId: ventaId, // importante para PDF
          }),
        });
        console.log("📡 Datos enviados a webhook n8n correctamente");
      } catch (webhookError) {
        console.error("❌ Error al enviar a n8n:", webhookError.message);
      }

      // 2. Llamar al endpoint que envía el PDF por email
      try {
        await fetch(`http://localhost:5678/ventas/enviarPdfEmail/${ventaId}`);
        console.log(
          "📤 PDF enviado automáticamente después de registrar la venta"
        );
      } catch (err) {
        console.error("❌ Error al enviar PDF automáticamente:", err.message);
      }

      console.log("✅ Venta registrada correctamente. ID:", ventaId);
      req.session.mensajeExito = "Venta registrada correctamente.";
      res.redirect("/ventas/verPreboleta/" + ventaId);
    } catch (error) {
      await connection.rollback();
      console.error("Error al registrar venta:", error.message);
      req.session.mensajeError =
        "Error al registrar la venta: " + error.message;
      res.redirect("/ventas");
    }
  });
});

// ✅ RUTA CORREGIDA PARA VER PREBOLETA - USANDO CALLBACKS
router.get("/ventas/verPreboleta/:id", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const ventaId = req.params.id;

  req.getConnection((err, conn) => {
    if (err) {
      console.error("❌ Error de conexión:", err);
      req.session.mensajeError = "Error de conexión a la base de datos.";
      return res.redirect("/ventas");
    }

    conn.query(
      "SELECT * FROM ventas WHERE id = ?",
      [ventaId],
      (err, ventaResults) => {
        if (err) {
          console.error("❌ Error al obtener venta:", err);
          req.session.mensajeError = "Error al obtener la venta.";
          return res.redirect("/ventas");
        }

        if (ventaResults.length === 0) {
          req.session.mensajeError = "Venta no encontrada.";
          return res.redirect("/ventas");
        }

        const venta = ventaResults[0];

        conn.query(
          "SELECT * FROM clientes WHERE id = ?",
          [venta.cliente_id],
          (err, clienteResults) => {
            if (err) {
              console.error("❌ Error al obtener cliente:", err);
              req.session.mensajeError = "Error al obtener el cliente.";
              return res.redirect("/ventas");
            }

            if (clienteResults.length === 0) {
              req.session.mensajeError = "Cliente no encontrado.";
              return res.redirect("/ventas");
            }

            const cliente = clienteResults[0];

            conn.query(
              `SELECT d.*, p.nombre AS nombre_producto 
               FROM detalle_ventas d
               JOIN productos p ON d.producto_id = p.id
               WHERE d.venta_id = ?`,
              [ventaId],
              (err, productos) => {
                if (err) {
                  console.error("❌ Error al obtener productos:", err);
                  req.session.mensajeError = "Error al obtener los productos.";
                  return res.redirect("/ventas");
                }

                // Agregamos una variable para indicar que debe mostrar SweetAlert
                res.render("verPreboleta", {
                  cliente,
                  venta,
                  productos,
                  mostrarAlerta: true, // <-- variable para el mensaje SweetAlert
                });
              }
            );
          }
        );
      }
    );
  });
});

router.get("/ventas/enviarBoleta/:id", async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const ventaId = req.params.id;

  req.getConnection(async (err, conn) => {
    if (err) return res.status(500).send("Error de conexión a la BD");

    try {
      // Obtener datos de venta, cliente y productos
      const [[venta]] = await conn
        .promise()
        .query("SELECT * FROM ventas WHERE id = ?", [ventaId]);
      const [[cliente]] = await conn
        .promise()
        .query("SELECT * FROM clientes WHERE id = ?", [venta.cliente_id]);
      const [productos] = await conn.promise().query(
        `SELECT d.*, p.nombre AS nombre_producto
         FROM detalle_ventas d
         JOIN productos p ON d.producto_id = p.id
         WHERE d.venta_id = ?`,
        [ventaId]
      );

      // Renderizar HTML usando EJS
      const html = await ejs.renderFile(
        path.join(__dirname, "../views/verPreboleta.ejs"),
        { venta, cliente, productos },
        { async: true }
      );

      // Generar PDF con Puppeteer
      const browser = await puppeteer.launch({ headless: "new" });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({ format: "A4" });
      await browser.close();

      // Configurar el transporte de Nodemailer
      const transporter = nodemailer.createTransport({
        service: "gmail", // o tu proveedor
        auth: {
          user: "TUCORREO@gmail.com",
          pass: "TUPASSWORD_O_APP_PASSWORD",
        },
      });

      // Enviar el correo
      await transporter.sendMail({
        from: "TUCORREO@gmail.com",
        to: cliente.email,
        subject: `Boleta de Venta #${venta.id}`,
        text: `Hola ${cliente.nombres},\nAdjunto encontrará su boleta de venta.\nGracias por su compra.`,
        attachments: [
          {
            filename: `boleta-venta-${venta.id}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });

      res.send("✅ Boleta enviada correctamente al correo del cliente.");
    } catch (error) {
      console.error("❌ Error al enviar boleta:", error);
      res.status(500).send("Error al generar y enviar la boleta.");
    }
  });
});

router.get("/ventas/enviarPdfWhatsApp/:id", async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const ventaId = req.params.id;

  req.getConnection(async (err, conn) => {
    if (err) return res.status(500).send("Error de conexión");

    try {
      // Obtener venta
      const [[venta]] = await conn
        .promise()
        .query("SELECT * FROM ventas WHERE id = ?", [ventaId]);

      // Obtener cliente
      const [[cliente]] = await conn
        .promise()
        .query("SELECT * FROM clientes WHERE id = ?", [venta.cliente_id]);

      // Obtener productos
      const [productos] = await conn.promise().query(
        `SELECT p.nombre AS nombre_producto, dv.cantidad, dv.precio_unitario,
                (dv.cantidad * dv.precio_unitario) AS subtotal_producto
         FROM detalle_ventas dv
         JOIN productos p ON p.id = dv.producto_id
         WHERE dv.venta_id = ?`,
        [ventaId]
      );

      productos.forEach((prod) => {
        prod.precio_unitario = parseFloat(prod.precio_unitario);
        prod.subtotal_producto = parseFloat(prod.subtotal_producto);
      });

      // Renderizar HTML desde plantilla
      res.render(
        "verpreboleta",
        {
          venta,
          cliente,
          productos,
          mostrarAlerta: false,
        },
        async (err, html) => {
          if (err) {
            console.error("Error al renderizar EJS:", err);
            return res.status(500).send("Error al generar el PDF.");
          }

          const nombreArchivo = `boleta-${ventaId}.pdf`;
          const rutaPDF = path.join(
            __dirname,
            "..",
            "public",
            "boletas",
            nombreArchivo
          );
          const urlPublico = `http://localhost:3000/boletas/${nombreArchivo}`;

          // Crear PDF con Puppeteer
          const browser = await puppeteer.launch();
          const page = await browser.newPage();
          await page.setContent(html, { waitUntil: "networkidle0" });
          await page.pdf({
            path: rutaPDF,
            format: "A4",
            printBackground: true,
          });
          await browser.close();

          // Obtener número de WhatsApp
          let telefono = cliente.telefono.replace(/\D/g, "");
          if (!telefono.startsWith("51")) {
            telefono = "51" + telefono;
          }

          const mensaje = encodeURIComponent(
            `Hola ${cliente.nombres}, aquí está tu boleta en PDF: ${urlPublico}`
          );
          const waLink = `https://wa.me/${telefono}?text=${mensaje}`;
          return res.redirect(waLink);
        }
      );
    } catch (err) {
      console.error("Error generando o enviando PDF por WhatsApp:", err);
      res.status(500).send("Error al generar o enviar el PDF.");
    }
  });
});
router.get("/ventas/enviarPdfEmail/:id", async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const ventaId = req.params.id;

  req.getConnection(async (err, conn) => {
    if (err) return res.status(500).send("Error de conexión");

    try {
      // 1. Obtener datos
      const [[venta]] = await conn
        .promise()
        .query("SELECT * FROM ventas WHERE id = ?", [ventaId]);

      const [[cliente]] = await conn
        .promise()
        .query("SELECT * FROM clientes WHERE id = ?", [venta.cliente_id]);

      const [productos] = await conn.promise().query(
        `SELECT p.nombre AS nombre_producto, dv.cantidad, dv.precio_unitario,
                (dv.cantidad * dv.precio_unitario) AS subtotal_producto
         FROM detalle_ventas dv
         JOIN productos p ON p.id = dv.producto_id
         WHERE dv.venta_id = ?`,
        [ventaId]
      );

      productos.forEach((p) => {
        p.precio_unitario = parseFloat(p.precio_unitario);
        p.subtotal_producto = parseFloat(p.subtotal_producto);
      });

      // 2. Renderizar HTML desde la vista EJS
      const html = await new Promise((resolve, reject) => {
        res.render(
          "verpreboleta",
          { venta, cliente, productos, mostrarAlerta: false },
          (err, html) => {
            if (err) reject(err);
            else resolve(html);
          }
        );
      });

      // 3. Crear PDF desde HTML
      const nombreArchivo = `boleta-${ventaId}.pdf`;
      const rutaPDF = path.join(
        process.cwd(),
        "src",
        "public",
        "boletas",
        nombreArchivo
      );

      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      await page.pdf({ path: rutaPDF, format: "A4", printBackground: true });
      await browser.close();

      // 4. Configurar transporte nodemailer con Gmail
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "albinopablocasio@gmail.com", // 💌 TU CORREO GMAIL
          pass: "dvrkjkqnugyofalc", // 🔐 Contraseña de aplicación SIN espacios
        },
      });

      // 5. Enviar correo con PDF adjunto
      await transporter.sendMail({
        from: '"Empresa Alex" <tucorreo@gmail.com>',
        to: cliente.email,
        subject: `Boleta de Venta #${venta.id}`,
        text: `Hola ${cliente.nombres},\n\nAdjunto encontrarás tu boleta de venta.\n\nGracias por tu compra.\n`,
        attachments: [
          {
            filename: nombreArchivo,
            path: rutaPDF,
            contentType: "application/pdf",
          },
        ],
      });

      res.send("✅ PDF enviado correctamente al correo del cliente.");
    } catch (err) {
      console.error("❌ Error al enviar PDF por email:", err);
      res.status(500).send("Error al enviar el PDF por email.");
    }
  });
});
/////ANULAR VENTA///
// Anular venta (cambiar estado a 'anulada')
router.post("/ventas/eliminar/:id", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const ventaId = req.params.id;

  req.getConnection((err, conn) => {
    if (err) {
      console.error("❌ Error de conexión:", err);
      req.session.mensajeError = "Error de conexión a la base de datos.";
      return res.redirect("/ventas");
    }

    // Primero eliminar los detalles de la venta
    conn.query(
      "DELETE FROM detalle_ventas WHERE venta_id = ?",
      [ventaId],
      (err, result) => {
        if (err) {
          console.error("❌ Error al eliminar detalles de la venta:", err);
          req.session.mensajeError = "Error al eliminar detalles de la venta.";
          return res.redirect("/ventas");
        }

        // Luego eliminar la venta
        conn.query(
          "DELETE FROM ventas WHERE id = ?",
          [ventaId],
          (err, result) => {
            if (err) {
              console.error("❌ Error al eliminar la venta:", err);
              req.session.mensajeError = "Error al eliminar la venta.";
              return res.redirect("/ventas");
            }

            req.session.mensajeExito = "Venta eliminada correctamente.";
            return res.redirect("/historial-ventas"); // Asegúrate que esta ruta es correcta
          }
        );
      }
    );
  });
});

////HISOTIRA-VENTAS/////
// Mostrar historial de ventas con filtros

router.get("/historial-ventas", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const { fecha_inicio, fecha_fin, comprobante, estado, nombre_cliente } =
    req.query;

  req.getConnection((err, conn) => {
    if (err) {
      console.error("❌ Error de conexión:", err);
      return res.status(500).send("Error de servidor");
    }

    let condiciones = [];
    let valores = [];

    if (fecha_inicio && fecha_fin) {
      condiciones.push("DATE(v.fecha_venta) BETWEEN ? AND ?");
      valores.push(fecha_inicio, fecha_fin);
    } else if (fecha_inicio) {
      condiciones.push("DATE(v.fecha_venta) >= ?");
      valores.push(fecha_inicio);
    } else if (fecha_fin) {
      condiciones.push("DATE(v.fecha_venta) <= ?");
      valores.push(fecha_fin);
    }

    if (comprobante) {
      condiciones.push("v.tipo_comprobante = ?");
      valores.push(comprobante);
    }

    if (estado) {
      condiciones.push("v.estado = ?");
      valores.push(estado);
    }

    if (nombre_cliente) {
      condiciones.push(
        "CONCAT(c.nombres, ' ', c.apellido_paterno, ' ', c.apellido_materno) LIKE ?"
      );
      valores.push(`%${nombre_cliente}%`);
    }

    const whereSQL =
      condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

    const sql = `
      SELECT 
        v.id AS codigo_venta,
        DATE(v.fecha_venta) AS fecha,
        TIME(v.fecha_venta) AS hora,
        v.tipo_comprobante,
        v.numero_orden,
        c.nombres AS cliente_nombre,
        u.nombre_usuario AS cajero_nombre,
        v.total,
        v.forma_pago,
        v.estado
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      ${whereSQL}
      ORDER BY v.fecha_venta DESC
    `;

    conn.query(sql, valores, (err, ventas) => {
      if (err) {
        console.error("❌ Error al obtener ventas:", err);
        return res.status(500).send("Error al obtener ventas");
      }

      const mensajeExito = req.session.mensajeExito;
      const mensajeError = req.session.mensajeError;
      req.session.mensajeExito = null;
      req.session.mensajeError = null;

      res.render("historialVenta", {
        ventas,
        filtro: {
          fecha_inicio,
          fecha_fin,
          comprobante,
          estado,
          nombre_cliente,
        },
        mensajeExito,
        mensajeError,
        rol: req.session.usuario.rol, // <-- aquí agregamos el rol del usuario
      });
    });
  });
});
``;

/////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////--PRODUCTOS--////////////////////////////////////////////////////////////////

// Mostrar listado de productos
// Mostrar productos
router.get("/productos", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const { codigo, nombre, categoria, stock, precio, proveedor, stock_critico } =
    req.query;

  req.getConnection((err, conn) => {
    if (err) {
      console.error("❌ Error de conexión a la base de datos:", err);
      return res.send("Error de conexión a la base de datos.");
    }

    let sql = `
      SELECT p.*, c.nombre AS categoria_nombre, pr.razon_social AS proveedor_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
      WHERE p.estado != 'inactivo'
    `;

    const filtros = [];
    const params = [];

    if (codigo) {
      filtros.push("p.codigo LIKE ?");
      params.push(`%${codigo}%`);
    }

    if (nombre) {
      filtros.push("p.nombre LIKE ?");
      params.push(`%${nombre}%`);
    }

    if (categoria) {
      filtros.push("c.nombre LIKE ?");
      params.push(`%${categoria}%`);
    }

    if (stock_critico) {
      filtros.push("p.stock <= 10");
    } else if (stock) {
      filtros.push("p.stock >= ?");
      params.push(Number(stock));
    }

    if (precio) {
      filtros.push("p.precio <= ?");
      params.push(Number(precio));
    }

    if (proveedor) {
      filtros.push("pr.razon_social LIKE ?");
      params.push(`%${proveedor}%`);
    }

    if (filtros.length > 0) {
      sql += " AND " + filtros.join(" AND ");
    }

    sql += " ORDER BY p.fecha_creacion DESC";

    conn.query(sql, params, (err, productos) => {
      if (err) {
        console.error("❌ Error al obtener productos:", err);
        return res.send("Error al cargar productos.");
      }

      res.render("productos", { productos });
    });
  });
});
router.get("/productos/registrar", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión.");

    conn.query("SELECT * FROM categorias", (errCat, categorias) => {
      if (errCat) return res.send("Error al cargar categorías.");

      conn.query("SELECT * FROM proveedores", (errProv, proveedores) => {
        if (errProv) return res.send("Error al cargar proveedores.");

        res.render("registrarProductos", {
          categorias,
          proveedores,
          productos: [], // o lo que quieras mostrar en resumen
        });
      });
    });
  });
});
// Formulario de registro de producto
// Formulario de registro de producto
// Ruta para registrar productos
router.post("/productos/registrar", upload.single("imagen"), (req, res) => {
  if (!req.body) return res.status(400).send("No hay datos del formulario");

  const {
    codigo,
    nombre,
    descripcion,
    categoria_id,
    precio,
    precio_costo,
    margen_ganancia,
    stock,
    stock_minimo,
    proveedor_id,
    unidad_medida,
    estado,
    codigo_barras,
  } = req.body;

  const nuevaImagen = req.file ? req.file.filename : null;

  const nuevoProducto = {
    codigo,
    nombre,
    descripcion,
    categoria_id: parseInt(categoria_id),
    precio: parseFloat(precio),
    precio_costo: precio_costo ? parseFloat(precio_costo) : null,
    margen_ganancia: margen_ganancia ? parseFloat(margen_ganancia) : null,
    stock: parseInt(stock),
    stock_minimo: stock_minimo ? parseInt(stock_minimo) : 0,
    proveedor_id: proveedor_id ? parseInt(proveedor_id) : null,
    unidad_medida: unidad_medida?.trim() || "",
    estado: estado || "activo",
    codigo_barras: codigo_barras?.trim() || null,
    imagen: nuevaImagen,
    fecha_creacion: new Date(),
    fecha_actualizacion: new Date(),
  };

  const usuario_id = req.session.usuario?.id;

  req.getConnection((err, conn) => {
    if (err) {
      console.error("❌ Error de conexión:", err);
      return res.send("Error de conexión.");
    }

    // 1. Insertar el producto
    conn.query(
      "INSERT INTO productos SET ?",
      [nuevoProducto],
      (err, result) => {
        if (err) {
          console.error("❌ Error al insertar producto:", err);
          return res.send("Error al guardar producto.");
        }

        const producto_id = result.insertId;
        const cantidad = parseInt(stock);

        // Validar que tengamos datos esenciales
        if (!producto_id || !usuario_id || !cantidad) {
          console.warn("⚠️ Movimiento no registrado: datos faltantes.");
          return res.redirect("/productos");
        }

        // 2. Insertar movimiento de inventario
        const movimiento = {
          producto_id,
          tipo_movimiento: "ingreso",
          cantidad,
          fecha_movimiento: new Date(),
          motivo: "Registro inicial del producto",
          usuario_id,
          lote_id: null,
          stock_antes: 0,
          stock_despues: cantidad,
        };

        conn.query(
          "INSERT INTO movimientos_inventario SET ?",
          movimiento,
          (err2) => {
            if (err2) {
              console.error("❌ Error al registrar movimiento:", err2);
              return res.send(
                "Producto guardado pero no se registró el movimiento."
              );
            }

            console.log("✅ Producto y movimiento registrados correctamente");
            res.redirect("/productos");
          }
        );
      }
    );
  });
});

router.get("/productos/egreso/:id", (req, res) => {
  const productoId = req.params.id;

  req.getConnection((err, conn) => {
    if (err) return res.send("❌ Error de conexión");

    conn.query(
      "SELECT * FROM productos WHERE id = ?",
      [productoId],
      (err2, results) => {
        if (err2 || results.length === 0)
          return res.send("❌ Producto no encontrado");

        const producto = results[0];
        res.render("egresoProducto", { producto });
      }
    );
  });
});
router.post("/productos/egreso/:id", (req, res) => {
  const productoId = req.params.id;
  const { cantidad, motivo } = req.body;
  const usuarioId = req.session.usuario?.id || null;

  req.getConnection((err, conn) => {
    if (err) return res.send("❌ Error de conexión");

    conn.query(
      "SELECT stock FROM productos WHERE id = ?",
      [productoId],
      (err1, results) => {
        if (err1 || results.length === 0)
          return res.send("❌ Producto no encontrado");

        const stockAntes = results[0].stock;
        const cantidadEgreso = parseInt(cantidad);
        const stockDespues = stockAntes - cantidadEgreso;

        if (stockDespues < 0) return res.send("❌ Stock insuficiente");

        const movimiento = {
          producto_id: productoId,
          tipo_movimiento: "egreso",
          cantidad: cantidadEgreso,
          fecha_movimiento: new Date(),
          motivo: motivo || "Egreso manual",
          usuario_id: usuarioId,
          lote_id: null,
          stock_antes: stockAntes,
          stock_despues: stockDespues,
        };

        conn.query(
          "INSERT INTO movimientos_inventario SET ?",
          movimiento,
          (err2) => {
            if (err2) return res.send("❌ Error al registrar el egreso");

            conn.query(
              "UPDATE productos SET stock = ? WHERE id = ?",
              [stockDespues, productoId],
              (err3) => {
                if (err3) return res.send("❌ Error al actualizar stock");
                res.redirect("/productos");
              }
            );
          }
        );
      }
    );
  });
});
// Mostrar formulario de edición
router.get("/productos/editar/:id", (req, res) => {
  const id = req.params.id;

  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión.");

    conn.query(
      "SELECT * FROM productos WHERE id = ?",
      [id],
      (err, productos) => {
        if (err || productos.length === 0)
          return res.send("Producto no encontrado.");
        const producto = productos[0];

        conn.query("SELECT * FROM categorias", (err1, categorias) => {
          if (err1) return res.send("Error cargando categorías.");

          conn.query("SELECT * FROM proveedores", (err2, proveedores) => {
            if (err2) return res.send("Error cargando proveedores.");

            res.render("editarProductos", {
              producto,
              categorias,
              proveedores,
            });
          });
        });
      }
    );
  });
});

// Guardar cambios del producto editado
router.post("/productos/editar/:id", upload.single("imagen"), (req, res) => {
  const id = req.params.id;
  const {
    codigo,
    nombre,
    descripcion,
    categoria_id,
    precio,
    precio_costo,
    margen_ganancia,
    stock,
    stock_minimo,
    proveedor_id,
    unidad_medida,
    estado,
  } = req.body;

  const productoActualizado = {
    codigo,
    nombre,
    descripcion,
    categoria_id: categoria_id ? parseInt(categoria_id) : null,
    precio: parseFloat(precio),
    precio_costo: precio_costo ? parseFloat(precio_costo) : null,
    margen_ganancia: margen_ganancia ? parseFloat(margen_ganancia) : null,
    stock: parseInt(stock),
    stock_minimo: stock_minimo ? parseInt(stock_minimo) : 0,
    proveedor_id: proveedor_id ? parseInt(proveedor_id) : null,
    unidad_medida: unidad_medida?.trim() || "",
    estado: estado || "activo",
    fecha_actualizacion: new Date(),
  };

  if (req.file) {
    productoActualizado.imagen = req.file.filename; // Guarda solo el nombre del archivo
  }

  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión.");
    conn.query(
      "UPDATE productos SET ? WHERE id = ?",
      [productoActualizado, id],
      (err) => {
        if (err) return res.send("Error actualizando producto.");
        res.redirect("/productos");
      }
    );
  });
});

router.get("/productos/eliminar/:id", (req, res) => {
  const id = req.params.id;

  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión a la base de datos.");

    const sql = "UPDATE productos SET estado = 'inactivo' WHERE id = ?";
    conn.query(sql, [id], (err) => {
      if (err) {
        console.error("Error al desactivar el producto:", err);
        return res.send("No se pudo desactivar el producto.");
      }

      res.redirect("/productos");
    });
  });
});

// Exportar Excel
router.get("/productos/exportar/excel", (req, res) => {
  const { codigo, nombre, categoria, stock, precio, proveedor } = req.query;

  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión");

    let sql = `
      SELECT p.codigo, p.nombre, p.descripcion, c.nombre AS categoria, 
             p.precio, p.stock, p.estado, pr.razon_social AS proveedor
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
      WHERE p.estado != 'inactivo'
    `;
    const filters = [];

    if (codigo) {
      sql += " AND p.codigo LIKE ?";
      filters.push(`%${codigo}%`);
    }
    if (nombre) {
      sql += " AND p.nombre LIKE ?";
      filters.push(`%${nombre}%`);
    }
    if (categoria) {
      sql += " AND c.nombre LIKE ?";
      filters.push(`%${categoria}%`);
    }
    if (stock) {
      sql += " AND p.stock >= ?";
      filters.push(parseInt(stock));
    }
    if (precio) {
      sql += " AND p.precio <= ?";
      filters.push(parseFloat(precio));
    }
    if (proveedor) {
      sql += " AND pr.razon_social LIKE ?";
      filters.push(`%${proveedor}%`);
    }

    conn.query(sql, filters, async (err, productos) => {
      if (err) return res.send("Error al obtener productos");

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Productos");

      worksheet.columns = [
        { header: "Código", key: "codigo", width: 15 },
        { header: "Nombre", key: "nombre", width: 25 },
        { header: "Descripción", key: "descripcion", width: 30 },
        { header: "Categoría", key: "categoria", width: 20 },
        { header: "Precio", key: "precio", width: 15 },
        { header: "Stock", key: "stock", width: 10 },
        { header: "Estado", key: "estado", width: 10 },
        { header: "Proveedor", key: "proveedor", width: 25 },
      ];

      productos.forEach((prod) => worksheet.addRow(prod));

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=productos_filtrados.xlsx"
      );

      await workbook.xlsx.write(res);
      res.end();
    });
  });
});

router.get("/productos/exportar/pdf", (req, res) => {
  const { codigo, nombre, categoria, stock, precio, proveedor } = req.query;

  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión");

    let sql = `
      SELECT p.codigo, p.nombre, p.descripcion, c.nombre AS categoria, 
             p.precio, p.stock, p.estado, pr.razon_social AS proveedor
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
      WHERE p.estado != 'inactivo'
    `;
    const filters = [];

    if (codigo) {
      sql += " AND p.codigo LIKE ?";
      filters.push(`%${codigo}%`);
    }
    if (nombre) {
      sql += " AND p.nombre LIKE ?";
      filters.push(`%${nombre}%`);
    }
    if (categoria) {
      sql += " AND c.nombre LIKE ?";
      filters.push(`%${categoria}%`);
    }
    if (stock) {
      sql += " AND p.stock >= ?";
      filters.push(parseInt(stock));
    }
    if (precio) {
      sql += " AND p.precio <= ?";
      filters.push(parseFloat(precio));
    }
    if (proveedor) {
      sql += " AND pr.razon_social LIKE ?";
      filters.push(`%${proveedor}%`);
    }

    conn.query(sql, filters, (err, productos) => {
      if (err) return res.send("Error al obtener productos");

      const doc = new PDFDocument({ size: "A4", margin: 30 });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=productos_filtrados.pdf"
      );

      doc.pipe(res);

      doc
        .fontSize(18)
        .text("Productos Filtrados", { align: "center" })
        .moveDown();

      productos.forEach((p, i) => {
        doc
          .fontSize(12)
          .text(`Código: ${p.codigo}`)
          .text(`Nombre: ${p.nombre}`)
          .text(`Descripción: ${p.descripcion || "N/A"}`)
          .text(`Categoría: ${p.categoria || "N/A"}`)
          .text(`Precio: S/ ${p.precio}`)
          .text(`Stock: ${p.stock}`)
          .text(`Estado: ${p.estado}`)
          .text(`Proveedor: ${p.proveedor || "N/A"}`)
          .moveDown();
      });

      doc.end();
    });
  });
});

///////////////////////////////////////////////
/////////////////////PROVEEDORES//////////////////////////

// Mostrar lista de proveedores activos
router.get("/proveedores", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const buscar = req.query.buscar ? req.query.buscar.trim() : "";

  req.getConnection((err, conn) => {
    if (err) {
      console.error("❌ Error de conexión:", err);
      return res.send("Error de conexión a la base de datos.");
    }

    // Base de la consulta SQL con LEFT JOIN para contar productos bajo stock
    let sql = `
      SELECT 
        p.id, p.ruc, p.razon_social, p.contacto, p.telefono, p.correo_electronico,
        p.direccion, p.tipo_productos, p.estado, p.fecha_registro,
        COUNT(pr.id) AS productos_bajo_stock
      FROM proveedores p
      LEFT JOIN productos pr 
        ON pr.proveedor_id = p.id 
        AND pr.stock < pr.stock_minimo 
        AND pr.estado = 'activo'
    `;

    // Si hay texto en "buscar", agregamos filtro WHERE
    const params = [];
    if (buscar) {
      sql += `
        WHERE p.ruc LIKE ? OR p.razon_social LIKE ?
      `;
      params.push(`%${buscar}%`, `%${buscar}%`);
    }

    sql += `
      GROUP BY p.id
      ORDER BY p.fecha_registro DESC
    `;

    conn.query(sql, params, (err, proveedores) => {
      if (err) {
        console.error("❌ Error al obtener proveedores:", err);
        return res.send("Error al obtener la lista de proveedores.");
      }

      // Enviamos la variable "buscar" para mantener el valor en el input
      res.render("proveedores", { proveedores, buscar });
    });
  });
});

router.get("/proveedores/registrar", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");
  res.render("registrarProveedor"); // archivo .ejs
});
// Guardar nuevo proveedor
router.post("/proveedores/guardar", (req, res) => {
  const {
    ruc,
    razon_social,
    contacto,
    telefono,
    correo_electronico,
    direccion,
    tipo_productos,
    estado,
  } = req.body;

  req.getConnection((err, conn) => {
    if (err) {
      console.error("❌ Error de conexión:", err);
      return res.send("Error de conexión a la base de datos.");
    }

    // Validar que el RUC no se repita
    conn.query(
      "SELECT * FROM proveedores WHERE ruc = ?",
      [ruc],
      (err, results) => {
        if (err) {
          console.error("❌ Error al verificar RUC:", err);
          return res.send("Error al verificar el RUC.");
        }

        if (results.length > 0) {
          return res.send("❌ El RUC ya está registrado.");
        }

        const nuevoProveedor = {
          ruc,
          razon_social,
          contacto,
          telefono,
          correo_electronico,
          direccion,
          tipo_productos,
          estado,
          fecha_registro: new Date(),
        };

        conn.query("INSERT INTO proveedores SET ?", nuevoProveedor, (err2) => {
          if (err2) {
            console.error("❌ Error al guardar proveedor:", err2);
            return res.send("Error al guardar el proveedor.");
          }

          res.redirect("/proveedores");
        });
      }
    );
  });
});
// Mostrar formulario para editar proveedor
router.get("/proveedores/editar/:id", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const proveedorId = req.params.id;

  req.getConnection((err, conn) => {
    if (err) {
      console.error("❌ Error de conexión:", err);
      return res.send("Error de conexión a la base de datos.");
    }

    conn.query(
      "SELECT * FROM proveedores WHERE id = ?",
      [proveedorId],
      (err, results) => {
        if (err) {
          console.error("❌ Error al obtener proveedor:", err);
          return res.send("Error al obtener el proveedor.");
        }

        if (results.length === 0) {
          return res.send("Proveedor no encontrado.");
        }

        // Renderizar vista con datos del proveedor
        res.render("editarProveedor", { proveedor: results[0] });
      }
    );
  });
});

// Procesar actualización de proveedor
router.post("/proveedores/actualizar/:id", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const proveedorId = req.params.id;

  const {
    ruc,
    razon_social,
    contacto,
    telefono,
    correo_electronico,
    direccion,
    tipo_productos,
    estado,
  } = req.body;

  req.getConnection((err, conn) => {
    if (err) {
      console.error("❌ Error de conexión:", err);
      return res.send("Error de conexión a la base de datos.");
    }

    // Validar que el RUC no esté duplicado en otro proveedor distinto
    conn.query(
      "SELECT * FROM proveedores WHERE ruc = ? AND id != ?",
      [ruc, proveedorId],
      (err, results) => {
        if (err) {
          console.error("❌ Error al verificar RUC:", err);
          return res.send("Error al verificar el RUC.");
        }

        if (results.length > 0) {
          return res.send("❌ El RUC ya está registrado en otro proveedor.");
        }

        const proveedorActualizado = {
          ruc,
          razon_social,
          contacto,
          telefono,
          correo_electronico,
          direccion,
          tipo_productos,
          estado,
        };

        conn.query(
          "UPDATE proveedores SET ? WHERE id = ?",
          [proveedorActualizado, proveedorId],
          (err2) => {
            if (err2) {
              console.error("❌ Error al actualizar proveedor:", err2);
              return res.send("Error al actualizar el proveedor.");
            }

            res.redirect("/proveedores");
          }
        );
      }
    );
  });
});
// Ruta para eliminar proveedor físicamente (borrado real)

// Ruta para "eliminar" proveedor (cambiar estado a inactivo)

// Ruta para eliminar proveedor físicamente (borrado real)
router.get("/proveedores/eliminar-fisico/:id", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const proveedorId = req.params.id;

  req.getConnection((err, conn) => {
    if (err) {
      console.error("❌ Error de conexión:", err);
      return res.send("Error de conexión a la base de datos.");
    }

    conn.query(
      "DELETE FROM proveedores WHERE id = ?",
      [proveedorId],
      (err2) => {
        if (err2) {
          console.error("❌ Error al eliminar proveedor:", err2);
          return res.send("Error al eliminar el proveedor.");
        }

        res.redirect("/proveedores");
      }
    );
  });
});
router.get("/proveedores/eliminar/:id", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const proveedorId = req.params.id;

  req.getConnection((err, conn) => {
    if (err) {
      console.error("❌ Error de conexión:", err);
      return res.send("Error de conexión a la base de datos.");
    }

    // Cambiar estado a 'inactivo' en vez de eliminar físicamente
    conn.query(
      "UPDATE proveedores SET estado = 'inactivo' WHERE id = ?",
      [proveedorId],
      (err2) => {
        if (err2) {
          console.error("❌ Error al inactivar proveedor:", err2);
          return res.send("Error al inactivar el proveedor.");
        }

        res.redirect("/proveedores");
      }
    );
  });
});

// Ruta para alternar estado activo/inactivo

///////////////////////////////////////////////
////////////////////REPORTES////////////////////////
// Ejemplo básico usando MySQL con req.getConnection (como en tus otros ejemplos)
// Ruta principal de reportes
router.get("/reportes", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const tipo = req.query.tipo || "";

  req.getConnection((err, conn) => {
    if (err) {
      console.error("Error de conexión:", err);
      return res.send("Error de conexión a la base de datos.");
    }

    switch (tipo) {
      case "ventas":
        // Ventas por cliente, concatenando nombre completo
        const sqlVentas = `
          SELECT 
            CONCAT(c.nombres, ' ', c.apellido_paterno, ' ', c.apellido_materno) AS cliente,
            COUNT(v.id) AS total_ventas
          FROM ventas v
          JOIN clientes c ON v.cliente_id = c.id
          GROUP BY c.id
          ORDER BY total_ventas DESC
          LIMIT 10
        `;
        conn.query(sqlVentas, (err, results) => {
          if (err) {
            console.error(err);
            return res.send("Error obteniendo datos de ventas.");
          }

          const datosGrafico = {
            etiquetas: results.map((r) => r.cliente),
            valores: results.map((r) => r.total_ventas),
            titulo: "Ventas por Cliente",
            label: "Número de ventas",
          };

          res.render("reportes", { tipo, datosGrafico });
        });
        break;

      case "productos-stock-bajo":
        // Productos con stock bajo
        const sqlStockBajo = `
          SELECT nombre, stock
          FROM productos
          WHERE stock < stock_minimo
          ORDER BY stock ASC
          LIMIT 10
        `;
        conn.query(sqlStockBajo, (err, results) => {
          if (err) {
            console.error(err);
            return res.send("Error obteniendo productos con stock bajo.");
          }

          const datosGrafico = {
            etiquetas: results.map((r) => r.nombre),
            valores: results.map((r) => r.stock),
            titulo: "Productos con Stock Bajo",
            label: "Cantidad en stock",
          };

          res.render("reportes", { tipo, datosGrafico });
        });
        break;

      case "proveedores":
        // Cantidad de proveedores activos e inactivos
        const sqlProveedores = `
          SELECT estado, COUNT(id) AS cantidad
          FROM proveedores
          GROUP BY estado
        `;
        conn.query(sqlProveedores, (err, results) => {
          if (err) {
            console.error(err);
            return res.send("Error obteniendo datos de proveedores.");
          }

          const etiquetas = results.map(
            (r) => r.estado.charAt(0).toUpperCase() + r.estado.slice(1)
          );
          const valores = results.map((r) => r.cantidad);

          const datosGrafico = {
            etiquetas,
            valores,
            titulo: "Proveedores Activos vs Inactivos",
            label: "Cantidad de proveedores",
          };

          res.render("reportes", { tipo, datosGrafico });
        });
        break;

      default:
        // Sin tipo o tipo no reconocido
        res.render("reportes", { tipo: "", datosGrafico: null });
        break;
    }
  });
});

router.get("/reportes/ventas", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const { fecha_inicio, fecha_fin, cliente, producto } = req.query;

  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión");

    let sql = `
      SELECT v.id, v.fecha, c.nombre_cliente, p.nombre_producto, dv.cantidad, dv.precio_unitario
      FROM ventas v
      JOIN clientes c ON v.cliente_id = c.id
      JOIN detalle_ventas dv ON dv.venta_id = v.id
      JOIN productos p ON dv.producto_id = p.id
      WHERE 1=1
    `;

    const params = [];

    if (fecha_inicio && fecha_fin) {
      sql += " AND v.fecha BETWEEN ? AND ?";
      params.push(fecha_inicio, fecha_fin);
    }
    if (cliente) {
      sql += " AND c.nombre_cliente LIKE ?";
      params.push(`%${cliente}%`);
    }
    if (producto) {
      sql += " AND p.nombre_producto LIKE ?";
      params.push(`%${producto}%`);
    }

    sql += " ORDER BY v.fecha DESC";

    conn.query(sql, params, (err, resultados) => {
      if (err) return res.send("Error al obtener el reporte de ventas.");

      res.render("reportes/ventas", { resultados, filtros: req.query });
    });
  });
});
router.get("/reportes/productos", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const { tipo } = req.query; // 'stock-bajo' o 'mas-vendidos'

  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión");

    let sql = "";
    if (tipo === "stock-bajo") {
      sql = `
        SELECT p.id, p.nombre, p.stock, p.stock_minimo, p.precio
        FROM productos p
        WHERE p.stock <= p.stock_minimo
        ORDER BY p.stock ASC
      `;
    } else if (tipo === "mas-vendidos") {
      sql = `
        SELECT p.id, p.nombre, SUM(dv.cantidad) AS total_vendido
        FROM productos p
        JOIN detalle_ventas dv ON dv.producto_id = p.id
        GROUP BY p.id
        ORDER BY total_vendido DESC
        LIMIT 20
      `;
    } else {
      return res.send("Tipo de reporte no válido");
    }

    conn.query(sql, (err, resultados) => {
      if (err) return res.send("Error al obtener reporte de productos.");

      res.render("reportes/productos", { tipo, resultados });
    });
  });
});
router.get("/reportes/proveedores", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión");

    const sql = `
      SELECT 
        p.id, p.ruc, p.razon_social, p.estado, COUNT(pr.id) AS productos_suministrados
      FROM proveedores p
      LEFT JOIN productos pr ON pr.proveedor_id = p.id
      GROUP BY p.id
      ORDER BY p.razon_social
    `;

    conn.query(sql, (err, resultados) => {
      if (err) return res.send("Error al obtener reporte de proveedores.");

      res.render("reportes/proveedores", { resultados });
    });
  });
});
router.get("/reportes/ventas/exportar-excel", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const { fecha_inicio, fecha_fin } = req.query;

  req.getConnection(async (err, conn) => {
    if (err) return res.send("Error de conexión");

    const sql = `
      SELECT v.id, v.fecha, c.nombre_cliente, p.nombre_producto, dv.cantidad, dv.precio_unitario
      FROM ventas v
      JOIN clientes c ON v.cliente_id = c.id
      JOIN detalle_ventas dv ON dv.venta_id = v.id
      JOIN productos p ON dv.producto_id = p.id
      WHERE v.fecha BETWEEN ? AND ?
      ORDER BY v.fecha DESC
    `;

    conn.query(sql, [fecha_inicio, fecha_fin], async (err, resultados) => {
      if (err) return res.send("Error al obtener datos para exportar.");

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Ventas");

      worksheet.columns = [
        { header: "ID Venta", key: "id", width: 10 },
        { header: "Fecha", key: "fecha", width: 15 },
        { header: "Cliente", key: "nombre_cliente", width: 30 },
        { header: "Producto", key: "nombre_producto", width: 30 },
        { header: "Cantidad", key: "cantidad", width: 10 },
        { header: "Precio Unitario", key: "precio_unitario", width: 15 },
      ];

      resultados.forEach((row) => {
        worksheet.addRow({
          id: row.id,
          fecha: new Date(row.fecha).toLocaleDateString(),
          nombre_cliente: row.nombre_cliente,
          nombre_producto: row.nombre_producto,
          cantidad: row.cantidad,
          precio_unitario: row.precio_unitario,
        });
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=ReporteVentas_${fecha_inicio}_a_${fecha_fin}.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
    });
  });
});
router.get("/reportes/ventas/exportar-pdf", (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const { fecha_inicio, fecha_fin } = req.query;

  req.getConnection((err, conn) => {
    if (err) return res.send("Error de conexión");

    const sql = `
      SELECT v.id, v.fecha, c.nombre_cliente, p.nombre_producto, dv.cantidad, dv.precio_unitario
      FROM ventas v
      JOIN clientes c ON v.cliente_id = c.id
      JOIN detalle_ventas dv ON dv.venta_id = v.id
      JOIN productos p ON dv.producto_id = p.id
      WHERE v.fecha BETWEEN ? AND ?
      ORDER BY v.fecha DESC
    `;

    conn.query(sql, [fecha_inicio, fecha_fin], (err, resultados) => {
      if (err) return res.send("Error al obtener datos para PDF.");

      const doc = new PDFDocument({ margin: 30, size: "A4" });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=ReporteVentas_${fecha_inicio}_a_${fecha_fin}.pdf`
      );

      doc.pipe(res);

      doc.fontSize(16).text("Reporte de Ventas", { align: "center" });
      doc.moveDown();

      resultados.forEach((row) => {
        doc
          .fontSize(10)
          .text(`ID Venta: ${row.id}`, { continued: true })
          .text(` Fecha: ${new Date(row.fecha).toLocaleDateString()}`, {
            continued: true,
            align: "right",
          })
          .moveDown(0.2);
        doc.text(`Cliente: ${row.nombre_cliente}`);
        doc.text(`Producto: ${row.nombre_producto}`);
        doc.text(`Cantidad: ${row.cantidad}`);
        doc.text(`Precio Unitario: S/ ${row.precio_unitario.toFixed(2)}`);
        doc.moveDown();
      });

      doc.end();
    });
  });
});

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
