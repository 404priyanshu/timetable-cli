/**
 * storage.js — JSON-based persistence for timetable entries
 * Data lives at ~/.timetable-cli/data.json
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const DATA_DIR  = path.join(os.homedir(), '.timetable-cli');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

// ─── helpers ────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadAll() {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
  catch { return {}; }
}

function saveAll(data) {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/** Sort entries: by startTime first (if set), then by insertion id */
function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (!a.startTime && !b.startTime) return a.id - b.id;
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return a.startTime.localeCompare(b.startTime);
  });
}

function nextId(rawEntries) {
  if (!rawEntries || rawEntries.length === 0) return 1;
  return Math.max(...rawEntries.map(e => e.id)) + 1;
}

// ─── public API ─────────────────────────────────────────────────────────────

/** Returns sorted entries for a given YYYY-MM-DD dateKey */
function getEntries(dateKey) {
  const data = loadAll();
  return sortEntries(data[dateKey] || []);
}

/** Add a new entry; returns the created entry */
function addEntry(dateKey, title, startTime = '', endTime = '') {
  const data = loadAll();
  if (!data[dateKey]) data[dateKey] = [];
  const entry = {
    id:        nextId(data[dateKey]),
    title:     title.trim(),
    startTime: startTime.trim(),
    endTime:   endTime.trim(),
    status:    'pending',
    createdAt: new Date().toISOString(),
  };
  data[dateKey].push(entry);
  saveAll(data);
  return entry;
}

/** Remove entry by id; returns removed entry or null */
function removeEntry(dateKey, id) {
  const data = loadAll();
  if (!data[dateKey]) return null;
  const idx = data[dateKey].findIndex(e => e.id === Number(id));
  if (idx === -1) return null;
  const [removed] = data[dateKey].splice(idx, 1);
  saveAll(data);
  return removed;
}

/** Patch any fields on an entry; returns updated entry or null */
function updateEntry(dateKey, id, updates) {
  const data = loadAll();
  if (!data[dateKey]) return null;
  const entry = data[dateKey].find(e => e.id === Number(id));
  if (!entry) return null;
  Object.assign(entry, updates);
  saveAll(data);
  return entry;
}

/** Reset all entries on a date to 'pending' */
function resetEntries(dateKey) {
  const data = loadAll();
  if (!data[dateKey]) return [];
  data[dateKey].forEach(e => { e.status = 'pending'; });
  saveAll(data);
  return data[dateKey];
}

/** List all known dates (sorted desc) */
function listDates() {
  const data = loadAll();
  return Object.keys(data).sort((a, b) => b.localeCompare(a));
}

module.exports = { getEntries, addEntry, removeEntry, updateEntry, resetEntries, listDates };
