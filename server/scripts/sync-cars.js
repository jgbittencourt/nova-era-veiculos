"use strict";

/**
 * Sincroniza assets/js/cars.js → data/cars.json
 * Uso: node scripts/sync-cars.js
 */

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var carsJsPath = path.join(__dirname, "..", "..", "assets", "js", "cars.js");
var carsJsonPath = path.join(__dirname, "..", "..", "data", "cars.json");

var code = fs.readFileSync(carsJsPath, "utf8");
var sandbox = { window: {} };
vm.runInNewContext(code, sandbox);

var cars = sandbox.window.NOVA_ERA_CARS;
if (!Array.isArray(cars)) {
  console.error("Não foi possível ler NOVA_ERA_CARS de cars.js");
  process.exit(1);
}

fs.mkdirSync(path.dirname(carsJsonPath), { recursive: true });
fs.writeFileSync(carsJsonPath, JSON.stringify(cars, null, 2) + "\n", "utf8");
console.log("Sincronizado: " + cars.length + " veículos → data/cars.json");
