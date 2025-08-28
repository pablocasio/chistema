// Mostrar lista de proveedores activos
export const getProveedores = async (req, res) => {
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
};

export const getProveedoresRegistrar = async (req, res) => {
  if (!req.session.usuario) return res.redirect("/login");
  res.render("registrarProveedor"); // archivo .ejs
};
// Guardar nuevo proveedor
export const postProveedoresGuardar = async (req, res) => {
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
};
// Mostrar formulario para editar proveedor
export const getProveedoresEditar = async (req, res) => {
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
};

// Procesar actualización de proveedor
export const postProveedoresActualizarId = async (req, res) => {
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
};
// Ruta para eliminar proveedor físicamente (borrado real)

// Ruta para "eliminar" proveedor (cambiar estado a inactivo)

// Ruta para eliminar proveedor físicamente (borrado real)
export const getProveedoresEliminarFisicoID = async (req, res) => {
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
};
export const getProveedoresEliminarID = async (req, res) => {
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
};

// Ruta para alternar estado activo/inactivo
