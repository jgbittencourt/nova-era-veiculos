"use strict";

var path = require("path");
var fs = require("fs");
var multer = require("multer");
var sharp = require("sharp");

var UPLOAD_DIR = path.join(__dirname, "..", "..", "assets", "img", "carros");
var CLIENT_UPLOAD_DIR = path.join(__dirname, "..", "..", "assets", "img", "clientes");
var MAX_FILE_SIZE = 8 * 1024 * 1024;
var MAX_WIDTH = 1600;
var QUALITY = 82;

var storage = multer.memoryStorage();

var upload = multer({
  storage: storage,
  limits: { files: 12, fileSize: MAX_FILE_SIZE },
  fileFilter: function (_req, file, cb) {
    var ok =
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/webp" ||
      file.mimetype === "image/gif";
    cb(ok ? null : new Error("Formato de imagem não suportado"), ok);
  },
});

function safeBasename(name) {
  return String(name || "veiculo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function processAndSave(buffer, prefix, targetDir, webPrefix) {
  fs.mkdirSync(targetDir, { recursive: true });
  var meta = await sharp(buffer).metadata();
  if (!meta || !meta.width || !meta.height) {
    throw new Error("Arquivo de imagem inválido");
  }
  if (meta.width > 8000 || meta.height > 8000) {
    throw new Error("Imagem muito grande");
  }
  var base = safeBasename(prefix || "veiculo") + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  var filename = base + ".webp";
  var fullPath = path.join(targetDir, filename);

  await sharp(buffer)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(fullPath);

  return webPrefix + filename;
}

async function saveUploadedFiles(files, prefix, kind) {
  var isClient = kind === "client";
  var targetDir = isClient ? CLIENT_UPLOAD_DIR : UPLOAD_DIR;
  var webPrefix = isClient ? "assets/img/clientes/" : "assets/img/carros/";
  var paths = [];
  for (var i = 0; i < files.length; i++) {
    paths.push(await processAndSave(files[i].buffer, prefix, targetDir, webPrefix));
  }
  return paths;
}

module.exports = {
  uploadMiddleware: upload.array("images", 12),
  saveUploadedFiles: saveUploadedFiles,
  CLIENT_UPLOAD_DIR: CLIENT_UPLOAD_DIR,
};
