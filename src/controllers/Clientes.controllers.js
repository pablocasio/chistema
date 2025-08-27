import Cliente from "../models/clientes.models.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

// 📌 Listar clientes
export const getClientes = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  try {
    const clientes = await Cliente.find();
    res.render("clientes", { clientes });
  } catch (err) {
    console.error("Error al obtener clientes:", err);
    res.send("Error al obtener los datos.");
  }
};

// 📌 Formulario para registrar cliente
export const getRegistrarCliente = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  res.render("registrarCliente", {
    mensajeError: req.session.mensajeError || null,
    mensajeExito: req.session.mensajeExito || null,
  });

  req.session.mensajeError = null;
  req.session.mensajeExito = null;
};

// 📌 Registrar cliente
export const postRegistrarCliente = async (req, res) => {
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
    categoria,
  } = req.body;

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

  try {
    const nuevoCliente = new Cliente({
      tipo_documento,
      documento: numero_documento,
      nombres,
      apellido_paterno,
      apellido_materno,
      codigo_verificacion,
      direccion,
      telefono,
      email,
      categoria,
      fecha_registro: new Date(),
    });

    await nuevoCliente.save();

    req.session.clienteSeleccionadoId = nuevoCliente._id;
    req.session.mensajeExito =
      "Cliente registrado y seleccionado exitosamente.";

    res.redirect("/ventas/nueva");
  } catch (err) {
    console.error("Error al registrar cliente:", err);
    req.session.mensajeError = "Error al registrar el cliente.";
    res.redirect("/clientes/registrar");
  }
};

// 📌 Exportar clientes en PDF
export const getExportarClientesPDF = async (req, res) => {
  try {
    const clientes = await Cliente.find();

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
  } catch (err) {
    res.send("Error al generar PDF");
  }
};

// 📌 Exportar clientes en Excel
export const getExportarClientesExcel = async (req, res) => {
  try {
    const clientes = await Cliente.find();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Clientes");

    sheet.columns = [
      { header: "ID", key: "_id" },
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
    res.setHeader("Content-Disposition", "attachment; filename=clientes.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.send("Error al exportar Excel");
  }
};

// 📌 Eliminar cliente
export const getClientesEliminar = async (req, res) => {
  try {
    await Cliente.findByIdAndDelete(req.params.id);
    res.redirect("/clientes");
  } catch (err) {
    console.error("Error al eliminar cliente:", err);
    res.send("No se pudo eliminar el cliente.");
  }
};

// 📌 Formulario para editar cliente
export const getClientesEditar = async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) return res.send("Cliente no encontrado.");
    res.render("editarCliente", { cliente });
  } catch (err) {
    res.send("Error al obtener el cliente.");
  }
};

// 📌 Guardar cambios de edición
export const postClientesEditar = async (req, res) => {
  try {
    await Cliente.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.redirect("/clientes");
  } catch (err) {
    console.error("Error al actualizar cliente:", err);
    res.send("Error al guardar los cambios.");
  }
};
//paraconsultar a la reniec//
// Reemplaza este token por el tuyo
// Token personal de apis.net.pe
// Token personal de apis.net.pe

const API_TOKEN = "apis-token-16433.g8U1oX2tVqcR8thWFNGJa7rqUJXj8oo2";

// Consulta a la API de RENIEC
export const postClientesReniec = async (req, res) => {
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
};

// Validar existencia de cliente en la base de datos
export const postClientesValidarExistencia = async (req, res) => {
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
};

// Buscar clientes (GET)

export const getClientesBuscar = async (req, res) => {
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
};
