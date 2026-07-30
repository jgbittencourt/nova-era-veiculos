"use strict";

var storage = require("../lib/storage");
var auth = require("../lib/auth");
var finance = require("../lib/finance");
var promissories = require("../lib/promissories");
var contracts = require("../lib/contracts");
var agenda = require("../lib/agenda");
var employees = require("../lib/employees");
var backup = require("../lib/backup");
var logs = require("../lib/logs");
var security = require("../lib/security");

module.exports = function registerErpRoutes(app, deps) {
  var limits = deps.limits;
  var resolveCars = deps.resolveCars;

  function audit(req, action, detail, meta) {
    logs.logAction(req.adminUser || "system", action, detail, meta);
  }

  app.get("/api/admin/finance", limits.adminAuth, auth.checkAdmin, function (_req, res) {
    try {
      var fin = finance.readFinance();
      var summary = finance.buildSummary(resolveCars(), promissories.readPromissories());
      res.json({ data: fin, summary: summary });
    } catch (err) {
      res.status(500).json({ error: security.publicErrorMessage(err, "Erro financeiro") });
    }
  });

  app.post("/api/admin/finance/transaction", limits.adminAuth, auth.checkAdmin, auth.requireModule("financeiro"), function (req, res) {
    try {
      var tipo = String(req.body.tipo || "receita");
      var entry = finance.addTransaction(tipo, req.body || {});
      audit(req, "finance.transaction", tipo + " R$ " + entry.valor);
      res.status(201).json(entry);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/finance/conta", limits.adminAuth, auth.checkAdmin, auth.requireModule("financeiro"), function (req, res) {
    try {
      var kind = req.body.kind === "pagar" ? "pagar" : "receber";
      var entry = finance.addConta(kind, req.body || {});
      audit(req, "finance.conta", kind + " " + entry.descricao);
      res.status(201).json(entry);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put("/api/admin/finance/capital", limits.adminAuth, auth.checkAdmin, auth.requireModule("financeiro"), function (req, res) {
    var fin = finance.readFinance();
    fin.capitalEmpresa = Number(req.body.capitalEmpresa) || 0;
    finance.writeFinance(fin);
    audit(req, "finance.capital", "Capital atualizado");
    res.json({ ok: true, capitalEmpresa: fin.capitalEmpresa });
  });

  app.get("/api/admin/finance/export", limits.adminAuth, auth.checkAdmin, auth.requireModule("financeiro"), function (_req, res) {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="fluxo-caixa.csv"');
    res.send("\uFEFF" + finance.exportCsv());
  });

  app.get("/api/admin/promissories", limits.adminAuth, auth.checkAdmin, function (_req, res) {
    res.json(promissories.readPromissories());
  });

  app.post("/api/admin/promissories", limits.adminAuth, auth.checkAdmin, auth.requireModule("promissorias"), function (req, res) {
    try {
      var entry = promissories.createPromissory(req.body || {});
      audit(req, "promissory.create", entry.clienteNome + " — R$ " + entry.valorTotal);
      res.status(201).json(entry);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/promissories/:id/pay", limits.adminAuth, auth.checkAdmin, auth.requireModule("promissorias"), function (req, res) {
    var id = parseInt(req.params.id, 10);
    var n = parseInt(req.body.parcelaN, 10);
    var result = promissories.payInstallment(id, n);
    if (!result) return res.status(404).json({ error: "Parcela não encontrada ou já paga" });
    try {
      finance.addTransaction("receita", {
        descricao: "Parcela " + n + " — " + result.promissory.clienteNome,
        categoria: "promissoria",
        valor: result.parcela.valor,
      });
    } catch (err) {
      return res.status(500).json({ error: "Parcela registrada, mas falha no financeiro: " + err.message });
    }
    audit(req, "promissory.pay", "Parcela " + n + " promissória " + id);
    res.json({
      ok: true,
      promissory: result.promissory,
      receipt: promissories.buildReceipt(result.promissory, result.parcela),
    });
  });

  app.post("/api/admin/promissories/:id/cancel", limits.adminAuth, auth.checkAdmin, auth.requireModule("promissorias"), function (req, res) {
    var id = parseInt(req.params.id, 10);
    var n = parseInt(req.body.parcelaN, 10);
    var updated = promissories.cancelInstallment(id, n);
    if (!updated) return res.status(404).json({ error: "Parcela não encontrada" });
    audit(req, "promissory.cancel", "Cancelou parcela " + n + " — " + id);
    res.json(updated);
  });

  app.post("/api/admin/contracts/generate", limits.adminAuth, auth.checkAdmin, auth.requireModule("contratos"), function (req, res) {
    var type = String(req.body.type || "venda");
    var config = storage.readConfig();
    var cars = resolveCars();
    var clients = storage.readClients();
    var prom = null;
    if (req.body.promissoryId) {
      prom = promissories.readPromissories().find(function (p) {
        return p.id === parseInt(req.body.promissoryId, 10);
      });
    }
    var cliente = clients.find(function (c) {
      return c.id === (req.body.clienteId || (prom && prom.clienteId));
    });
    var veiculo = cars.find(function (c) {
      return c.id === (req.body.veiculoId || (prom && prom.veiculoId));
    });
    var doc = contracts.buildContract(type, {
      loja: config.loja,
      cliente: cliente,
      veiculo: veiculo
        ? { titulo: veiculo.marca + " " + veiculo.modelo + " " + veiculo.ano, preco: veiculo.preco }
        : null,
      promissory: prom,
      valor: req.body.valor,
      parcela: req.body.parcela,
    });
    audit(req, "contract.generate", type);
    res.json(doc);
  });

  app.get("/api/admin/agenda", limits.adminAuth, auth.checkAdmin, function (_req, res) {
    res.json(agenda.buildAgendaView(storage.readClients()));
  });

  app.post("/api/admin/agenda", limits.adminAuth, auth.checkAdmin, function (req, res) {
    var entry = agenda.addEvent(req.body || {});
    audit(req, "agenda.create", entry.titulo);
    res.status(201).json(entry);
  });

  app.delete("/api/admin/agenda/:id", limits.adminAuth, auth.checkAdmin, function (req, res) {
    var id = parseInt(req.params.id, 10);
    if (!agenda.deleteEvent(id)) return res.status(404).json({ error: "Evento não encontrado" });
    audit(req, "agenda.delete", String(id));
    res.json({ ok: true });
  });

  app.get("/api/admin/employees", limits.adminAuth, auth.checkAdmin, auth.requireModule("funcionarios"), function (_req, res) {
    var list = employees.readEmployees().map(function (e) {
      var copy = Object.assign({}, e);
      delete copy.passwordHash;
      return copy;
    });
    res.json(list);
  });

  app.post("/api/admin/employees", limits.adminAuth, auth.checkAdmin, auth.requireModule("funcionarios"), function (req, res) {
    var body = employees.sanitizeEmployee(req.body || {}, true);
    if (!body.username || !body.nome) {
      return res.status(400).json({ error: "Nome e usuário obrigatórios" });
    }
    if (!body.passwordHash) return res.status(400).json({ error: "Senha obrigatória" });
    var list = employees.readEmployees();
    if (list.some(function (e) { return e.username === body.username; })) {
      return res.status(400).json({ error: "Usuário já existe" });
    }
    body.id = Date.now();
    list.unshift(body);
    employees.writeEmployees(list);
    audit(req, "employee.create", body.username);
    delete body.passwordHash;
    res.status(201).json(body);
  });

  app.put("/api/admin/employees/:id", limits.adminAuth, auth.checkAdmin, auth.requireModule("funcionarios"), function (req, res) {
    var id = parseInt(req.params.id, 10);
    var list = employees.readEmployees();
    var idx = list.findIndex(function (e) { return e.id === id; });
    if (idx === -1) return res.status(404).json({ error: "Funcionário não encontrado" });
    var patch = employees.sanitizeEmployee(req.body || {}, false);
    list[idx] = Object.assign({}, list[idx], patch, { id: id });
    employees.writeEmployees(list);
    audit(req, "employee.update", list[idx].username);
    var out = Object.assign({}, list[idx]);
    delete out.passwordHash;
    res.json(out);
  });

  app.delete("/api/admin/employees/:id", limits.adminAuth, auth.checkAdmin, auth.requireModule("funcionarios"), function (req, res) {
    var id = parseInt(req.params.id, 10);
    var list = employees.readEmployees().filter(function (e) { return e.id !== id; });
    if (list.length === employees.readEmployees().length) {
      return res.status(404).json({ error: "Funcionário não encontrado" });
    }
    employees.writeEmployees(list);
    audit(req, "employee.delete", String(id));
    res.json({ ok: true });
  });

  app.get("/api/admin/logs", limits.adminAuth, auth.checkAdmin, auth.requireModule("logs"), function (req, res) {
    var limit = Math.min(500, parseInt(req.query.limit, 10) || 100);
    res.json(logs.readLogs().slice(0, limit));
  });

  app.get("/api/admin/backups", limits.adminAuth, auth.checkAdmin, auth.requireModule("backup"), function (_req, res) {
    res.json(backup.listBackups());
  });

  app.post("/api/admin/backups", limits.adminAuth, auth.checkAdmin, auth.requireModule("backup"), function (req, res) {
    var info = backup.createBackup();
    audit(req, "backup.create", info.name);
    res.status(201).json(info);
  });

  app.post("/api/admin/backups/restore", limits.adminAuth, auth.checkAdmin, auth.requireModule("backup"), function (req, res) {
    try {
      var result = backup.restoreBackup(String(req.body.name || ""));
      audit(req, "backup.restore", req.body.name);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/admin/promissories/report", limits.adminAuth, auth.checkAdmin, function (_req, res) {
    res.json(promissories.buildReport());
  });

  app.get("/api/admin/backups/:name/validate", limits.adminAuth, auth.checkAdmin, auth.requireModule("backup"), function (req, res) {
    try {
      res.json(backup.inspectBackup(req.params.name));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/admin/cars/:id/history", limits.adminAuth, auth.checkAdmin, function (req, res) {
    var id = parseInt(req.params.id, 10);
    var car = resolveCars().find(function (c) { return c.id === id; });
    if (!car) return res.status(404).json({ error: "Veículo não encontrado" });
    res.json({
      historicoPreco: car.historicoPreco || [],
      historicoAlteracoes: car.historicoAlteracoes || [],
    });
  });
};
