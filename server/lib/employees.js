"use strict";

var storage = require("./storage");
var passwords = require("./passwords");

var ROLES = {
  administrador: ["*"],
  admin: ["*"],
  vendedor: ["veiculos", "leads", "clientes", "mensagens", "agenda"],
  financeiro: ["financeiro", "promissorias", "contratos", "agenda", "analytics"],
};

function readEmployees() {
  return storage.readJsonFile("employees.json", []);
}

function writeEmployees(list) {
  storage.writeJsonFile("employees.json", list);
}

function hashPassword(password) {
  return passwords.hashPassword(password);
}

function verifyPassword(password, hash) {
  return passwords.verifyHash(password, hash);
}

function findByUsername(username) {
  return readEmployees().find(function (e) {
    return e.ativo !== false && e.username === username;
  });
}

function authenticateEmployee(username, password) {
  var emp = findByUsername(username);
  if (!emp || !emp.passwordHash) return null;
  if (!verifyPassword(password, emp.passwordHash)) return null;
  return { username: emp.username, role: emp.role || "vendedor", nome: emp.nome || emp.username };
}

function canAccess(role, module) {
  var allowed = ROLES[role] || [];
  return allowed.indexOf("*") !== -1 || allowed.indexOf(module) !== -1;
}

function sanitizeEmployee(body, isCreate) {
  var out = {
    nome: String(body.nome || "").trim().slice(0, 120),
    username: String(body.username || "").trim().slice(0, 40),
    role: String(body.role || "vendedor").trim(),
    email: String(body.email || "").trim().slice(0, 120),
    telefone: String(body.telefone || "").trim().slice(0, 24),
    ativo: body.ativo !== false,
  };
  if (!ROLES[out.role] && out.role !== "administrador") out.role = "vendedor";
  if (isCreate && body.password) out.passwordHash = hashPassword(body.password);
  if (!isCreate && body.password) out.passwordHash = hashPassword(body.password);
  return out;
}

module.exports = {
  ROLES: ROLES,
  readEmployees: readEmployees,
  writeEmployees: writeEmployees,
  authenticateEmployee: authenticateEmployee,
  canAccess: canAccess,
  sanitizeEmployee: sanitizeEmployee,
  hashPassword: hashPassword,
};
