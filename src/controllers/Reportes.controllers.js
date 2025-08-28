////////////////////REPORTES////////////////////////
// Ejemplo básico usando MySQL con req.getConnection (como en tus otros ejemplos)
// Ruta principal de reportes
export const getReportes = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const tipo = req.query.tipo || "";

  try {
    switch (tipo) {
      case "ventas":
        // Top 10 clientes con más ventas
        const ventasClientes = await Venta.aggregate([
          {
            $lookup: {
              from: "clientes", // nombre de la colección en Mongo
              localField: "cliente_id",
              foreignField: "_id",
              as: "cliente",
            },
          },
          { $unwind: "$cliente" },
          {
            $group: {
              _id: "$cliente._id",
              cliente: { $first: "$cliente.nombre" }, // asume que Cliente tiene campo "nombre"
              total_ventas: { $sum: 1 },
            },
          },
          { $sort: { total_ventas: -1 } },
          { $limit: 10 },
        ]);

        return res.render("reportes", {
          tipo,
          datosGrafico: {
            etiquetas: ventasClientes.map((r) => r.cliente),
            valores: ventasClientes.map((r) => r.total_ventas),
            titulo: "Ventas por Cliente",
            label: "Número de ventas",
          },
        });

      case "productos-stock-bajo":
        // Aquí necesitas el modelo Producto
        const productos = await Producto.find({
          $expr: { $lt: ["$stock", "$stock_minimo"] },
        })
          .sort({ stock: 1 })
          .limit(10);

        return res.render("reportes", {
          tipo,
          datosGrafico: {
            etiquetas: productos.map((p) => p.nombre),
            valores: productos.map((p) => p.stock),
            titulo: "Productos con Stock Bajo",
            label: "Cantidad en stock",
          },
        });

      case "proveedores":
        const proveedores = await Proveedor.aggregate([
          {
            $group: {
              _id: "$estado",
              cantidad: { $sum: 1 },
            },
          },
        ]);

        return res.render("reportes", {
          tipo,
          datosGrafico: {
            etiquetas: proveedores.map(
              (p) => p._id.charAt(0).toUpperCase() + p._id.slice(1)
            ),
            valores: proveedores.map((p) => p.cantidad),
            titulo: "Proveedores Activos vs Inactivos",
            label: "Cantidad de proveedores",
          },
        });

      default:
        return res.render("reportes", { tipo: "", datosGrafico: null });
    }
  } catch (err) {
    console.error("❌ Error en reportes:", err);
    res.send("Error al generar el reporte.");
  }
};

export const getReportesVentas = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const { fecha_inicio, fecha_fin, cliente } = req.query;

  const filtros = {};

  if (fecha_inicio && fecha_fin) {
    filtros.fecha_venta = {
      $gte: new Date(fecha_inicio),
      $lte: new Date(fecha_fin),
    };
  }

  if (cliente) {
    filtros["cliente_id.nombre"] = new RegExp(cliente, "i"); // si Cliente tiene nombre
  }

  try {
    const resultados = await Venta.find(filtros)
      .populate("cliente_id", "nombre")
      .populate("usuario_id", "nombre")
      .sort({ fecha_venta: -1 });

    res.render("reportes/ventas", { resultados, filtros: req.query });
  } catch (err) {
    res.send("Error al obtener el reporte de ventas.");
  }
};

export const getReportesProductos = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const { tipo } = req.query; // 'stock-bajo' o 'mas-vendidos'

  try {
    let resultados = [];

    if (tipo === "stock-bajo") {
      resultados = await Producto.find({
        $expr: { $lte: ["$stock", "$stock_minimo"] },
      })
        .sort({ stock: 1 })
        .lean();
    } else if (tipo === "mas-vendidos") {
      resultados = await Venta.aggregate([
        { $unwind: "$detalle" }, // suponiendo que tienes un array "detalle" en la venta
        {
          $group: {
            _id: "$detalle.producto_id",
            total_vendido: { $sum: "$detalle.cantidad" },
          },
        },
        { $sort: { total_vendido: -1 } },
        { $limit: 20 },
        {
          $lookup: {
            from: "productos",
            localField: "_id",
            foreignField: "_id",
            as: "producto",
          },
        },
        { $unwind: "$producto" },
        {
          $project: {
            id: "$producto._id",
            nombre: "$producto.nombre",
            total_vendido: 1,
          },
        },
      ]);
    } else {
      return res.send("Tipo de reporte no válido");
    }

    res.render("reportes/productos", { tipo, resultados });
  } catch (err) {
    console.error(err);
    res.send("Error al obtener reporte de productos.");
  }
};

export const getReportesProveedores = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  try {
    const resultados = await Proveedor.aggregate([
      {
        $lookup: {
          from: "productos",
          localField: "_id",
          foreignField: "proveedor_id",
          as: "productos",
        },
      },
      {
        $project: {
          id: "$_id",
          ruc: 1,
          razon_social: 1,
          estado: 1,
          productos_suministrados: { $size: "$productos" },
        },
      },
      { $sort: { razon_social: 1 } },
    ]);

    res.render("reportes/proveedores", { resultados });
  } catch (err) {
    console.error(err);
    res.send("Error al obtener reporte de proveedores.");
  }
};

export const getReportesVentasExportarExcel = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const { fecha_inicio, fecha_fin } = req.query;

  try {
    const ventas = await Venta.find({
      fecha_venta: {
        $gte: new Date(fecha_inicio),
        $lte: new Date(fecha_fin),
      },
    })
      .populate("cliente_id", "nombre_cliente")
      .populate("detalle.producto_id", "nombre")
      .lean();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Ventas");

    worksheet.columns = [
      { header: "ID Venta", key: "id", width: 10 },
      { header: "Fecha", key: "fecha", width: 15 },
      { header: "Cliente", key: "cliente", width: 30 },
      { header: "Producto", key: "producto", width: 30 },
      { header: "Cantidad", key: "cantidad", width: 10 },
      { header: "Precio Unitario", key: "precio_unitario", width: 15 },
    ];

    ventas.forEach((venta) => {
      venta.detalle.forEach((d) => {
        worksheet.addRow({
          id: venta._id,
          fecha: new Date(venta.fecha_venta).toLocaleDateString(),
          cliente: venta.cliente_id?.nombre_cliente || "N/A",
          producto: d.producto_id?.nombre || "N/A",
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
        });
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
  } catch (err) {
    console.error(err);
    res.send("Error al exportar ventas a Excel.");
  }
};

export const getReportesVentasExportarPDF = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");

  const { fecha_inicio, fecha_fin } = req.query;

  try {
    const ventas = await Venta.find({
      fecha_venta: {
        $gte: new Date(fecha_inicio),
        $lte: new Date(fecha_fin),
      },
    })
      .populate("cliente_id", "nombre_cliente")
      .populate("detalle.producto_id", "nombre")
      .lean();

    const doc = new PDFDocument({ margin: 30, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=ReporteVentas_${fecha_inicio}_a_${fecha_fin}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(16).text("Reporte de Ventas", { align: "center" });
    doc.moveDown();

    ventas.forEach((venta) => {
      doc
        .fontSize(10)
        .text(`ID Venta: ${venta._id}`, { continued: true })
        .text(` Fecha: ${new Date(venta.fecha_venta).toLocaleDateString()}`, {
          align: "right",
        })
        .moveDown(0.2);
      doc.text(`Cliente: ${venta.cliente_id?.nombre_cliente || "N/A"}`);

      venta.detalle.forEach((d) => {
        doc.text(`Producto: ${d.producto_id?.nombre || "N/A"}`);
        doc.text(`Cantidad: ${d.cantidad}`);
        doc.text(`Precio Unitario: S/ ${d.precio_unitario.toFixed(2)}`);
        doc.moveDown();
      });

      doc.moveDown();
    });

    doc.end();
  } catch (err) {
    console.error(err);
    res.send("Error al exportar ventas a PDF.");
  }
};
