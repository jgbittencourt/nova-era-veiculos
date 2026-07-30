"use strict";

var storage = require("./storage");

var MAX_LOGS = 2000;

function readLogs() {
  return storage.readJsonFile("audit-logs.json", []);
}

function writeLogs(logs) {
  storage.writeJsonFile("audit-logs.json", logs.slice(0, MAX_LOGS));
}

function appendLog(entry) {
  var logs = readLogs();
  logs.unshift(
    Object.assign(
      {
        id: Date.now(),
        at: new Date().toISOString(),
      },
      entry
    )
  );
  writeLogs(logs);
  return logs[0];
}

function logAction(user, action, detail, meta) {
  return appendLog({
    user: String(user || "system").slice(0, 80),
    action: String(action || "unknown").slice(0, 80),
    detail: String(detail || "").slice(0, 500),
    meta: meta || null,
  });
}

module.exports = {
  readLogs: readLogs,
  logAction: logAction,
};
