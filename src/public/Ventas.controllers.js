export const getVentas = async (req, res) => {
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
};

// Ruta para mostrar el formulario de nueva venta
export const getVentasNueva = async (req, res) => {
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
};
////AQUI ESTA LA CATEGORIZACION DE CLIENTE///
export const postVentasRegistrar = async(
  "/ventas/registrar",
  async (req, res) => {
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

          await connection.query(
            "INSERT INTO detalle_ventas SET ?",
            detalleData
          );
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
  }
);

// ✅ RUTA CORREGIDA PARA VER PREBOLETA - USANDO CALLBACKS
export const getVentasVerPreboleta = async (req, res) => {
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
};

export const getVentasEnviarBoleta = async (req, res) => {
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
};

export const getVentasEnviarPDFWhatsApp = async (req, res) => {
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
};
export const getVentasEnviarPDFemail = async (req, res) => {
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
};
/////ANULAR VENTA///
// Anular venta (cambiar estado a 'anulada')
export const postEliminarid = async("/ventas/eliminar/:id", (req, res) => {
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

////HISTORIA-VENTAS/////
// Mostrar historial de ventas con filtros

export const getHistorialVentas = async (req, res) => {
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
};
