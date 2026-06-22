"use strict";

async function chatCompletion(systemPrompt, messages) {
  var apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada");
  }

  var model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  var payload = {
    model: model,
    messages: [{ role: "system", content: systemPrompt }].concat(messages),
    temperature: 0.7,
    max_tokens: 600,
  };

  var response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    var errBody = await response.text();
    throw new Error("OpenAI API error " + response.status + ": " + errBody);
  }

  var data = await response.json();
  var choice = data.choices && data.choices[0];
  if (!choice || !choice.message) {
    throw new Error("Resposta inválida da OpenAI");
  }

  return choice.message.content.trim();
}

module.exports = { chatCompletion: chatCompletion };
