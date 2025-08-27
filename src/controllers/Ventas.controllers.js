import { Router } from "express";
import Cliente from "../models/clientes.models.js";
import Venta from "../models/ventas.models.js";
import Producto from "../models/productos.models.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import nodemailer from "nodemailer";
import puppeteer from "puppeteer";
import path from "path";
import ejs from "ejs";
import { fileURLToPath } from "url";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/////////////////////// - VENTAS - ///////////////////////////

// 📌 Listar ventas (vista principal)
export const getVentas = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const clienteSeleccionado = req.query.cliente_id || null;

  try {
    // Obtener lista de clientes ordenados por nombre
    const clientes = await Cliente.find().sort({ nombres: 1 });

    // Obtener productos con stock > 0
    const productos = await Producto.find({ stock: { $gt: 0 } }).sort({
      nombre: 1,
    });

    // Obtener la última venta registrada para generar el número de orden
    const ultimaVenta = await Venta.findOne().sort({ fecha_venta: -1 });

    let nuevoNumero = 1;
    if (ultimaVenta && ultimaVenta.numero_orden) {
      // Extraemos el número de la orden anterior (ej: ORD-00012 → 12)
      const numeroAnterior = parseInt(
        ultimaVenta.numero_orden.split("-")[1] || "0"
      );
      nuevoNumero = numeroAnterior + 1;
    }

    const numeroOrden = `ORD-${String(nuevoNumero).padStart(5, "0")}`;

    // Renderizar la vista
    res.render("ventas", {
      clientes,
      productos,
      clienteSeleccionado,
      numeroOrden,
      mensajeError: req.session.mensajeError || null,
      mensajeExito: req.session.mensajeExito || null,
    });

    // Limpiar mensajes de sesión
    req.session.mensajeError = null;
    req.session.mensajeExito = null;
  } catch (error) {
    console.error("❌ Error en getVentas:", error);
    res.status(500).send("Error interno del servidor");
  }
};

// Ruta para mostrar el formulario de nueva venta
export const getNuevaVenta = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  // Prioriza el cliente recién registrado si existe en sesión
  const clienteSeleccionado =
    req.session.clienteSeleccionadoId || req.query.cliente_id || null;
  delete req.session.clienteSeleccionadoId; // Limpiar después de usarlo

  try {
    // Obtener clientes ordenados por nombre
    const clientes = await Cliente.find().sort({ nombres: 1 });

    // Obtener productos con stock > 0
    const productos = await Producto.find({ stock: { $gt: 0 } }).sort({
      nombre: 1,
    });

    // Renderizar la vista
    res.render("ventas", {
      clientes,
      productos,
      clienteSeleccionado,
      mensajeError: req.session.mensajeError || null,
      mensajeExito: req.session.mensajeExito || null,
    });

    // Limpiar mensajes de sesión
    req.session.mensajeError = null;
    req.session.mensajeExito = null;
  } catch (error) {
    console.error("❌ Error en getNuevaVenta:", error);
    res.status(500).send("Error al obtener clientes o productos.");
  }
};

// Registrar nueva venta
export const postRegistrarVenta = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const {
    cliente_id,
    tipo_comprobante,
    numero_orden,
    forma_pago,
    monto_pagado,
    productos,
  } = req.body;

  if (!cliente_id || !tipo_comprobante || !forma_pago || !productos?.length) {
    req.session.mensajeError =
      "Faltan datos obligatorios o no hay productos en la venta.";
    return res.redirect("/ventas");
  }

  try {
    // Calcular subtotal, impuestos y total
    let subtotal_general = 0;
    productos.forEach((p) => {
      p.subtotal_producto = p.precio_unitario * p.cantidad;
      subtotal_general += p.subtotal_producto;
    });

    const impuesto_total = +(subtotal_general * 0.18).toFixed(2);
    const total = +(subtotal_general + impuesto_total).toFixed(2);
    let cambio_devuelto = monto_pagado ? +(monto_pagado - total).toFixed(2) : 0;
    if (cambio_devuelto < 0) cambio_devuelto = 0;

    // Guardar venta
    const venta = await Venta.create({
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
      detalle: [], // se llenará a continuación
    });

    // Insertar detalle y actualizar stock
    for (const p of productos) {
      const productoDB = await Producto.findById(p.producto_id);
      if (!productoDB)
        throw new Error(`Producto ID ${p.producto_id} no encontrado`);
      if (productoDB.stock < p.cantidad)
        throw new Error(
          `Stock insuficiente para el producto ${p.nombre_producto}`
        );

      // Agregar al detalle de la venta
      venta.detalle.push({
        producto_id: productoDB._id,
        nombre_producto: p.nombre_producto,
        precio_unitario: p.precio_unitario,
        cantidad: p.cantidad,
        subtotal_producto: p.subtotal_producto,
      });

      // Actualizar stock
      productoDB.stock -= p.cantidad;
      await productoDB.save();
    }

    await venta.save();

    // Actualizar categoría del cliente
    const ventasCliente = await Venta.countDocuments({
      cliente_id,
      estado: "activo",
    });
    let nuevaCategoria = "Nuevo";
    if (ventasCliente >= 10) nuevaCategoria = "VIP";
    else if (ventasCliente >= 5) nuevaCategoria = "Frecuente";
    else if (ventasCliente === 1) nuevaCategoria = "Nuevo";

    await Cliente.findByIdAndUpdate(cliente_id, { categoria: nuevaCategoria });

    // Obtener datos cliente para webhook/email
    const clienteData = await Cliente.findById(cliente_id);
    const nombreCliente = clienteData.nombres;
    const correoCliente = clienteData.email;
    const telefonoCliente = clienteData.telefono;
    const nombreProductos = productos.map((p) => p.nombre_producto).join(", ");

    // Enviar datos a webhook n8n
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
          ventaId: venta._id,
        }),
      });
      console.log("📡 Datos enviados a webhook n8n correctamente");
    } catch (webhookError) {
      console.error("❌ Error al enviar a n8n:", webhookError.message);
    }

    req.session.mensajeExito = "Venta registrada correctamente.";
    res.redirect("/ventas/verPreboleta/" + venta._id);
  } catch (error) {
    console.error("❌ Error al registrar venta:", error);
    req.session.mensajeError = "Error al registrar la venta: " + error.message;
    res.redirect("/ventas");
  }
};

// Ver preboleta
export const getVerPreboleta = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const ventaId = req.params.id;

  try {
    // 1️⃣ Obtener la venta por ID
    const venta = await Venta.findById(ventaId).lean();
    if (!venta) {
      req.session.mensajeError = "Venta no encontrada.";
      return res.redirect("/ventas");
    }

    // 2️⃣ Obtener cliente
    const cliente = await Cliente.findById(venta.cliente_id).lean();
    if (!cliente) {
      req.session.mensajeError = "Cliente no encontrado.";
      return res.redirect("/ventas");
    }

    // 3️⃣ Obtener productos de la venta
    const productosDetalle = await Promise.all(
      venta.detalle.map(async (item) => {
        const productoDB = await Producto.findById(item.producto_id).lean();
        return {
          ...item,
          nombre_producto: productoDB
            ? productoDB.nombre
            : item.nombre_producto,
        };
      })
    );

    // 4️⃣ Renderizar vista
    res.render("verPreboleta", {
      cliente,
      venta,
      productos: productosDetalle,
      mostrarAlerta: true,
    });
  } catch (error) {
    console.error("❌ Error al obtener preboleta:", error.message);
    req.session.mensajeError = "Error al obtener la preboleta.";
    res.redirect("/ventas");
  }
};

// Enviar boleta por email
export const getEnviarPDFemail = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const ventaId = req.params.id;

  try {
    // 1. Obtener datos
    const venta = await Venta.findById(ventaId).lean();
    if (!venta) {
      return res.status(404).send("Venta no encontrada");
    }

    const cliente = await Cliente.findById(venta.cliente_id).lean();
    if (!cliente) {
      return res.status(404).send("Cliente no encontrado");
    }

    // Obtener productos con nombres
    const productosDetalle = await Promise.all(
      venta.detalle.map(async (item) => {
        const productoDB = await Producto.findById(item.producto_id).lean();
        return {
          ...item,
          nombre_producto: productoDB
            ? productoDB.nombre
            : item.nombre_producto,
        };
      })
    );

    // 2. Renderizar HTML desde la vista EJS
    const html = await ejs.renderFile(
      path.join(__dirname, "../views/verPreboleta.ejs"),
      { venta, cliente, productos: productosDetalle, mostrarAlerta: false },
      { async: true }
    );

    // 3. Crear PDF desde HTML
    const nombreArchivo = `boleta-${ventaId}.pdf`;
    const rutaPDF = path.join(__dirname, "../public/boletas", nombreArchivo);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({ path: rutaPDF, format: "A4", printBackground: true });
    await browser.close();

    // 4. Configurar transporte nodemailer con Gmail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "albinopablocasio@gmail.com",
        pass: "dvrkjkqnugyofalc",
      },
    });

    // 5. Enviar correo con PDF adjunto
    await transporter.sendMail({
      from: '"Empresa Alex" <albinopablocasio@gmail.com>',
      to: cliente.email,
      subject: `Boleta de Venta #${venta._id}`,
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
};
// Enviar boleta por ID (similar a email pero con diferente enfoque)
export const getEnviarBoletaID = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const ventaId = req.params.id;

  try {
    // Obtener datos de venta, cliente y productos
    const venta = await Venta.findById(ventaId).lean();
    if (!venta) {
      return res.status(404).send("Venta no encontrada");
    }

    const cliente = await Cliente.findById(venta.cliente_id).lean();
    if (!cliente) {
      return res.status(404).send("Cliente no encontrado");
    }

    // Obtener productos con nombres
    const productosDetalle = await Promise.all(
      venta.detalle.map(async (item) => {
        const productoDB = await Producto.findById(item.producto_id).lean();
        return {
          ...item,
          nombre_producto: productoDB
            ? productoDB.nombre
            : item.nombre_producto,
        };
      })
    );

    // Renderizar HTML usando EJS
    const html = await ejs.renderFile(
      path.join(__dirname, "../views/verPreboleta.ejs"),
      { venta, cliente, productos: productosDetalle, mostrarAlerta: false },
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
      service: "gmail",
      auth: {
        user: "albinopablocasio@gmail.com",
        pass: "dvrkjkqnugyofalc",
      },
    });

    // Enviar el correo
    await transporter.sendMail({
      from: '"Empresa Alex" <albinopablocasio@gmail.com>',
      to: cliente.email,
      subject: `Boleta de Venta #${venta._id}`,
      text: `Hola ${cliente.nombres},\nAdjunto encontrará su boleta de venta.\nGracias por su compra.`,
      attachments: [
        {
          filename: `boleta-venta-${venta._id}.pdf`,
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
};

// Enviar PDF por WhatsApp
export const getVentasEnviarPDFWhatsApp = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const ventaId = req.params.id;

  try {
    // Obtener venta
    const venta = await Venta.findById(ventaId).lean();
    if (!venta) {
      return res.status(404).send("Venta no encontrada");
    }

    // Obtener cliente
    const cliente = await Cliente.findById(venta.cliente_id).lean();
    if (!cliente) {
      return res.status(404).send("Cliente no encontrado");
    }

    // Obtener productos con nombres
    const productosDetalle = await Promise.all(
      venta.detalle.map(async (item) => {
        const productoDB = await Producto.findById(item.producto_id).lean();
        return {
          ...item,
          nombre_producto: productoDB
            ? productoDB.nombre
            : item.nombre_producto,
          precio_unitario: parseFloat(item.precio_unitario),
          subtotal_producto: parseFloat(item.subtotal_producto),
        };
      })
    );

    // Renderizar HTML desde plantilla
    const html = await ejs.renderFile(
      path.join(__dirname, "../views/verPreboleta.ejs"),
      {
        venta,
        cliente,
        productos: productosDetalle,
        mostrarAlerta: false,
      },
      { async: true }
    );

    const nombreArchivo = `boleta-${ventaId}.pdf`;
    const rutaPDF = path.join(__dirname, "../public/boletas", nombreArchivo);
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
  } catch (err) {
    console.error("Error generando o enviando PDF por WhatsApp:", err);
    res.status(500).send("Error al generar o enviar el PDF.");
  }
};
// Anular venta
export const postVentasEliminarID = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const ventaId = req.params.id;

  try {
    // Buscar la venta
    const venta = await Venta.findById(ventaId);
    if (!venta) {
      req.session.mensajeError = "Venta no encontrada.";
      return res.redirect("/ventas");
    }

    // Restaurar stock de productos
    for (const item of venta.detalle) {
      await Producto.findByIdAndUpdate(item.producto_id, {
        $inc: { stock: item.cantidad },
      });
    }

    // Cambiar estado a "anulada"
    venta.estado = "anulada";
    await venta.save();

    req.session.mensajeExito = "Venta anulada correctamente.";
    return res.redirect("/historial-ventas");
  } catch (error) {
    console.error("❌ Error al anular la venta:", error);
    req.session.mensajeError = "Error al anular la venta.";
    return res.redirect("/ventas");
  }
};

// Mostrar historial de ventas con filtros
export const getHistorialVentas = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const { fecha_inicio, fecha_fin, comprobante, estado, nombre_cliente } =
    req.query;

  try {
    // Construir filtros
    let filtros = {};

    if (fecha_inicio && fecha_fin) {
      filtros.fecha_venta = {
        $gte: new Date(fecha_inicio),
        $lte: new Date(fecha_fin + "T23:59:59.999Z"),
      };
    } else if (fecha_inicio) {
      filtros.fecha_venta = { $gte: new Date(fecha_inicio) };
    } else if (fecha_fin) {
      filtros.fecha_venta = { $lte: new Date(fecha_fin + "T23:59:59.999Z") };
    }

    if (comprobante) {
      filtros.tipo_comprobante = comprobante;
    }

    if (estado) {
      filtros.estado = estado;
    }

    // Buscar ventas con filtros
    let ventas = await Venta.find(filtros)
      .populate("cliente_id", "nombres apellido_paterno apellido_materno")
      .populate("usuario_id", "nombre_usuario")
      .sort({ fecha_venta: -1 });

    // Filtrar por nombre de cliente si se proporciona
    if (nombre_cliente) {
      ventas = ventas.filter((venta) => {
        const nombreCompleto = `${venta.cliente_id.nombres} ${venta.cliente_id.apellido_paterno} ${venta.cliente_id.apellido_materno}`;
        return nombreCompleto
          .toLowerCase()
          .includes(nombre_cliente.toLowerCase());
      });
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
      rol: req.session.usuario.rol,
    });
  } catch (error) {
    console.error("❌ Error al obtener historial de ventas:", error);
    res.status(500).send("Error al obtener el historial de ventas");
  }
};

export default router;
