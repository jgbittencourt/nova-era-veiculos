"use strict";

var storage = require("./storage");

function readPromissories() {
  return storage.readJsonFile("promissories.json", []);
}

function writePromissories(list) {
  storage.writeJsonFile("promissories.json", list);
}

function parseMoney(v) {
  var n = Number(v);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100) / 100;
}

function assertMoney(v, label) {
  var n = parseMoney(v);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error((label || "Valor") + " inválido");
  }
  return n;
}

function buildParcelas(total, count, firstDue) {
  if (count < 1) throw new Error("Quantidade de parcelas inválida");
  if (total <= 0) throw new Error("Valor restante deve ser positivo");

  var parcelas = [];
  var baseCents = Math.floor((total * 100) / count);
  var accumulated = 0;
  var due = firstDue ? new Date(firstDue + "T12:00:00") : new Date();

  if (isNaN(due.getTime())) {
    throw new Error("Data de vencimento inválida");
  }

  for (var i = 1; i <= count; i += 1) {
    var cents = i === count ? Math.round(total * 100) - accumulated : baseCents;
    var valor = cents / 100;
    accumulated += cents;
    var venc = new Date(due);
    venc.setMonth(venc.getMonth() + (i - 1));
    parcelas.push({
      n: i,
      valor: valor,
      vencimento: venc.toISOString().slice(0, 10),
      pago: false,
      cancelada: false,
      dataPagamento: null,
    });
  }
  return parcelas;
}

function sumParcelas(parcelas) {
  return (parcelas || []).reduce(function (acc, p) {
    if (p.cancelada) return acc;
    return acc + (p.valor || 0);
  }, 0);
}

function createPromissory(body) {
  var valorTotal = assertMoney(body.valorTotal, "Valor total");
  var entrada = assertMoney(body.entrada || 0, "Entrada");
  if (entrada > valorTotal) {
    throw new Error("Entrada não pode ser maior que o valor total");
  }
  var restante = parseMoney(valorTotal - entrada);
  var qtd = Math.max(1, parseInt(body.qtdParcelas, 10) || 1);
  if (qtd > 360) throw new Error("Máximo de 360 parcelas");

  var parcelas = buildParcelas(restante, qtd, body.primeiroVencimento);
  var soma = parseMoney(entrada + sumParcelas(parcelas));
  if (Math.abs(soma - valorTotal) > 0.02) {
    throw new Error("Inconsistência no cálculo das parcelas");
  }

  var list = readPromissories();
  var entry = {
    id: Date.now(),
    clienteId: body.clienteId || null,
    clienteNome: String(body.clienteNome || "").trim().slice(0, 120),
    veiculoId: body.veiculoId || null,
    veiculoTitulo: String(body.veiculoTitulo || "").trim().slice(0, 160),
    valorTotal: valorTotal,
    entrada: entrada,
    parcelas: parcelas,
    status: "ativa",
    dataCompra: body.dataCompra || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };
  if (!entry.clienteNome) throw new Error("Nome do cliente obrigatório");
  list.unshift(entry);
  writePromissories(list);
  return entry;
}

function payInstallment(id, parcelaN) {
  var list = readPromissories();
  var idx = list.findIndex(function (p) {
    return p.id === id;
  });
  if (idx === -1) return null;
  var prom = list[idx];
  if (prom.status === "cancelada") return null;
  var par = (prom.parcelas || []).find(function (x) {
    return x.n === parcelaN;
  });
  if (!par || par.pago || par.cancelada) return null;
  par.pago = true;
  par.dataPagamento = new Date().toISOString().slice(0, 10);
  var restantes = prom.parcelas.filter(function (x) {
    return !x.pago && !x.cancelada;
  });
  if (!restantes.length) prom.status = "quitada";
  list[idx] = prom;
  writePromissories(list);
  return { promissory: prom, parcela: par };
}

function cancelInstallment(id, parcelaN) {
  var list = readPromissories();
  var idx = list.findIndex(function (p) {
    return p.id === id;
  });
  if (idx === -1) return null;
  var prom = list[idx];
  var par = (prom.parcelas || []).find(function (x) {
    return x.n === parcelaN;
  });
  if (!par || par.pago) return null;
  par.cancelada = true;
  par.pago = false;
  list[idx] = prom;
  writePromissories(list);
  return prom;
}

function getStats() {
  var list = readPromissories();
  var today = new Date().toISOString().slice(0, 10);
  var atrasadas = 0;
  var recebido = 0;
  var pendente = 0;
  list.forEach(function (p) {
    if (p.status === "cancelada") return;
    if (p.entrada) recebido += p.entrada;
    (p.parcelas || []).forEach(function (par) {
      if (par.pago) recebido += par.valor;
      else if (!par.cancelada) {
        pendente += par.valor;
        if (par.vencimento < today) atrasadas += 1;
      }
    });
  });
  return { total: list.length, atrasadas: atrasadas, recebido: recebido, pendente: pendente };
}

function buildReport() {
  var list = readPromissories();
  var today = new Date().toISOString().slice(0, 10);
  return list.map(function (p) {
    var pagas = 0;
    var pendentes = 0;
    var atrasadas = 0;
    (p.parcelas || []).forEach(function (par) {
      if (par.pago) pagas += 1;
      else if (!par.cancelada) {
        pendentes += 1;
        if (par.vencimento < today) atrasadas += 1;
      }
    });
    return {
      id: p.id,
      cliente: p.clienteNome,
      veiculo: p.veiculoTitulo,
      valorTotal: p.valorTotal,
      entrada: p.entrada,
      status: p.status,
      parcelasPagas: pagas,
      parcelasPendentes: pendentes,
      parcelasAtrasadas: atrasadas,
    };
  });
}

function buildReceipt(prom, parcela) {
  return {
    titulo: "Recibo de Parcela",
    promissoriaId: prom.id,
    parcela: parcela.n,
    valor: parcela.valor,
    cliente: prom.clienteNome,
    veiculo: prom.veiculoTitulo,
    dataPagamento: parcela.dataPagamento,
    emitidoEm: new Date().toISOString(),
  };
}

module.exports = {
  readPromissories: readPromissories,
  writePromissories: writePromissories,
  createPromissory: createPromissory,
  payInstallment: payInstallment,
  cancelInstallment: cancelInstallment,
  getStats: getStats,
  buildReport: buildReport,
  buildReceipt: buildReceipt,
  parseMoney: parseMoney,
};
