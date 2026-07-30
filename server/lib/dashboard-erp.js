"use strict";

var analytics = require("./analytics");
var finance = require("./finance");

function leadsToday(leads) {
  var day = new Date().toISOString().slice(0, 10);
  return leads.filter(function (l) {
    return String(l.dataContato || "").slice(0, 10) === day;
  }).length;
}

function leadsMonth(leads) {
  var month = new Date().toISOString().slice(0, 7);
  return leads.filter(function (l) {
    return String(l.dataContato || "").slice(0, 7) === month;
  }).length;
}

function topLeadOrigin(leads) {
  var map = {};
  leads.forEach(function (l) {
    var o = l.origem || "direct";
    map[o] = (map[o] || 0) + 1;
  });
  var best = null;
  var score = -1;
  Object.keys(map).forEach(function (k) {
    if (map[k] > score) {
      score = map[k];
      best = k;
    }
  });
  return best ? { origin: best, count: score } : null;
}

function buildExtendedDashboard(cars, leads, clients, stats, promissories) {
  var base = analytics.buildDashboard(cars, leads, clients, stats);
  var fin = finance.buildSummary(cars, promissories);
  var promStats = require("./promissories").getStats();

  return Object.assign({}, base, {
    leadsToday: leadsToday(leads),
    leadsMonth: leadsMonth(leads),
    finance: fin,
    promissories: promStats,
    topLeadOrigin: topLeadOrigin(leads),
    charts: {
      monthly: stats.byMonth || {},
      yearly: Object.keys(stats.byMonth || {}).reduce(function (acc, k) {
        var y = k.slice(0, 4);
        acc[y] = (acc[y] || 0) + (stats.byMonth[k].visits || 0);
        return acc;
      }, {}),
    },
  });
}

module.exports = {
  buildExtendedDashboard: buildExtendedDashboard,
};
