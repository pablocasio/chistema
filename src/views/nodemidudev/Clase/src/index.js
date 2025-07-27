const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const readline = require("readline");

// Configuración
const AUDIO_FILE = path.join(__dirname, "triple-lavada.mp3");
const LYRICS = [
  { time: 11.0, line: "Una triple lavada pa' loquear" }, // Empieza en el segundo 11
  { time: 14.0, line: "Pa'l sube y baja, una pluma de wax" },
  { time: 17.0, line: "Un whiskey del año de tu papá" },
  { time: 20.0, line: "No más para empezar" },
  { time: 23.0, line: "Una pinche bellaca pa' bailar" },
  { time: 26.0, line: "Aquí traigo una feria pa' gastar" },
  { time: 29.0, line: "Unas de milkyway pa' amenizar" },
  { time: 32.0, line: "No más para empezar" },
  { time: 35.0, line: "Arriba de la Cheyenne, cuadros van y cuadros vienen" },
  { time: 39.0, line: "Prendidos desde los seven, de los que casi no se ven" },
  // Continúa con el resto de la letra ajustando los tiempos...
];

// Variables de control
let currentLine = 0;
let currentWord = 0;
let audioProcess;
let wordInterval;

function playAudio() {
  return new Promise((resolve) => {
    const player =
      process.platform === "win32"
        ? `start "" "${AUDIO_FILE}"`
        : process.platform === "darwin"
        ? `afplay "${AUDIO_FILE}"`
        : `mpg123 "${AUDIO_FILE}"`;

    audioProcess = exec(player, (error) => {
      if (error) console.error("Error al reproducir:", error);
      resolve();
    });
  });
}

function displayWordByWord() {
  if (currentLine >= LYRICS.length) {
    clearInterval(wordInterval);
    return;
  }

  const elapsed = (Date.now() - startTime) / 1000;
  const lyric = LYRICS[currentLine];

  if (elapsed >= lyric.time) {
    const words = lyric.line.split(" ");

    if (currentWord < words.length) {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);

      // Mostrar palabras ya dichas en gris, la actual en blanco
      const displayedWords = [
        ...words.slice(0, currentWord).map((w) => `\x1b[90m${w}\x1b[0m`),
        words[currentWord],
        ...words.slice(currentWord + 1).map((w) => `\x1b[90m${w}\x1b[0m`),
      ].join(" ");

      process.stdout.write(displayedWords);
      currentWord++;
    } else {
      process.stdout.write("\n");
      currentLine++;
      currentWord = 0;
    }
  }
}

async function main() {
  console.log("Reproduciend  ");

  // Iniciar temporizador cuando empieza la reproducción
  startTime = Date.now();

  // Iniciar reproducción
  await playAudio();

  // Iniciar el display de letras después de 11 segundos
  setTimeout(() => {
    wordInterval = setInterval(displayWordByWord, 150); // Ajusta velocidad de palabras
  }, 11000); // 11 segundos de delay

  // Manejar cierre del programa
  process.on("SIGINT", () => {
    if (audioProcess) audioProcess.kill();
    clearInterval(wordInterval);
    process.exit();
  });
}

main();
