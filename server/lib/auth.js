"use strict";

var session = require("./session");
var employees = require("./employees");
var passwords = require("./passwords");
var logs = require("./logs");

function getAdminUsername() {
  return process.env.ADMIN_USERNAME || "admin";
}

function validateCredentials(username, password) {
  if (!password) return null;
  var expectedUser = getAdminUsername();

  if (String(username || "") === expectedUser && passwords.verifyAdminPassword(password)) {
    return { username: expectedUser, role: "administrador", nome: expectedUser };
  }

  var emp = employees.authenticateEmployee(username, password);
  if (emp) return emp;

  return null;
}

function checkAdmin(req, res, next) {
  if (!passwords.isAdminConfigured()) {
    return res.status(503).json({
      error: "Painel administrativo indisponível",
    });
  }

  var header = req.headers.authorization || "";
  var token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  var payload = session.verifyToken(token);
  if (payload && payload.sub) {
    req.adminUser = payload.sub;
    req.adminRole = payload.role || "administrador";
    req.adminToken = token;
    req.adminJti = payload.jti;
    return next();
  }

  logs.logAction("unknown", "auth.fail", "Token inválido ou expirado", {
    ip: req.ip,
  });
  return res.status(401).json({ error: "Não autorizado" });
}

function requireModule(moduleName) {
  return function (req, res, next) {
    var role = req.adminRole || "administrador";
    if (role === "administrador" || role === "admin") return next();
    if (employees.canAccess(role, moduleName)) return next();
    logs.logAction(req.adminUser, "auth.forbidden", moduleName);
    return res.status(403).json({ error: "Sem permissão para este módulo" });
  };
}

module.exports = {
  checkAdmin: checkAdmin,
  validateCredentials: validateCredentials,
  requireModule: requireModule,
  getAdminUsername: getAdminUsername,
};
