"use strict";

function buildContract(type, data) {
  var loja = data.loja || {};
  var cliente = data.cliente || {};
  var veiculo = data.veiculo || {};
  var prom = data.promissory || {};

  var header =
    "CONTRATO DE " +
    (type === "venda" ? "VENDA" : type === "compra" ? "COMPRA" : type.toUpperCase()) +
    "\n\n";
  var body =
    "Loja: " +
    (loja.nome || "Nova Era Veículos BM") +
    "\n" +
    "Endereço: " +
    (loja.endereco || "") +
    "\n\n" +
    "Cliente: " +
    (cliente.nome || prom.clienteNome || "") +
    "\n" +
    "CPF: " +
    (cliente.cpf || "_______________") +
    "\n" +
    "Telefone: " +
    (cliente.telefone || cliente.whatsapp || "") +
    "\n\n" +
    "Veículo: " +
    (veiculo.titulo || prom.veiculoTitulo || "") +
    "\n" +
    "Valor total: R$ " +
    (prom.valorTotal || veiculo.preco || 0) +
    "\n" +
    "Entrada: R$ " +
    (prom.entrada || 0) +
    "\n\n" +
    "Data: " +
    new Date().toLocaleDateString("pt-BR") +
    "\n\n" +
    "________________________________________\n" +
    "Assinatura do Cliente\n\n" +
    "________________________________________\n" +
    "Assinatura da Loja\n";

  if (type === "promissoria") {
    body =
      "NOTA PROMISSÓRIA\n\n" +
      "Emitente: " +
      (cliente.nome || prom.clienteNome || "") +
      "\n" +
      "Valor total: R$ " +
      (prom.valorTotal || 0) +
      "\n" +
      "Parcelas: " +
      ((prom.parcelas && prom.parcelas.length) || 0) +
      "\n" +
      "Data: " +
      new Date().toLocaleDateString("pt-BR") +
      "\n";
  }

  if (type === "recibo") {
    body =
      "RECIBO\n\n" +
      "Recebemos de " +
      (cliente.nome || prom.clienteNome || "") +
      " a quantia de R$ " +
      (data.valor || 0) +
      " referente à parcela " +
      (data.parcela || "") +
      ".\n\n" +
      "Data: " +
      new Date().toLocaleDateString("pt-BR") +
      "\n";
  }

  return {
    type: type,
    content: header + body,
    html:
      "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'><title>Contrato</title></head><body><pre>" +
      (header + body).replace(/</g, "&lt;") +
      "</pre></body></html>",
  };
}

module.exports = {
  buildContract: buildContract,
};
