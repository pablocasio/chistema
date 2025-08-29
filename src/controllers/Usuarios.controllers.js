import Usuario from "../models/usuarios.models.js"; // tu esquema mongoose
import Perfil from "../models/perfiles.models.js"; // si tienes tabla perfiles también en Mongo

/////////////////////////////
// PERFIL
export const getPerfil = async (req, res) => {
  if (!req.session.usuario || !req.session.usuario.id) {
    return res.redirect("/login");
  }

  try {
    const usuario = await Usuario.findById(req.session.usuario.id).lean();
    if (!usuario) return res.status(404).send("Usuario no encontrado");

    // Si tienes colección perfiles
    const perfil = await Perfil.findOne({ usuario_id: usuario._id }).lean();

    res.render("perfil", { usuario, perfil });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error en la consulta de usuario/perfil");
  }
};

/////////////////////////////
// USUARIOS (solo admin)
export function checkAdmin(req, res, next) {
  if (req.session.usuario && req.session.usuario.rol === "admin") {
    return next();
  }
  return res.status(403).send("Acceso denegado");
}

// Vista de usuarios (solo admin)
export const getAdmin = async (req, res) => {
  try {
    const usuarios = await Usuario.find().lean();
    res.render("usuarios", {
      usuarios,
      rol: req.session.usuario?.rol || "",
    });
  } catch (error) {
    console.error(error);
    res.send("Error al obtener usuarios");
  }
};

// Activar usuario
export const postUsuariosIdActivar = async (req, res) => {
  const id = req.params.id;
  try {
    await Usuario.findByIdAndUpdate(id, { estado: "activo" });
    res.redirect("/usuarios");
  } catch (error) {
    console.error(error);
    res.send("Error al activar usuario");
  }
};

// Desactivar usuario
export const postUsuariosIdDesactivar = async (req, res) => {
  const id = req.params.id;
  try {
    await Usuario.findByIdAndUpdate(id, { estado: "pendiente" });
    res.redirect("/usuarios");
  } catch (error) {
    console.error(error);
    res.send("Error al desactivar usuario");
  }
};

// Eliminar usuario
export const postUsuariosIdEliminar = async (req, res) => {
  const id = req.params.id;
  try {
    await Usuario.findByIdAndDelete(id);
    res.redirect("/usuarios");
  } catch (error) {
    console.error(error);
    res.send("Error al eliminar usuario");
  }
};
