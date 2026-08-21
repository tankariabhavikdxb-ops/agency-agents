/* ============================================================
   NEXORA CMS — single-file build script
   ------------------------------------------------------------
   Bundles the whole app (CSS + JS + logo + Chart.js) into ONE
   standalone HTML file that can be saved and opened directly
   from any PC (no server, no internet needed for demo mode).

   Usage:
     node build-single.js
   Output:
     Nexora Site Management System.html (this folder)
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const root = __dirname; // build-single.js lives in the app root
const outFile = path.join(root, "Nexora Site Management System.html");

function read(p) { return fs.readFileSync(path.join(root, p), "utf8"); }
function escapeScript(code) { return code.replace(/<\/script/gi, "<\\/script"); }
function kb(n) { return (n / 1024).toFixed(1) + " KB"; }

/* ---- vendored Chart.js (tracked in vendor/) with CDN fallback ---- */
function loadChartJs() {
  const local = path.join(root, "vendor", "chart.umd.min.js");
  if (fs.existsSync(local)) return fs.readFileSync(local, "utf8");
  // offline fallback: fetch the pinned Chart.js build from the CDN
  const cp = require("child_process");
  const url = "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js";
  try {
    const out = cp.execSync('curl -fsSL --max-time 60 "' + url + '"', { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
    if (out && out.indexOf("Chart.js v4.4.3") >= 0) {
      fs.mkdirSync(path.join(root, "vendor"), { recursive: true });
      fs.writeFileSync(local, out);
      console.log("   (downloaded Chart.js v4.4.3 from the CDN into vendor/)");
      return out;
    }
  } catch (e) { /* fall through */ }
  throw new Error("Chart.js v4.4.3 not found in vendor/ and the CDN is unreachable.\n" +
    "Fix:  npm install chart.js@4.4.3   then copy node_modules/chart.js/dist/chart.umd.js to vendor/chart.umd.min.js");
}

/* ---- logo (tracked in assets/) ---- */
function loadLogoB64() {
  const small = path.join(root, "assets", "logo-64.png");
  const full = path.join(root, "assets", "logo.png");
  const file = fs.existsSync(small) ? small : full;
  return fs.readFileSync(file).toString("base64");
}

let html = read("index.html");

// 1. inline stylesheets (screen + print)
for (const [tag, css] of [
  ['<link rel="stylesheet" href="css/style.css" />', read("css/style.css")],
  ['<link rel="stylesheet" href="css/print.css" media="print" />', read("css/print.css")],
]) {
  if (!html.includes(tag)) throw new Error("stylesheet tag not found: " + tag);
  html = html.replace(tag, "<style" + (tag.includes("media=\"print\"") ? ' media="print"' : "") + ">\n" + css + "\n</style>");
}

// 2. inline the logo as a data-URI favicon
html = html.replace('<link rel="icon" href="assets/logo.png" />',
  '<link rel="icon" href="data:image/png;base64,' + loadLogoB64() + '" />');

// 3. inline Chart.js (vendored copy — reports work fully offline)
const chartJs = loadChartJs();
const chartTag = '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>';
if (!html.includes(chartTag)) throw new Error("chart.js script tag not found");
html = html.replace(chartTag, "<script>\n/* Chart.js v4.4.3 — vendored & inlined (MIT License) */\n" + escapeScript(chartJs) + "\n</script>");

// 4. inline all application scripts in load order
const scripts = [
  "config.js",
  "js/format.js",
  "js/ui.js",
  "js/components.js",
  "js/charts.js",
  "js/reports-core.js",
  "js/mock.js",
  "js/api.js",
  "js/auth.js",
  "js/pages/dashboard.js",
  "js/pages/masters.js",
  "js/pages/budget.js",
  "js/pages/contract.js",
  "js/pages/expenses.js",
  "js/pages/reports.js",
  "js/pages/audit.js",
  "js/pages/settings.js",
  "js/app.js",
];
for (const src of scripts) {
  const tag = '<script src="' + src + '"></script>';
  if (!html.includes(tag)) throw new Error("script tag not found: " + tag);
  html = html.replace(tag, "<script>\n/* ===== " + src + " ===== */\n" + escapeScript(read(src)) + "\n</script>");
}

// 5. mark the build inside the file
html = html.replace(
  "<title>Nexora Limited — Construction Site Management System</title>",
  "<title>Nexora Limited — Construction Site Management System</title>\n  <meta name=\"single-file-build\" content=\"" + new Date().toISOString().slice(0, 10) + "\" />"
);

fs.writeFileSync(outFile, html);
console.log("✅ Built:", path.basename(outFile), "(" + kb(html.length) + ")");
console.log("   - CSS inlined (style + print)");
console.log("   - logo inlined as data-URI favicon");
console.log("   - Chart.js v4.4.3 inlined (" + kb(chartJs.length) + ")");
console.log("   - " + scripts.length + " application scripts inlined");

// also emit the HOSTED-MODE copy for Google Apps Script:
// create an HTML file named exactly "Index" in the Apps Script project and
// paste this file's contents — the backend will then serve the whole app
// from its own /exec URL (no CORS involved, works on any browser).
const hostedFile = path.join(root, "backend", "Index.html");
fs.writeFileSync(hostedFile, html);
console.log("   - hosted-mode copy written to backend/Index.html (for Google Apps Script)");
console.log("\nSave this file anywhere and double-click to open — demo mode works");
console.log("fully offline. Connect Google Sheets via Settings → Connection.");
