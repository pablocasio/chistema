import axios from "axios";
import bcrypt from "bcryptjs";

// GET /
export const mostrarLogin = async (req, res) => {
  res.redirect("/login");
};

// GET /login
export const getLogin = async (req, res) => {
  if (!req.session.intentos) req.session.intentos = 0;

  res.render("login", {
    intentos: req.session.intentos,
  });
};

// POST /login
export const Postlogin = async (req, res) => {
  const { email, contrasena, "g-recaptcha-response": captcha } = req.body;
  const ahora = Date.now();
  const tiempoBloqueo = 5 * 60 * 1000; // 5 minutos

  if (!req.session.intentos) req.session.intentos = 0;

  // Bloqueo temporal
  if (req.session.bloqueoHasta && ahora < req.session.bloqueoHasta) {
    return res.redirect("/login?bloqueo=1");
  }

  // Validar captcha si hay muchos intentos
  if (req.session.intentos >= 3) {
    if (!captcha) return res.redirect("/login?captcha=empty");

    try {
      const secretKey = "6LdwlXsrAAAAAGTgfueazkLof1kQAr1m84UcufYR";
      const response = await axios.post(
        "https://www.google.com/recaptcha/api/siteverify",
        null,
        {
          params: {
            secret: secretKey,
            response: captcha,
          },
        }
      );

      if (!response.data.success) return res.redirect("/login?captcha=fail");
    } catch (err) {
      console.error("Error al verificar reCAPTCHA:", err);
      return res.redirect("/login?captcha=error");
    }
  }

  // Verificar usuario en la BD
  req.getConnection(async (err, conn) => {
    if (err) return res.send("Error de conexión");

    try {
      const [[usuario]] = await conn
        .promise()
        .query("SELECT * FROM usuarios WHERE email = ?", [email]);

      if (!usuario) {
        req.session.intentos++;
        if (req.session.intentos >= 5)
          req.session.bloqueoHasta = ahora + tiempoBloqueo;
        return res.redirect("/login?error=1");
      }

      // Verificar estado del usuario
      if (usuario.estado === "pendiente") {
        return res.redirect("/login?pendiente=1");
      }

      const valido = await bcrypt.compare(contrasena, usuario.contrasena_hash);
      if (!valido) {
        req.session.intentos++;
        if (req.session.intentos >= 5)
          req.session.bloqueoHasta = ahora + tiempoBloqueo;
        return res.redirect("/login?error=1");
      }

      // ✅ Login exitoso
      req.session.usuario = {
        id: usuario.id,
        nombre: usuario.nombre_usuario,
        rol: usuario.rol,
      };
      req.session.intentos = 0;
      req.session.bloqueoHasta = null;

      res.redirect("/deshboard");
    } catch (error) {
      console.error("Error en login:", error);
      res.send("Error del servidor");
    }
  });
};
export const getLogout = async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error al cerrar sesión:", err);
      return res.status(500).send("Error al cerrar sesión");
    }
    res.redirect("/login"); // Redirige a la ruta que muestra login.ejs
  });
};
export const getDashboard = async (req, res) => {
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
};

export const getRegistrar = async (req, res) => {
  const mensajeError = req.session.mensajeError || null;
  const mensajeExito = req.session.mensajeExito || null;
  req.session.mensajeError = null;
  req.session.mensajeExito = null;
  res.render("registrar", { mensajeError, mensajeExito });
};
export const PostRegistro = async (req, res) => {
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
};
