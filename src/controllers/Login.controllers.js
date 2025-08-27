import axios from "axios";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import Usuario from "../models/usaurios.models.js"; // 👈 tu modelo mongoose

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
  const ahora = new Date();
  const tiempoBloqueo = 5 * 60 * 1000; // 5 minutos

  if (!req.session.intentos) req.session.intentos = 0;

  try {
    const usuario = await Usuario.findOne({ email });

    // Usuario no existe
    if (!usuario) {
      req.session.intentos++;
      if (req.session.intentos >= 5)
        req.session.bloqueoHasta = ahora.getTime() + tiempoBloqueo;
      return res.redirect("/login?error=1");
    }

    // Bloqueado temporalmente
    if (usuario.bloqueado_hasta && usuario.bloqueado_hasta > ahora) {
      return res.redirect("/login?bloqueo=1");
    }

    // Validar captcha si muchos intentos
    if (req.session.intentos >= 3) {
      if (!captcha) return res.redirect("/login?captcha=empty");

      try {
        const secretKey = "6LdwlXsrAAAAAGTgfueazkLof1kQAr1m84UcufYR";
        const response = await axios.post(
          "https://www.google.com/recaptcha/api/siteverify",
          null,
          { params: { secret: secretKey, response: captcha } }
        );

        if (!response.data.success) return res.redirect("/login?captcha=fail");
      } catch (err) {
        console.error("❌ Error al verificar reCAPTCHA:", err);
        return res.redirect("/login?captcha=error");
      }
    }

    // Estado pendiente/inactivo
    if (usuario.estado === "pendiente") {
      return res.redirect("/login?pendiente=1");
    }
    if (usuario.estado === "inactivo") {
      return res.redirect("/login?inactivo=1");
    }

    // Verificar contraseña
    const valido = await bcrypt.compare(contrasena, usuario.contrasena_hash);
    if (!valido) {
      usuario.intentos_fallidos += 1;

      if (usuario.intentos_fallidos >= 5) {
        usuario.bloqueado_hasta = new Date(ahora.getTime() + tiempoBloqueo);
      }

      await usuario.save();
      req.session.intentos++;
      return res.redirect("/login?error=1");
    }

    // ✅ Login correcto → resetear intentos
    usuario.intentos_fallidos = 0;
    usuario.bloqueado_hasta = null;
    await usuario.save();

    req.session.usuario = {
      id: usuario._id,
      nombre: usuario.nombre_usuario,
      rol: usuario.rol,
    };
    req.session.intentos = 0;
    req.session.bloqueoHasta = null;

    res.redirect("/deshboard");
  } catch (error) {
    console.error("❌ Error en login:", error);
    res.send("Error del servidor");
  }
};

// GET /logout
export const getLogout = async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error al cerrar sesión:", err);
      return res.status(500).send("Error al cerrar sesión");
    }
    res.redirect("/login");
  });
};

// GET /deshboard
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

  req.session.mensajeError = null;
  req.session.mensajeExito = null;
};

// GET /registrar
export const getRegistrar = async (req, res) => {
  const mensajeError = req.session.mensajeError || null;
  const mensajeExito = req.session.mensajeExito || null;
  req.session.mensajeError = null;
  req.session.mensajeExito = null;
  res.render("registrar", { mensajeError, mensajeExito });
};

// POST /registrar
export const PostRegistro = async (req, res) => {
  console.log("📩 Datos recibidos:", req.body);

  const { dni, nombre_usuario, email, contrasena } = req.body;

  if (!dni || !nombre_usuario || !email || !contrasena) {
    req.session.mensajeError = "Todos los campos son obligatorios.";
    return res.redirect("/registrar");
  }

  try {
    const existente = await Usuario.findOne({
      $or: [{ email }, { dni }, { nombre_usuario }],
    });

    if (existente) {
      req.session.mensajeError =
        "El correo, DNI o usuario ya están registrados.";
      return res.redirect("/registrar");
    }

    const contrasena_hash = await bcrypt.hash(contrasena, 10);
    const rol = "cajero";
    const estado = "pendiente";

    const nuevoUsuario = new Usuario({
      dni,
      nombre_usuario,
      email,
      contrasena_hash,
      rol,
      estado,
    });

    await nuevoUsuario.save();

    // Enviar correo al administrador
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "albinopablocasio@gmail.com",
        pass: "pqcb nvxf heom ksdu", // ← clave de aplicación
      },
    });

    await transporter.sendMail({
      from: '"Sistema de Ventas" <albinopablocasio@gmail.com>',
      to: "albinopablocasio@gmail.com",
      subject: "📥 Nuevo registro en espera de aprobación",
      html: `
        <h2>Nuevo usuario registrado</h2>
        <p><strong>DNI:</strong> ${dni}</p>
        <p><strong>Nombre:</strong> ${nombre_usuario}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Rol:</strong> ${rol}</p>
        <p>Aprueba este usuario desde tu panel de administración.</p>
      `,
    });

    console.log("✅ Usuario registrado y notificado al admin.");
    req.session.mensajeExito =
      "Registro exitoso. Espera aprobación del administrador.";
    res.redirect("/login?registro=pending");
  } catch (error) {
    console.error("❌ Error en registro:", error);
    req.session.mensajeError = "Error interno del servidor.";
    res.redirect("/registrar");
  }
};
