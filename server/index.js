"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

var express = require("express");
var cors = require("cors");
var path = require("path");
var storage = require("./lib/storage");
var auth = require("./lib/auth");
var openai = require("./lib/openai");
var inventory = require("./lib/inventory");
var security = require("./lib/security");
var validate = require("./lib/validate");

var app = express();
var PORT = process.env.PORT || 3001;
var ROOT = path.join(__dirname, "..");
var limits = security.createRateLimiters();

app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.use(security.createHelmetMiddleware());
app.use(security.blockSensitivePaths);
app.use(cors(security.createCorsOptions()));
app.use(express.json({ limit: "512kb" }));
app.use(limits.general);

app.use(express.static(ROOT, {
  index: "index.html",
  dotfiles: "deny",
}));
app.use("/admin", express.static(path.join(ROOT, "admin"), { dotfiles: "deny" }));

app.get("/api/health", function (_req, res) {
  res.json({ ok: true });
});

app.get("/api/config/public", function (_req, res) {
  try {
    var config = storage.readConfig();
    res.json({
      loja: config.loja,
      chat: config.chat,
    });
  } catch (err) {
    res.status(500).json({
      error: security.publicErrorMessage(err, "Erro ao carregar configuração"),
    });
  }
});

app.get("/api/config", limits.adminAuth, auth.checkAdmin, function (_req, res) {
  try {
    res.json(storage.readConfig());
  } catch (err) {
    res.status(500).json({
      error: security.publicErrorMessage(err, "Erro ao carregar configuração"),
    });
  }
});

app.put("/api/config", limits.adminAuth, auth.checkAdmin, function (req, res) {
  try {
    var existing = storage.readConfig();
    var result = validate.validateConfig(req.body, existing);
    if (!result.ok) {
      return res.status(400).json({ error: result.errors.join("; ") });
    }
    storage.writeConfig(result.value);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({
      error: security.publicErrorMessage(err, "Erro ao salvar configuração"),
    });
  }
});

app.get("/api/cars", function (_req, res) {
  try {
    res.json(resolveCars());
  } catch (err) {
    res.status(500).json({
      error: security.publicErrorMessage(err, "Erro ao carregar estoque"),
    });
  }
});

app.post("/api/inventory/query", limits.inventory, function (req, res) {
  try {
    var body = req.body || {};
    var query = String(body.query || "").trim().slice(0, 500);
    var cars = resolveCars();
    var config = storage.readConfig();
    var analysis = inventory.analyzeQuery(query, cars, config);
    var siteUrl = security.sanitizeSiteUrl(body.siteUrl || "");
    res.json({
      intent: analysis.intent,
      notFound: analysis.notFound,
      directReply: analysis.directReply,
      useDirectReply: analysis.useDirectReply,
      action: analysis.action,
      actionHint: analysis.actionHint,
      vehicles: analysis.vehicles.map(function (car) {
        return inventory.toPublicVehicle(car, siteUrl);
      }),
      total: cars.length,
    });
  } catch (err) {
    res.status(500).json({
      error: security.publicErrorMessage(err, "Erro ao consultar estoque"),
    });
  }
});

app.put("/api/cars", limits.adminAuth, auth.checkAdmin, function (req, res) {
  try {
    var result = validate.validateCars(req.body);
    if (!result.ok) {
      return res.status(400).json({ error: result.errors.join("; ") });
    }
    storage.writeCars(result.value);
    storage.writeCarsJs(result.value);
    res.json({ ok: true, count: result.value.length });
  } catch (err) {
    res.status(500).json({
      error: security.publicErrorMessage(err, "Erro ao salvar veículos"),
    });
  }
});

app.get("/api/leads", limits.adminAuth, auth.checkAdmin, function (_req, res) {
  try {
    res.json(storage.readLeads());
  } catch (err) {
    res.status(500).json({
      error: security.publicErrorMessage(err, "Erro ao carregar leads"),
    });
  }
});

app.post("/api/leads", limits.leads, function (req, res) {
  try {
    var result = validate.validateLead(req.body || {});
    if (!result.ok) {
      return res.status(400).json({ error: result.errors.join("; ") });
    }
    var lead = storage.addLead(result.value);
    res.status(201).json({
      id: lead.id,
      ok: true,
    });
  } catch (err) {
    res.status(500).json({
      error: security.publicErrorMessage(err, "Erro ao registrar contato"),
    });
  }
});

app.post("/api/chat", limits.chat, async function (req, res) {
  try {
    var body = req.body || {};
    var messageResult = validate.validateChatMessages(body.messages);
    if (!messageResult.ok) {
      return res.status(400).json({ error: messageResult.errors.join("; ") });
    }

    var messages = messageResult.value;
    var config = storage.readConfig();
    var cars = resolveCars();
    var lastUserMsg = "";
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserMsg = messages[i].content;
        break;
      }
    }

    var analysis = inventory.analyzeQuery(lastUserMsg, cars, config);
    var inventoryContext = inventory.buildInventoryContext(analysis, cars);
    var systemPrompt = storage.buildSystemPrompt(config, cars, inventoryContext);

    var reply;
    var preferDirect = analysis.useDirectReply && analysis.directReply;

    if (preferDirect) {
      reply = analysis.directReply;
    } else if (process.env.OPENAI_API_KEY) {
      try {
        reply = await openai.chatCompletion(systemPrompt, messages);
      } catch (aiErr) {
        if (analysis.directReply) {
          reply = analysis.directReply;
        } else {
          throw aiErr;
        }
      }
    } else if (analysis.directReply) {
      reply = analysis.directReply;
    } else {
      reply = (config.chat && config.chat.mensagemFallback) ||
        "Posso encaminhar você diretamente para nossa equipe no WhatsApp.";
    }

    var fallback = (config.chat && config.chat.mensagemFallback) ||
      "Posso encaminhar você diretamente para nossa equipe no WhatsApp.";

    var siteUrl = security.sanitizeSiteUrl(body.siteUrl || "");
    var publicVehicles = analysis.vehicles.map(function (car) {
      return inventory.toPublicVehicle(car, siteUrl);
    });

    res.json({
      reply: reply,
      fallback: fallback,
      whatsappNumero: (config.loja && config.loja.whatsappNumero) || "5524992195829",
      vehicles: publicVehicles,
      inventoryIntent: analysis.intent,
      notFound: analysis.notFound,
      action: analysis.action || null,
      actionHint: analysis.actionHint || "",
    });
  } catch (err) {
    console.error("Chat error:", err.message);
    var config = storage.readConfig();
    var fallbackMsg =
      (config.chat && config.chat.mensagemFallback) ||
      "Posso encaminhar você diretamente para nossa equipe no WhatsApp.";
    res.status(500).json({
      error: security.publicErrorMessage(err, "Erro ao processar mensagem"),
      reply: fallbackMsg,
      fallback: true,
    });
  }
});

function resolveCars() {
  var cars = storage.readCars();
  if (cars.length === 0) {
    cars = syncCarsFromJsIfNeeded();
  }
  return cars;
}

function syncCarsFromJsIfNeeded() {
  try {
    var vm = require("vm");
    var fs = require("fs");
    var carsJsPath = path.join(ROOT, "assets", "js", "cars.js");
    if (!fs.existsSync(carsJsPath)) return [];
    var code = fs.readFileSync(carsJsPath, "utf8");
    var sandbox = { window: {} };
    vm.runInNewContext(code, sandbox, { timeout: 1000 });
    var cars = sandbox.window.NOVA_ERA_CARS || [];
    if (cars.length > 0) {
      var validated = validate.validateCars(cars);
      if (validated.ok) {
        storage.writeCars(validated.value);
        return validated.value;
      }
    }
    return cars;
  } catch (_err) {
    return [];
  }
}

app.use(function (_req, res) {
  res.status(404).json({ error: "Rota não encontrada" });
});

app.use(function (err, _req, res, _next) {
  if (err && err.message === "Origem não permitida") {
    return res.status(403).json({ error: "Origem não permitida" });
  }
  console.error("Unhandled error:", err && err.message ? err.message : err);
  res.status(500).json({ error: "Erro interno do servidor" });
});

app.listen(PORT, function () {
  console.log("Nova Era API rodando em http://localhost:" + PORT);
  console.log("Site: http://localhost:" + PORT + "/");
  console.log("Admin: http://localhost:" + PORT + "/admin/");
  syncCarsFromJsIfNeeded();
});
