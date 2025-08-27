import Cliente from "../models/Cliente.js";
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
