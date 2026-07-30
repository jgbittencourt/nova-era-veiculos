"use strict";

var storage = require("./storage");
var promissories = require("./promissories");

function readAgenda() {
  return storage.readJsonFile("agenda.json", []);
}

function writeAgenda(list) {
  storage.writeJsonFile("agenda.json", list);
}

function addEvent(body) {
  var list = readAgenda();
  var entry = {
    id: Date.now(),
    titulo: String(body.titulo || "").trim().slice(0, 160),
    tipo: String(body.tipo || "compromisso").slice(0, 40),
    data: body.data || new Date().toISOString().slice(0, 10),
    hora: String(body.hora || "").slice(0, 5),
    descricao: String(body.descricao || "").slice(0, 500),
    clienteId: body.clienteId || null,
    createdAt: new Date().toISOString(),
  };
  list.unshift(entry);
  writeAgenda(list);
  return entry;
}

function deleteEvent(id) {
  var list = readAgenda();
  var next = list.filter(function (e) {
    return e.id !== id;
  });
  if (next.length === list.length) return false;
  writeAgenda(next);
  return true;
}

function buildAgendaView(clients) {
  var manual = readAgenda();
  var today = new Date().toISOString().slice(0, 10);
  var in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  var limit = in7.toISOString().slice(0, 10);

  var parcelas = [];
  promissories.readPromissories().forEach(function (p) {
    (p.parcelas || []).forEach(function (par) {
      if (!par.pago && !par.cancelada && par.vencimento >= today && par.vencimento <= limit) {
        parcelas.push({
          tipo: "parcela",
          titulo: "Parcela " + par.n + " — " + p.clienteNome,
          data: par.vencimento,
          valor: par.valor,
          promissoryId: p.id,
          parcelaN: par.n,
        });
      }
    });
  });

  var aniversarios = (clients || [])
    .filter(function (c) {
      return c.dataNascimento;
    })
    .map(function (c) {
      var d = c.dataNascimento.slice(5, 10);
      var year = new Date().getFullYear();
      return {
        tipo: "aniversario",
        titulo: "Aniversário — " + c.nome,
        data: year + "-" + d,
        clienteId: c.id,
      };
    })
    .filter(function (a) {
      return a.data >= today && a.data <= limit;
    });

  return {
    parcelas: parcelas,
    aniversarios: aniversarios,
    compromissos: manual,
    alertas: parcelas.length + aniversarios.length,
  };
}

module.exports = {
  readAgenda: readAgenda,
  addEvent: addEvent,
  deleteEvent: deleteEvent,
  buildAgendaView: buildAgendaView,
};
