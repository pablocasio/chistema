import Cliente from "../models/clientes.models.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import axios from "axios";

// 📌 Listar clientes
export const getClientes = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  try {
    const clientes = await Cliente.find().sort({ fecha_registro: -1 });
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
  try {
    const {
      nombres,
      apellido_paterno,
      apellido_materno,
      numero_documento,
      tipo_documento,
      direccion,
      telefono,
      email,
    } = req.body;

    const nuevoCliente = new Cliente({
      nombre: nombres, // 👈 ajustado
      apellido: `${apellido_paterno} ${apellido_materno}`, // 👈 ajustado
      numero_documento,
      tipo_documento,
      direccion,
      telefono,
      email,
    });

    await nuevoCliente.save();
    res.redirect("/clientes");
  } catch (err) {
    console.error("Error al registrar cliente:", err);
    res.status(500).send("Error al registrar cliente");
  }
};

// 📌 Exportar clientes en PDF
export const getExportarClientesPDF = async (req, res) => {
  try {
    const clientes = await Cliente.find().sort({ fecha_registro: -1 });

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
          } | ${c.documento} | ${c.telefono || "-"} | ${
            c.email || "-"
          } | Categoría: ${c.categoria || "Sin categoría"}`
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
    const clientes = await Cliente.find().sort({ fecha_registro: -1 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Clientes");

    sheet.columns = [
      { header: "ID", key: "_id", width: 24 },
      { header: "Tipo Doc", key: "tipo_documento", width: 12 },
      { header: "Documento", key: "documento", width: 15 },
      { header: "Nombres", key: "nombres", width: 25 },
      { header: "Apellido Paterno", key: "apellido_paterno", width: 20 },
      { header: "Apellido Materno", key: "apellido_materno", width: 20 },
      { header: "Cod. Verif.", key: "codigo_verificacion", width: 12 },
      { header: "Dirección", key: "direccion", width: 30 },
      { header: "Teléfono", key: "telefono", width: 15 },
      { header: "Correo", key: "email", width: 25 },
      { header: "Categoría", key: "categoria", width: 15 },
    ];

    clientes.forEach((c) => sheet.addRow(c.toObject()));

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

// 📌 Consulta a RENIEC
const API_TOKEN = "apis-token-16433.g8U1oX2tVqcR8thWFNGJa7rqUJXj8oo2";

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

// 📌 Validar existencia de cliente

export const postClientesValidarExistencia = async (req, res) => {
  const { numero } = req.body;

  try {
    const cliente = await Cliente.findOne({ documento: numero });

    if (cliente) {
      res.json({
        success: true,
        cliente: {
          nombres: cliente.nombres,
          apellido_paterno: cliente.apellido_paterno,
          apellido_materno: cliente.apellido_materno,
          numero_documento: cliente.documento,
          codigo_verificacion: cliente.codigo_verificacion || "",
        },
      });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    console.error("Error al validar cliente:", err);
    res.status(500).json({ success: false, error: "Error en la validación" });
  }
};

// 📌 Buscar clientes

export const getClientesBuscar = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const q = req.query.q ? req.query.q.trim() : "";

  try {
    let clientes;
    if (q === "") {
      clientes = await Cliente.find().sort({ fecha_registro: -1 }).limit(20);
    } else {
      clientes = await Cliente.find({
        $or: [
          { nombres: { $regex: q, $options: "i" } },
          { documento: { $regex: q, $options: "i" } },
        ],
      })
        .sort({ fecha_registro: -1 })
        .limit(20);
    }

    res.render("clientes", {
      clientes,
      mensajeError:
        clientes.length === 0 ? "No se encontraron resultados." : null,
      mensajeExito: null,
      q,
    });
  } catch (err) {
    console.error("Error al buscar clientes:", err);
    res.send("Error al realizar la búsqueda.");
  }
};
