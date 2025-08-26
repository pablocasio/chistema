const mongoose = require("mongoose");

const conectarDB = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/sistema_ventas", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Conectado a MongoDB");
  } catch (error) {
    console.error("❌ Error al conectar a MongoDB:", error.message);
    process.exit(1);
  }
};

module.exports = conectarDB;
