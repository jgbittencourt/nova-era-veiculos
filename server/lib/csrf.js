"use strict";

/**
 * Proteção CSRF preparatória para APIs autenticadas.
 * Exige header X-Nova-Admin em mutações do painel.
 * Rotas públicas (login, leads, chat) ficam isentas.
 */
var CSRF_HEADER = "x-nova-admin";

var PUBLIC_MUTATIONS = {
  "/api/auth/login": true,
  "/api/leads": true,
  "/api/chat": true,
  "/api/analytics/track": true,
  "/api/inventory/query": true,
};

function isProtectedMutation(path, method) {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  if (PUBLIC_MUTATIONS[path]) return false;
  if (path.indexOf("/api/admin/") === 0) return true;
  if (path === "/api/config" || path === "/api/cars") return true;
  if (path === "/api/auth/logout") return true;
  if (path === "/api/leads") return true;
  return false;
}

function requireAdminOrigin(req, res, next) {
  var path = req.path || "";
  if (!isProtectedMutation(path, req.method)) {
    return next();
  }
  if (req.headers[CSRF_HEADER] === "1") {
    return next();
  }
  return res.status(403).json({
    error: "Requisição bloqueada (CSRF). Atualize o painel admin.",
  });
}

module.exports = {
  CSRF_HEADER: CSRF_HEADER,
  requireAdminOrigin: requireAdminOrigin,
};
