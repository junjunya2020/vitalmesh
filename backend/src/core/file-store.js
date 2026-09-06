import fs from "node:fs";
import path from "node:path";
import { chinaNow } from "./time.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

export const createStore = (dbFile, rawLogFile, labels = {}) => {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  if (rawLogFile) fs.mkdirSync(path.dirname(rawLogFile), { recursive: true });
  const file = `${dbFile}.json`;
  const empty = { sensors: [], readings: [], messages: [], registrations: [] };
  let state = empty;
  if (fs.existsSync(file)) {
    try { state = { ...empty, ...JSON.parse(fs.readFileSync(file, "utf8")) }; } catch { state = empty; }
  }
  const persist = () => fs.writeFileSync(file, JSON.stringify(state), "utf8");
  const view = (row) => ({ sensor_id: row.sensor_id, unique_id: row.source_unique_id, original_name: row.original_name, localized_name: row.localized_name ?? labels[row.source_unique_id] ?? null, type: row.sensor_type, device_id: row.device_id ?? "unknown-device", updates: state.readings.filter((x) => x.sensor_id === row.sensor_id).length, last_received: row.last_received_at, last_changed: row.last_changed_at, latest: { state: row.latest_value, attributes: row.attributes ?? {} } });
  const store = {
    recordMessage(webhookId, payload, receivedAt = chinaNow()) { const entry = { id: state.messages.length + 1, received_at: receivedAt, response_status: 200, webhook_id: webhookId, payload }; state.messages.push(entry); persist(); if (rawLogFile) fs.appendFileSync(rawLogFile, `${JSON.stringify(entry)}\n`); return clone(entry); },
    register(registration) { const value = { webhook_id: registration.webhook_id, device_id: registration.device_id, payload: registration, created_at: registration.created_at }; const i = state.registrations.findIndex((x) => x.webhook_id === value.webhook_id); if (i < 0) state.registrations.push(value); else state.registrations[i] = value; persist(); },
    getRegistration(id) { return state.registrations.find((x) => x.webhook_id === id)?.payload ?? null; },
    getRegistrationByDeviceId(id) { return state.registrations.find((x) => x.device_id === id)?.payload ?? null; },
    upsertSensor(sensor, deviceId, receivedAt = chinaNow()) { const type = sensor.type ?? "sensor", source = String(sensor.unique_id ?? sensor.entity_id ?? "unknown"), id = `${deviceId ?? "unknown-device"}:${type}:${source}`, attributes = sensor.attributes && typeof sensor.attributes === "object" ? sensor.attributes : {}, i = state.sensors.findIndex((x) => x.sensor_id === id), old = i >= 0 ? state.sensors[i] : null, changed = !old || JSON.stringify(old.latest_value) !== JSON.stringify(sensor.state); const row = { sensor_id: id, source_unique_id: source, original_name: sensor.name ?? sensor.icon_name ?? source, localized_name: labels[source] ?? null, sensor_type: type, device_id: deviceId ?? null, unit_of_measurement: sensor.unit_of_measurement ?? attributes.unit_of_measurement ?? null, attributes, latest_value: sensor.state, last_received_at: receivedAt, last_changed_at: changed ? receivedAt : old.last_changed_at, created_at: old?.created_at ?? receivedAt, updated_at: receivedAt }; if (i < 0) state.sensors.push(row); else state.sensors[i] = row; if (!old || changed || JSON.stringify(old.attributes) !== JSON.stringify(attributes)) state.readings.push({ id: state.readings.length + 1, sensor_id: id, device_id: deviceId ?? null, source_unique_id: source, value: sensor.state, received_at: receivedAt, changed, changed_at: row.last_changed_at, details: attributes, raw: sensor }); persist(); return id; },
    listSensors(deviceId) { return state.sensors.filter((x) => deviceId === undefined || (x.device_id ?? "unknown-device") === deviceId).sort((a, b) => a.source_unique_id.localeCompare(b.source_unique_id)).map(view); },
    getSensor(sensorId, deviceId) { const row = state.sensors.find((x) => x.sensor_id === sensorId && (x.device_id ?? "unknown-device") === deviceId); return row ? view(row) : null; },
    history(sensorId) { return state.readings.filter((x) => x.sensor_id === sensorId).sort((a, b) => a.received_at.localeCompare(b.received_at) || a.id - b.id).map(clone); },
    historyPage(sensorId, deviceId, page = 1, pageSize = 50) { const all = state.readings.filter((x) => x.sensor_id === sensorId && (x.device_id ?? "unknown-device") === deviceId).sort((a, b) => b.received_at.localeCompare(a.received_at) || b.id - a.id), offset = (page - 1) * pageSize; return { page, page_size: pageSize, total: all.length, has_more: offset + pageSize < all.length, records: clone(all.slice(offset, offset + pageSize)) }; },
    listDevices() { const devices = state.registrations.slice().sort((a, b) => a.created_at.localeCompare(b.created_at)).map((x) => ({ device_id: x.device_id, device_name: x.payload.device_name ?? x.device_id, model: x.payload.model ?? null, os_name: x.payload.os_name ?? null, app_name: x.payload.app_name ?? null, webhook_id: x.webhook_id, created_at: x.created_at })); if (!devices.length && state.sensors.some((x) => x.device_id === null)) devices.push({ device_id: "unknown-device", device_name: "未知设备（历史数据）", model: null, os_name: null, app_name: null, webhook_id: null, created_at: null }); return devices; },
    listMessages() { return clone(state.messages); },
    close() { persist(); }
  };
  return store;
};