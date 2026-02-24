"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

function existsSyncSafe(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

async function readJson(file) {
  const raw = await fsp.readFile(file, "utf-8");
  return JSON.parse(raw);
}

async function writeJson(file, obj) {
  const tmp = file + ".tmp";
  await fsp.writeFile(tmp, JSON.stringify(obj, null, 2), "utf-8");
  await fsp.rename(tmp, file);
}

function nowIso() {
  return new Date().toISOString();
}

function clampInt(n, a, b) {
  n = Number(n);
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, Math.trunc(n)));
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDateBR(iso) {
  const d = new Date(String(iso || ""));
  if (!Number.isFinite(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return dd + "/" + mm + "/" + yy + " " + hh + ":" + mi;
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function clamp(n, a, b) {
  n = Number(n);
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, n));
}

function wrapTextLines(text, maxCharsPerLine, maxLines) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";

  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (next.length <= maxCharsPerLine) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);

  if (lines.length > maxLines) lines.length = maxLines;

  if (lines.length === maxLines) {
    const usedWords = lines.join(" ").split(/\s+/).length;
    if (usedWords < words.length) {
      lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+$/, "");
      if (!lines[maxLines - 1].endsWith("…")) lines[maxLines - 1] += "…";
    }
  }

  return lines;
}

function urlToFsPath({ OUT_DIR, url }) {
  const u = String(url || "");
  if (!u.startsWith("/output/")) return null;
  const rel = u.slice("/output/".length).replace(/^\/+/, "");
  return path.join(OUT_DIR, rel);
}

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pad2(n) {
  n = Number(n || 0);
  return String(n).padStart(2, "0");
}

function isFinalOrEdited(p) {
  const s = String(p || "").toLowerCase();
  return (
    s.includes("final") ||
    s.includes("/images/edited/") ||
    s.includes("\\images\\edited\\")
  );
}

module.exports = {
  fs,
  fsp,
  path,

  existsSyncSafe,
  readJson,
  writeJson,

  nowIso,
  clampInt,
  clamp,

  escapeHtml,
  escapeXml,
  fmtDateBR,

  ensureDir,
  wrapTextLines,
  urlToFsPath,
  pad2,
  isFinalOrEdited,
};