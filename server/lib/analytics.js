"use strict";

var storage = require("./storage");

var ALLOWED_EVENTS = {
  pageview: true,
  car_view: true,
  car_click: true,
  whatsapp_click: true,
  share_click: true,
  interest_click: true,
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function trackEvent(body, meta) {
  var type = String(body.type || "").trim();
  if (!ALLOWED_EVENTS[type]) {
    return { ok: false, error: "Evento inválido" };
  }

  var data = storage.readAnalytics();
  var day = todayKey();
  var month = monthKey();

  data.totals.visits = (data.totals.visits || 0) + (type === "pageview" ? 1 : 0);
  data.byDay[day] = data.byDay[day] || { visits: 0, events: {} };
  if (type === "pageview") data.byDay[day].visits += 1;
  data.byDay[day].events[type] = (data.byDay[day].events[type] || 0) + 1;

  data.byMonth[month] = data.byMonth[month] || { visits: 0, events: {} };
  if (type === "pageview") data.byMonth[month].visits += 1;
  data.byMonth[month].events[type] = (data.byMonth[month].events[type] || 0) + 1;

  var origin = String(body.origin || meta.referrerOrigin || "direct").slice(0, 80);
  data.origins[origin] = (data.origins[origin] || 0) + 1;

  var carId = parseInt(body.carId, 10);
  if (carId) {
    var key = String(carId);
    data.cars[key] = data.cars[key] || {
      views: 0,
      clicks: 0,
      whatsapp: 0,
      shares: 0,
      interest: 0,
    };
    if (type === "car_view") data.cars[key].views += 1;
    if (type === "car_click") data.cars[key].clicks += 1;
    if (type === "whatsapp_click") data.cars[key].whatsapp += 1;
    if (type === "share_click") data.cars[key].shares += 1;
    if (type === "interest_click") data.cars[key].interest += 1;
  }

  data.recent.unshift({
    type: type,
    carId: carId || null,
    origin: origin,
    path: String(body.path || "").slice(0, 200),
    at: new Date().toISOString(),
  });
  data.recent = data.recent.slice(0, 200);

  storage.writeAnalytics(data);
  return { ok: true };
}

function getTopCar(data, field) {
  var bestId = null;
  var bestScore = -1;
  Object.keys(data.cars || {}).forEach(function (id) {
    var score = (data.cars[id] && data.cars[id][field]) || 0;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  });
  return bestId ? { id: parseInt(bestId, 10), score: bestScore } : null;
}

function buildDashboard(cars, leads, clients, analytics) {
  var disponiveis = cars.filter(function (c) {
    return !c.vendido && c.status !== "vendido";
  });
  var vendidos = cars.filter(function (c) {
    return c.vendido || c.status === "vendido";
  });

  var topView = getTopCar(analytics, "views");
  var topCar = topView
    ? cars.find(function (c) {
        return c.id === topView.id;
      })
    : null;

  return {
    vehicles: {
      total: cars.length,
      available: disponiveis.length,
      sold: vendidos.length,
      featured: cars.filter(function (c) {
        return c.destaque;
      }).length,
    },
    leads: { total: leads.length },
    clients: { total: clients.length },
    visits: {
      total: analytics.totals.visits || 0,
      byDay: analytics.byDay,
      byMonth: analytics.byMonth,
      origins: analytics.origins,
    },
    top: {
      viewed: topCar
        ? { id: topCar.id, name: topCar.marca + " " + topCar.modelo, score: topView.score }
        : null,
      clicked: getTopCar(analytics, "clicks"),
      whatsapp: getTopCar(analytics, "whatsapp"),
    },
    recentLeads: leads.slice(0, 8),
    recentClients: clients.slice(0, 8),
    recentEvents: analytics.recent.slice(0, 12),
  };
}

module.exports = {
  trackEvent: trackEvent,
  buildDashboard: buildDashboard,
  ALLOWED_EVENTS: ALLOWED_EVENTS,
};
