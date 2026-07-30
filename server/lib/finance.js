"use strict";

var storage = require("./storage");

function defaultFinance() {
  return {
    capitalEmpresa: 0,
    fluxoCaixa: [],
    receitas: [],
    despesas: [],
    investimentos: [],
    contasPagar: [],
    contasReceber: [],
  };
}

function readFinance() {
  return storage.readJsonFile("finance.json", defaultFinance());
}

function writeFinance(data) {
  storage.writeJsonFile("finance.json", data);
}

function parseMoney(v) {
  var n = Number(v);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100) / 100;
}

function assertPositiveMoney(v, label) {
  var n = parseMoney(v);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error((label || "Valor") + " deve ser maior que zero");
  }
  return n;
}

function addTransaction(type, body) {
  if (type !== "receita" && type !== "despesa" && type !== "investimento") {
    throw new Error("Tipo de transação inválido");
  }
  var valor = assertPositiveMoney(body.valor, "Valor");
  var descricao = String(body.descricao || "").trim().slice(0, 200);
  if (!descricao) throw new Error("Descrição obrigatória");

  var fin = readFinance();
  var entry = {
    id: Date.now(),
    tipo: type,
    descricao: descricao,
    categoria: String(body.categoria || "geral").trim().slice(0, 60),
    valor: valor,
    data: body.data || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };
  fin.fluxoCaixa.unshift(entry);
  if (type === "receita") fin.receitas.unshift(entry);
  if (type === "despesa") fin.despesas.unshift(entry);
  if (type === "investimento") fin.investimentos.unshift(entry);
  writeFinance(fin);
  return entry;
}

function addConta(kind, body) {
  var valor = assertPositiveMoney(body.valor, "Valor");
  var descricao = String(body.descricao || "").trim().slice(0, 200);
  if (!descricao) throw new Error("Descrição obrigatória");

  var fin = readFinance();
  var list = kind === "pagar" ? "contasPagar" : "contasReceber";
  var entry = {
    id: Date.now(),
    descricao: descricao,
    valor: valor,
    vencimento: body.vencimento || new Date().toISOString().slice(0, 10),
    pago: !!body.pago,
    dataPagamento: body.dataPagamento || null,
  };
  fin[list].unshift(entry);
  writeFinance(fin);
  return entry;
}

function sumByMonth(items, month) {
  return items.reduce(function (acc, item) {
    var d = String(item.data || item.vencimento || item.createdAt || "").slice(0, 7);
    if (d !== month) return acc;
    return acc + (item.valor || 0);
  }, 0);
}

function buildSummary(cars, promissoryList) {
  var fin = readFinance();
  var month = new Date().toISOString().slice(0, 7);
  var year = new Date().getFullYear().toString();
  var today = new Date().toISOString().slice(0, 10);

  var receitasMes = sumByMonth(
    fin.fluxoCaixa.filter(function (x) {
      return x.tipo === "receita";
    }),
    month
  );
  var despesasMes = sumByMonth(
    fin.fluxoCaixa.filter(function (x) {
      return x.tipo === "despesa";
    }),
    month
  );

  var receitasAno = fin.fluxoCaixa
    .filter(function (x) {
      return x.tipo === "receita" && String(x.data || "").slice(0, 4) === year;
    })
    .reduce(function (a, x) {
      return a + x.valor;
    }, 0);
  var despesasAno = fin.fluxoCaixa
    .filter(function (x) {
      return x.tipo === "despesa" && String(x.data || "").slice(0, 4) === year;
    })
    .reduce(function (a, x) {
      return a + x.valor;
    }, 0);

  var capitalEstoque = (cars || []).reduce(function (acc, c) {
    if (c.vendido || c.status === "vendido") return acc;
    return acc + (Number(c.preco) || 0);
  }, 0);

  var parcelasReceber = 0;
  var parcelasVencidas = 0;
  var capitalRecebido = 0;
  (promissoryList || []).forEach(function (p) {
    if (p.status === "cancelada") return;
    if (p.entrada) capitalRecebido += p.entrada;
    (p.parcelas || []).forEach(function (par) {
      if (par.cancelada) return;
      if (par.pago) capitalRecebido += par.valor || 0;
      else {
        parcelasReceber += par.valor || 0;
        if (par.vencimento && par.vencimento < today) {
          parcelasVencidas += par.valor || 0;
        }
      }
    });
  });

  var saldo = fin.fluxoCaixa.reduce(function (acc, x) {
    if (x.tipo === "receita" || x.tipo === "investimento") return acc + x.valor;
    if (x.tipo === "despesa") return acc - x.valor;
    return acc;
  }, parseMoney(fin.capitalEmpresa) || 0);

  return {
    capitalEmpresa: parseMoney(fin.capitalEmpresa) || 0,
    capitalEstoque: capitalEstoque,
    capitalRecebido: parseMoney(capitalRecebido),
    parcelasReceber: parseMoney(parcelasReceber),
    parcelasVencidas: parseMoney(parcelasVencidas),
    lucroBrutoMes: receitasMes,
    lucroLiquidoMes: parseMoney(receitasMes - despesasMes),
    lucroAnual: parseMoney(receitasAno - despesasAno),
    receitasMes: receitasMes,
    despesasMes: despesasMes,
    saldo: saldo,
    contasPagar: fin.contasPagar.filter(function (c) {
      return !c.pago;
    }).length,
    contasReceber: fin.contasReceber.filter(function (c) {
      return !c.pago;
    }).length,
  };
}

function exportCsv() {
  var fin = readFinance();
  var lines = ["data,tipo,categoria,descricao,valor"];
  fin.fluxoCaixa.forEach(function (x) {
    var desc = String(x.descricao || "").replace(/"/g, '""');
    lines.push([x.data, x.tipo, x.categoria, '"' + desc + '"', x.valor].join(","));
  });
  return lines.join("\n");
}

module.exports = {
  readFinance: readFinance,
  writeFinance: writeFinance,
  addTransaction: addTransaction,
  addConta: addConta,
  buildSummary: buildSummary,
  exportCsv: exportCsv,
  parseMoney: parseMoney,
};
