"use strict";

var fs = require("fs");
var path = require("path");
var logs = require("./logs");

var BACKUP_DIR = path.join(__dirname, "..", "..", "data", "backups");
var BACKUP_FILES = [
  "config.json",
  "cars.json",
  "leads.json",
  "clients.json",
  "analytics.json",
  "messages.json",
  "profile.json",
  "finance.json",
  "promissories.json",
  "employees.json",
  "agenda.json",
  "audit-logs.json",
  "admin-credentials.json",
];
var MAX_BACKUPS = 30;
var DAY_MS = 24 * 60 * 60 * 1000;

function ensureDir() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function listBackups() {
  ensureDir();
  return fs
    .readdirSync(BACKUP_DIR)
    .filter(function (f) {
      return f.endsWith(".json");
    })
    .map(function (f) {
      var full = path.join(BACKUP_DIR, f);
      var stat = fs.statSync(full);
      return { name: f, size: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort(function (a, b) {
      return b.createdAt.localeCompare(a.createdAt);
    });
}

function validateBackupPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Backup corrompido: formato inválido");
  }
  if (!payload.createdAt || !payload.files || typeof payload.files !== "object") {
    throw new Error("Backup corrompido: metadados ausentes");
  }
  var count = Object.keys(payload.files).filter(function (k) {
    return payload.files[k] != null;
  }).length;
  if (count === 0) throw new Error("Backup vazio");
  return { valid: true, fileCount: count, createdAt: payload.createdAt };
}

function createBackup(meta) {
  ensureDir();
  var stamp = new Date().toISOString().replace(/[:.]/g, "-");
  var name = "backup-" + stamp + ".json";
  var dataDir = path.join(__dirname, "..", "..", "data");
  var payload = {
    createdAt: new Date().toISOString(),
    version: 1,
    trigger: (meta && meta.trigger) || "manual",
    files: {},
  };
  BACKUP_FILES.forEach(function (file) {
    var fp = path.join(dataDir, file);
    try {
      payload.files[file] = JSON.parse(fs.readFileSync(fp, "utf8"));
    } catch (_e) {
      payload.files[file] = null;
    }
  });
  validateBackupPayload(payload);
  fs.writeFileSync(path.join(BACKUP_DIR, name), JSON.stringify(payload, null, 2), "utf8");
  pruneOldBackups();
  return { name: name, createdAt: payload.createdAt };
}

function pruneOldBackups() {
  var list = listBackups();
  if (list.length <= MAX_BACKUPS) return;
  list.slice(MAX_BACKUPS).forEach(function (b) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, b.name));
    } catch (_e) { /* ignore */ }
  });
}

function restoreBackup(name) {
  if (!name || name.indexOf("..") !== -1 || !/^backup-[\w.-]+\.json$/.test(name)) {
    throw new Error("Backup inválido");
  }
  var fp = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(fp)) throw new Error("Backup não encontrado");
  var payload = JSON.parse(fs.readFileSync(fp, "utf8"));
  validateBackupPayload(payload);
  var dataDir = path.join(__dirname, "..", "..", "data");
  Object.keys(payload.files || {}).forEach(function (file) {
    if (payload.files[file] == null) return;
    if (BACKUP_FILES.indexOf(file) === -1) return;
    fs.writeFileSync(
      path.join(dataDir, file),
      JSON.stringify(payload.files[file], null, 2) + "\n",
      "utf8"
    );
  });
  return { ok: true, restored: Object.keys(payload.files || {}) };
}

function inspectBackup(name) {
  var fp = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(fp)) throw new Error("Backup não encontrado");
  var payload = JSON.parse(fs.readFileSync(fp, "utf8"));
  return validateBackupPayload(payload);
}

function shouldRunAutoBackup() {
  var list = listBackups();
  if (!list.length) return true;
  var last = new Date(list[0].createdAt).getTime();
  return Date.now() - last > DAY_MS;
}

function scheduleAutoBackup() {
  if (shouldRunAutoBackup()) {
    try {
      var info = createBackup({ trigger: "auto-startup" });
      logs.logAction("system", "backup.auto", info.name);
    } catch (err) {
      console.error("Backup automático falhou:", err.message);
    }
  }
  setInterval(function () {
    if (!shouldRunAutoBackup()) return;
    try {
      var result = createBackup({ trigger: "auto-daily" });
      logs.logAction("system", "backup.auto", result.name);
    } catch (err) {
      console.error("Backup automático falhou:", err.message);
    }
  }, DAY_MS);
}

module.exports = {
  listBackups: listBackups,
  createBackup: createBackup,
  restoreBackup: restoreBackup,
  inspectBackup: inspectBackup,
  scheduleAutoBackup: scheduleAutoBackup,
};
