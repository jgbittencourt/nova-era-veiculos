"use strict";

/**
 * Sincroniza server/lib/inventory.js → assets/js/inventory-engine.js
 */
var fs = require("fs");
var path = require("path");

var src = path.join(__dirname, "..", "lib", "inventory.js");
var dest = path.join(__dirname, "..", "..", "assets", "js", "inventory-engine.js");

var code = fs.readFileSync(src, "utf8");
code = code.replace("module.exports = {", "var _exports = {");
code = code.replace(/module\.exports/g, "_exports");

var out =
  "(function (global) {\n" +
  '  "use strict";\n\n' +
  code +
  "\n  global.NOVA_ERA_INVENTORY = _exports;\n})(window);\n";

fs.writeFileSync(dest, out, "utf8");
console.log("Sincronizado: inventory.js → inventory-engine.js");
