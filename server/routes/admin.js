"use strict";

var path = require("path");
var fs = require("fs");
var storage = require("../lib/storage");
var auth = require("../lib/auth");
var validate = require("../lib/validate");
var analytics = require("../lib/analytics");
var seo = require("../lib/seo");
var upload = require("../lib/upload");
var session = require("../lib/session");
var security = require("../lib/security");
var logs = require("../lib/logs");
var dashboardErp = require("../lib/dashboard-erp");
var promissories = require("../lib/promissories");

module.exports = function registerAdminRoutes(app, deps) {
  var limits = deps.limits;
  var resolveCars = deps.resolveCars;
  var ROOT = deps.ROOT;

  app.post("/api/auth/login", limits.adminAuth, function (req, res) {
    var body = req.body || {};
    var username = String(body.username || "").trim();
    var password = String(body.password || "");

    var user = auth.validateCredentials(username, password);
    if (!user) {
      logs.logAction(username || "unknown", "login.fail", "Credenciais inválidas");
      return res.status(401).json({ error: "Usuário ou senha inválidos" });
    }

    logs.logAction(user.username, "login", "Login no painel");

    res.json({
      ok: true,
      token: session.createSession(user.username, user.role),
      user: {
        username: user.username,
        nome: user.nome || storage.readProfile().nome || user.username,
        role: user.role || "administrador",
      },
    });
  });

  app.post("/api/auth/logout", limits.adminAuth, auth.checkAdmin, function (req, res) {
    if (req.adminToken) {
      session.revokeSession(req.adminToken);
    }
    logs.logAction(req.adminUser, "logout", "Logout do painel");
    res.json({ ok: true });
  });

  app.post("/api/analytics/track", limits.general, function (req, res) {
    try {
      var origin = "";
      if (req.headers.referer) {
        try {
          origin = new URL(req.headers.referer).origin;
        } catch (_e) { /* ignore */ }
      }
      var result = analytics.trackEvent(req.body || {}, { referrerOrigin: origin });
      if (!result.ok) return res.status(400).json(result);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error: security.publicErrorMessage(err, "Erro ao registrar evento"),
      });
    }
  });

  app.get("/api/admin/dashboard", limits.adminAuth, auth.checkAdmin, function (_req, res) {
    try {
      var cars = resolveCars();
      var leads = storage.readLeads();
      var clients = storage.readClients();
      var stats = storage.readAnalytics();
      res.json(
        dashboardErp.buildExtendedDashboard(
          cars,
          leads,
          clients,
          stats,
          promissories.readPromissories()
        )
      );
    } catch (err) {
      res.status(500).json({
        error: security.publicErrorMessage(err, "Erro ao carregar dashboard"),
      });
    }
  });

  app.get("/api/admin/analytics", limits.adminAuth, auth.checkAdmin, function (_req, res) {
    try {
      res.json(storage.readAnalytics());
    } catch (err) {
      res.status(500).json({
        error: security.publicErrorMessage(err, "Erro ao carregar estatísticas"),
      });
    }
  });

  app.get("/api/admin/messages", limits.adminAuth, auth.checkAdmin, function (_req, res) {
    try {
      res.json(storage.readMessages());
    } catch (err) {
      res.status(500).json({
        error: security.publicErrorMessage(err, "Erro ao carregar mensagens"),
      });
    }
  });

  app.put("/api/admin/messages/:id/read", limits.adminAuth, auth.checkAdmin, function (req, res) {
    var id = parseInt(req.params.id, 10);
    var messages = storage.readMessages();
    var idx = messages.findIndex(function (m) {
      return m.id === id;
    });
    if (idx === -1) return res.status(404).json({ error: "Mensagem não encontrada" });
    messages[idx].lida = true;
    storage.writeMessages(messages);
    res.json({ ok: true });
  });

  app.get("/api/admin/clients", limits.adminAuth, auth.checkAdmin, function (_req, res) {
    res.json(storage.readClients());
  });

  app.post("/api/admin/clients", limits.adminAuth, auth.checkAdmin, function (req, res) {
    var result = validate.validateClient(req.body || {}, true);
    if (!result.ok) return res.status(400).json({ error: result.errors.join("; ") });
    var client = storage.addClient(result.value);
    res.status(201).json(client);
  });

  app.put("/api/admin/clients/:id", limits.adminAuth, auth.checkAdmin, function (req, res) {
    var id = parseInt(req.params.id, 10);
    var result = validate.validateClient(req.body || {}, false);
    if (!result.ok) return res.status(400).json({ error: result.errors.join("; ") });
    var patch = result.value;
    Object.keys(patch).forEach(function (k) {
      if (patch[k] === undefined) delete patch[k];
    });
    var updated = storage.updateClient(id, patch);
    if (!updated) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json(updated);
  });

  app.delete("/api/admin/clients/:id", limits.adminAuth, auth.checkAdmin, function (req, res) {
    var id = parseInt(req.params.id, 10);
    if (!storage.deleteClient(id)) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json({ ok: true });
  });

  app.put("/api/admin/leads/:id", limits.adminAuth, auth.checkAdmin, function (req, res) {
    var id = parseInt(req.params.id, 10);
    var result = validate.validateLeadUpdate(req.body || {});
    if (!result.ok) return res.status(400).json({ error: result.errors.join("; ") });
    var patch = result.value;
    Object.keys(patch).forEach(function (k) {
      if (patch[k] === undefined) delete patch[k];
    });
    var updated = storage.updateLead(id, patch);
    if (!updated) return res.status(404).json({ error: "Lead não encontrado" });
    res.json(updated);
  });

  app.get("/api/admin/cars/:id", limits.adminAuth, auth.checkAdmin, function (req, res) {
    var id = parseInt(req.params.id, 10);
    var car = resolveCars().find(function (c) {
      return c.id === id;
    });
    if (!car) return res.status(404).json({ error: "Veículo não encontrado" });
    res.json(car);
  });

  app.post("/api/admin/cars", limits.adminAuth, auth.checkAdmin, function (req, res) {
    var cars = resolveCars();
    var body = req.body || {};
    body.id = body.id || Date.now();
    var result = validate.validateCar(body, 0);
    if (!result.ok) return res.status(400).json({ error: result.errors.join("; ") });
    cars.unshift(result.value);
    storage.saveCarsWithSync(cars);
    logs.logAction(req.adminUser, "car.create", "Veículo " + result.value.id);
    res.status(201).json(result.value);
  });

  app.put("/api/admin/cars/:id", limits.adminAuth, auth.checkAdmin, function (req, res) {
    var id = parseInt(req.params.id, 10);
    var cars = resolveCars();
    var idx = cars.findIndex(function (c) {
      return c.id === id;
    });
    if (idx === -1) return res.status(404).json({ error: "Veículo não encontrado" });
    var prev = cars[idx];
    var merged = Object.assign({}, prev, req.body || {}, { id: id });
    var result = validate.validateCar(merged, idx);
    if (!result.ok) return res.status(400).json({ error: result.errors.join("; ") });
    var updated = result.value;
    updated.historicoPreco = Array.isArray(prev.historicoPreco) ? prev.historicoPreco.slice() : [];
    updated.historicoAlteracoes = Array.isArray(prev.historicoAlteracoes)
      ? prev.historicoAlteracoes.slice()
      : [];
    if (Number(prev.preco) !== Number(updated.preco)) {
      updated.historicoPreco.unshift({
        de: prev.preco,
        para: updated.preco,
        at: new Date().toISOString(),
        user: req.adminUser || "admin",
      });
      logs.logAction(req.adminUser, "car.price", "Veículo " + id + ": " + prev.preco + " → " + updated.preco);
    }
    updated.historicoAlteracoes.unshift({
      at: new Date().toISOString(),
      user: req.adminUser || "admin",
      campos: Object.keys(req.body || {}),
    });
    cars[idx] = updated;
    storage.saveCarsWithSync(cars);
    logs.logAction(req.adminUser, "car.update", "Veículo " + id);
    res.json(updated);
  });

  app.delete("/api/admin/cars/:id", limits.adminAuth, auth.checkAdmin, function (req, res) {
    var id = parseInt(req.params.id, 10);
    var cars = resolveCars().filter(function (c) {
      return c.id !== id;
    });
    if (cars.length === resolveCars().length) {
      return res.status(404).json({ error: "Veículo não encontrado" });
    }
    storage.saveCarsWithSync(cars);
    logs.logAction(req.adminUser, "car.delete", "Veículo " + id);
    res.json({ ok: true });
  });

  app.post("/api/admin/cars/:id/duplicate", limits.adminAuth, auth.checkAdmin, function (req, res) {
    var id = parseInt(req.params.id, 10);
    var source = resolveCars().find(function (c) {
      return c.id === id;
    });
    if (!source) return res.status(404).json({ error: "Veículo não encontrado" });
    var copy = Object.assign({}, source, {
      id: Date.now(),
      vendido: false,
      status: "disponivel",
      dataCadastro: new Date().toISOString(),
      slug: "",
    });
    var result = validate.validateCar(copy, 0);
    if (!result.ok) {
      return res.status(400).json({ error: result.errors.join("; ") });
    }
    var cars = resolveCars();
    cars.unshift(result.value);
    storage.saveCarsWithSync(cars);
    res.status(201).json(result.value);
  });

  app.post(
    "/api/admin/upload",
    limits.adminAuth,
    auth.checkAdmin,
    function (req, res, next) {
      upload.uploadMiddleware(req, res, function (err) {
        if (err) {
          return res.status(400).json({
            error: security.publicErrorMessage(err, "Falha no upload"),
          });
        }
        next();
      });
    },
    async function (req, res) {
      try {
        var files = req.files || [];
        if (!files.length) return res.status(400).json({ error: "Nenhuma imagem enviada" });
        var prefix = String(req.body.prefix || "veiculo").slice(0, 40);
        var kind = String(req.body.kind || "car").slice(0, 20);
        var paths = await upload.saveUploadedFiles(files, prefix, kind);
        logs.logAction(req.adminUser, "upload", kind + " x" + paths.length);
        res.json({ ok: true, paths: paths });
      } catch (err) {
        res.status(500).json({
          error: security.publicErrorMessage(err, "Erro ao processar imagens"),
        });
      }
    }
  );

  app.get("/api/admin/profile", limits.adminAuth, auth.checkAdmin, function (req, res) {
    res.json(
      Object.assign({}, storage.readProfile(), {
        username: auth.getAdminUsername(),
      })
    );
  });

  app.put("/api/admin/profile", limits.adminAuth, auth.checkAdmin, function (req, res) {
    var body = req.body || {};
    var profile = Object.assign({}, storage.readProfile(), {
      nome: String(body.nome || "").trim().slice(0, 120) || storage.readProfile().nome,
      email: String(body.email || "").trim().slice(0, 120),
      telefone: String(body.telefone || "").trim().slice(0, 24),
      cargo: String(body.cargo || "").trim().slice(0, 80),
    });
    storage.writeProfile(profile);
    res.json(profile);
  });

  app.post("/api/admin/sitemap/generate", limits.adminAuth, auth.checkAdmin, function (req, res) {
    try {
      var siteUrl =
        security.sanitizeSiteUrl(req.body.siteUrl || "") ||
        "https://www.novaeraveiculosbm.com.br";
      var xml = seo.buildSitemapXml(resolveCars(), siteUrl);
      fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf8");
      res.json({ ok: true, urlCount: resolveCars().length + 1 });
    } catch (err) {
      res.status(500).json({
        error: security.publicErrorMessage(err, "Erro ao gerar sitemap"),
      });
    }
  });
};
