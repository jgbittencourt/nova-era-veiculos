"use strict";

/**
 * Smoke test local — valida módulos críticos sem subir servidor HTTP.
 * Uso: node scripts/smoke-test.js
 */
var assert = require("assert");
var validate = require("../lib/validate");
var inventory = require("../lib/inventory");
var seo = require("../lib/seo");
var analytics = require("../lib/analytics");
var storage = require("../lib/storage");
var finance = require("../lib/finance");
var promissories = require("../lib/promissories");
var dashboardErp = require("../lib/dashboard-erp");
var employees = require("../lib/employees");

var sampleCar = {
  id: 999001,
  marca: "Teste",
  modelo: "Audit",
  ano: 2020,
  preco: 45000,
  categoria: "hatch",
  combustivel: "Flex 1.0",
  cambio: "Manual",
  imagem: "assets/img/carros/honda-cb300-0.png",
  imagens: ["assets/img/carros/honda-cb300-0.png"],
};

var soldCar = Object.assign({}, sampleCar, { id: 999002, vendido: true, status: "vendido" });

function testValidateCar() {
  var ok = validate.validateCar(sampleCar, 0);
  assert.ok(ok.ok, "validateCar deve aceitar veículo válido");
  var bad = validate.validateCar({ id: 0 }, 0);
  assert.ok(!bad.ok, "validateCar deve rejeitar id inválido");
}

function testSoldFilter() {
  assert.equal(inventory.availableCars([sampleCar, soldCar]).length, 1);
  var analysis = inventory.analyzeQuery("carros disponiveis", [sampleCar, soldCar], {});
  assert.ok(analysis.intent, "analyzeQuery deve responder com estoque disponível");
}

function testSeo() {
  var enriched = seo.enrichCarSeo(sampleCar);
  assert.ok(enriched.slug, "slug deve ser gerado");
  assert.ok(enriched.metaDescription, "metaDescription deve ser gerada");
}

function testAnalytics() {
  var r = analytics.trackEvent({ type: "pageview" }, {});
  assert.ok(r.ok, "track pageview");
  var bad = analytics.trackEvent({ type: "hack" }, {});
  assert.ok(!bad.ok, "rejeita evento inválido");
}

function testLead() {
  var r = validate.validateLead({ nome: "João", telefone: "24999999999" });
  assert.ok(r.ok, "lead válido");
}

function testConfigRoundtrip() {
  var cfg = storage.readConfig();
  assert.ok(cfg.loja, "config loja existe");
}

function testErpModules() {
  var cars = storage.readCars();
  var summary = finance.buildSummary(cars, []);
  assert.ok(typeof summary.saldo === "number", "finance summary");
  var beforeProm = promissories.readPromissories();
  var prom = promissories.createPromissory({
    clienteNome: "Teste Smoke",
    veiculoTitulo: "Carro Teste",
    valorTotal: 10000,
    entrada: 2000,
    qtdParcelas: 4,
  });
  assert.ok(prom.id, "promissory created");
  var pay = promissories.payInstallment(prom.id, 1);
  assert.ok(pay && pay.parcela.pago, "parcela paga");
  promissories.writePromissories(beforeProm);
  var dash = dashboardErp.buildExtendedDashboard(cars, [], [], storage.readAnalytics(), beforeProm);
  assert.ok(dash.finance, "dashboard erp finance");
  assert.ok(employees.canAccess("administrador", "financeiro"), "rbac admin");
}

testValidateCar();
testSoldFilter();
testSeo();
testAnalytics();
testLead();
testConfigRoundtrip();
testErpModules();

console.log("OK — smoke-test passou (" + new Date().toISOString() + ")");
