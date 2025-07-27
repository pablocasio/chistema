const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("3000 prueba");
});
app.listen(3000, (er) => {
  console.log("procesoo");
});
console