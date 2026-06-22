"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

var express = require("express");
var cors = require("cors");
var path = require("path");
var storage = require("./lib/storage");
var auth = require("./lib/auth");
var openai = require("./lib/openai");
var inventory = require("./lib/inventory");

var app = express();
var PORT = process.env.PORT || 3001;
var ROOT = path.join(__dirname, "..");

var allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(function (o) {
    return o.trim();
  })
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
  })
);
app.use(express.json({ limit: "2mb" }));

app.use(express.static(ROOT));
app.use("/admin", express.static(path.join(ROOT, "admin")));

app.get("/api/health", function (_req, res) {
  res.json({
    ok: true,
    openai: !!process.env.OPENAI_API_KEY,
    admin: !!process.env.ADMIN_PASSWORD,
  });
});

app.get("/api/config/public", function (_req, res) {
  try {
    var config = storage.readConfig();
    res.json({
      loja: config.loja,
      chat: config.chat,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/config", auth.checkAdmin, function (_req, res) {
  try {
    res.json(storage.readConfig());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/config", auth.checkAdmin, function (req, res) {
  try {
    storage.writeConfig(req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/cars", function (_req, res) {
  try {
    res.json(resolveCars());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/inventory/query", function (req, res) {
  try {
    var body = req.body || {};
    var cars = resolveCars(body.cars);
    var config = storage.readConfig();
    var analysis = inventory.analyzeQuery(body.query || "", cars, config);
    res.json({
      intent: analysis.intent,
      notFound: analysis.notFound,
      directReply: analysis.directReply,
      useDirectReply: analysis.useDirectReply,
      action: analysis.action,
      actionHint: analysis.actionHint,
      vehicles: analysis.vehicles.map(function (car) {
        return inventory.toPublicVehicle(car, body.siteUrl || "");
      }),
      total: cars.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/cars", auth.checkAdmin, function (req, res) {
  try {
    var cars = req.body;
    if (!Array.isArray(cars)) {
      return res.status(400).json({ error: "Esperado array de veículos" });
    }
    storage.writeCars(cars);
    storage.writeCarsJs(cars);
    res.json({ ok: true, count: cars.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/leads", auth.checkAdmin, function (_req, res) {
  try {
    res.json(storage.readLeads());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/leads", function (req, res) {
  try {
    var body = req.body || {};
    if (!body.nome || !body.telefone) {
      return res.status(400).json({ error: "Nome e telefone são obrigatórios" });
    }
    var lead = storage.addLead(body);
    res.status(201).json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chat", async function (req, res) {
  try {
    var body = req.body || {};
    var messages = body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Mensagens inválidas" });
    }

    var config = storage.readConfig();
    var cars = resolveCars(body.cars);
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

    var publicVehicles = analysis.vehicles.map(function (car) {
      return inventory.toPublicVehicle(car, body.siteUrl || "");
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
      error: err.message,
      reply: fallbackMsg,
      fallback: true,
    });
  }
});

function resolveCars(clientCars) {
  if (Array.isArray(clientCars) && clientCars.length > 0) {
    return clientCars;
  }
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
    vm.runInNewContext(code, sandbox);
    var cars = sandbox.window.NOVA_ERA_CARS || [];
    if (cars.length > 0) {
      storage.writeCars(cars);
    }
    return cars;
  } catch (_err) {
    return [];
  }
}

app.listen(PORT, function () {
  console.log("Nova Era API rodando em http://localhost:" + PORT);
  console.log("Site: http://localhost:" + PORT + "/");
  console.log("Admin: http://localhost:" + PORT + "/admin/");
  syncCarsFromJsIfNeeded();
});
