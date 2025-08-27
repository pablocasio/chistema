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
