"use strict";

var fs = require("fs");
var path = require("path");

var DATA_DIR = path.join(__dirname, "..", "..", "data");
var CARS_JS_PATH = path.join(__dirname, "..", "..", "assets", "js", "cars.js");

function filePath(name) {
  return path.join(DATA_DIR, name);
}

function readJson(name, fallback) {
  try {
    var raw = fs.readFileSync(filePath(name), "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

function writeJson(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2) + "\n", "utf8");
}

function readConfig() {
  return readJson("config.json");
}

function writeConfig(config) {
  writeJson("config.json", config);
}

function readLeads() {
  return readJson("leads.json", []);
}

function writeLeads(leads) {
  writeJson("leads.json", leads);
}

function readCars() {
  return readJson("cars.json", []);
}

function writeCars(cars) {
  writeJson("cars.json", cars);
}

function writeCarsJs(cars) {
  var header =
    "/**\n" +
    " * Estoque Nova Era — gerado/atualizado pelo painel Nova IA\n" +
    " * Fotos em assets/img/carros/\n" +
    " */\n";
  var body = "window.NOVA_ERA_CARS = " + JSON.stringify(cars, null, 2) + ";\n";
  fs.mkdirSync(path.dirname(CARS_JS_PATH), { recursive: true });
  fs.writeFileSync(CARS_JS_PATH, header + body, "utf8");
}

function addLead(lead) {
  var leads = readLeads();
  var entry = {
    id: Date.now(),
    nome: lead.nome || "",
    telefone: lead.telefone || "",
    interesse: lead.interesse || "",
    dataContato: new Date().toISOString(),
    origem: lead.origem || "nova-ia",
  };
  leads.unshift(entry);
  writeLeads(leads);
  return entry;
}

function formatMoney(n) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
}

function buildInventorySummary(cars) {
  if (!Array.isArray(cars) || cars.length === 0) {
    return "Nenhum veículo cadastrado no momento.";
  }
  return cars
    .map(function (car) {
      var title = car.marca + " " + car.modelo + " " + car.ano;
      var preco = formatMoney(car.preco);
      var cat = car.categoria || "outros";
      var oferta = car.emOferta ? " [EM OFERTA]" : "";
      return "- " + title + " — " + preco + " (" + cat + ")" + oferta;
    })
    .join("\n");
}

function buildSystemPrompt(config, cars, inventoryContext) {
  var loja = config.loja || {};
  var fin = config.financiamento || {};
  var pag = config.pagamento || {};
  var trocas = config.trocas || {};
  var faqs = Array.isArray(config.faqs) ? config.faqs : [];

  var faqText = faqs
    .map(function (f) {
      return "P: " + f.pergunta + "\nR: " + f.resposta;
    })
    .join("\n\n");

  var pagamentoText = Array.isArray(pag.formas)
    ? pag.formas.map(function (f) {
        return "- " + f;
      }).join("\n")
    : "";

  return (
    "Você é a Nova IA, assistente virtual da " +
    (loja.nome || "Nova Era Veículos") +
    ", loja de seminovos em Barra Mansa, RJ.\n\n" +
    "PERSONALIDADE: Amigável, profissional, objetiva. Responda sempre em português brasileiro, com frases curtas.\n\n" +
    "DADOS DA LOJA:\n" +
    "- Endereço: " + (loja.endereco || "") + "\n" +
    "- Horário: " + (loja.horario || "") + "\n" +
    "- WhatsApp: " + (loja.whatsappExibicao || "") + "\n" +
    "- Instagram: " + (loja.instagram || "") + "\n" +
    "- Telefone: " + (loja.telefone || "") + "\n\n" +
    "FINANCIAMENTO:\n" + (fin.descricao || "") + "\n" +
    (fin.entradaMinima || "") + "\n" +
    (fin.parcelas || "") + "\n\n" +
    "FORMAS DE PAGAMENTO:\n" + pagamentoText + "\n\n" +
    "TROCAS:\n" + (trocas.descricao || "") + "\n\n" +
    "ESTOQUE COMPLETO (fonte: anúncios reais do site — use APENAS estes dados):\n" +
    buildInventorySummary(cars) +
    "\n\n" +
    (inventoryContext ? inventoryContext + "\n\n" : "") +
    "PERGUNTAS FREQUENTES:\n" + faqText +
    "\n\n" +
    "REGRAS DO ESTOQUE (OBRIGATÓRIAS):\n" +
    "1. SEMPRE consulte o estoque acima antes de responder sobre veículos, preços ou disponibilidade.\n" +
    "2. NUNCA dê respostas genéricas quando os dados estiverem no estoque — cite marca, modelo, ano e preço exatos.\n" +
    "3. Se o veículo não estiver no estoque, diga: \"Não encontrei esse veículo em nosso estoque atual.\"\n" +
    "4. Para orçamento, liste veículos na faixa (±15%) com preços reais.\n" +
    "5. Para \"mais barato\", informe o veículo de menor preço do estoque.\n" +
    "6. Para motos, liste apenas categoria moto. Para carros, exclua motos.\n" +
    "7. Os cards com foto e link serão exibidos automaticamente — sua resposta deve complementar, não repetir tudo.\n" +
    "8. Se não souber responder (fora do estoque/loja), diga: \"Posso encaminhar você diretamente para nossa equipe no WhatsApp.\"\n" +
    "9. Nunca invente veículos, preços ou condições."
  );
}

module.exports = {
  readConfig: readConfig,
  writeConfig: writeConfig,
  readLeads: readLeads,
  writeLeads: writeLeads,
  readCars: readCars,
  writeCars: writeCars,
  writeCarsJs: writeCarsJs,
  addLead: addLead,
  buildSystemPrompt: buildSystemPrompt,
  buildInventorySummary: buildInventorySummary,
};
