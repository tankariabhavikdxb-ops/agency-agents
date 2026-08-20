/* ============================================================
   NEXORA CMS — charts (Chart.js via CDN, CSS fallback offline)
   ============================================================ */
(function (root) {
  "use strict";

  const PALETTE = ["#f59e0b", "#0ea5e9", "#059669", "#e11d48", "#8b5cf6", "#f97316", "#14b8a6", "#6366f1", "#84cc16", "#ec4899"];
  const F = root.Fmt;
  let chartSeq = 0;
  const liveCharts = [];

  function destroyCharts() {
    while (liveCharts.length) {
      const c = liveCharts.pop();
      try { c.destroy(); } catch (e) { /* ignore */ }
    }
  }

  function hasChartJs() { return typeof window !== "undefined" && typeof window.Chart === "function"; }

  function moneyShort(v) {
    const n = F.num(v);
    const a = Math.abs(n);
    if (a >= 1e9) return `${F.qty(n / 1e9, 1)}B`;
    if (a >= 1e6) return `${F.qty(n / 1e6, 1)}M`;
    if (a >= 1e3) return `${F.qty(n / 1e3, 0)}K`;
    return F.qty(n, 0);
  }

  const TOOLTIP = {
    callbacks: {
      label: ctx => {
        const ds = ctx.dataset.label || "";
        let v = ctx.parsed.y != null ? ctx.parsed.y : ctx.parsed.x;
        if (ctx.chart.config.type === "doughnut" || ctx.chart.config.type === "pie") v = ctx.parsed;
        return `${ds}: ${F.money(v)}`;
      },
    },
  };

  function buildChart(spec, hostEl) {
    hostEl.innerHTML = "";
    const card = document.createElement("div");
    card.className = "chart-card";
    const head = document.createElement("div");
    head.className = "chart-head";
    head.innerHTML = `<div class="chart-title">${F.esc(spec.title || "Chart")}</div>`;
    card.appendChild(head);
    hostEl.appendChild(card);

    const body = document.createElement("div");
    body.className = "chart-body";
    card.appendChild(body);

    if (!hasChartJs() || !spec.labels || !spec.labels.length) {
      body.classList.add("chart-fallback");
      const rows = spec.labels.map((lab, i) => {
        const val = spec.series.reduce((a, s) => a + F.num(s.data[i]), 0);
        const max = Math.max(1, ...spec.labels.map((_, j) => spec.series.reduce((a, s) => a + F.num(s.data[j]), 0)));
        return `<div class="fb-row">
          <div class="fb-label">${F.esc(lab)}</div>
          <div class="fb-bar-wrap"><div class="fb-bar" style="width:${(val / max) * 100}%"></div></div>
          <div class="fb-val">${F.money(val)}</div>
        </div>`;
      }).join("");
      body.innerHTML = rows || '<div class="chart-nodata">No data in the selected range</div>';
      if (!hasChartJs()) {
        const note = document.createElement("div");
        note.className = "chart-note";
        note.textContent = "Charts unavailable offline — connect to the internet for full charts.";
        body.appendChild(note);
      }
      return card;
    }

    const canvas = document.createElement("canvas");
    canvas.style.height = spec.type === "hbar" ? `${Math.max(220, spec.labels.length * 34)}px` : "280px";
    body.appendChild(canvas);

    const baseOpts = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: spec.series.length > 1, labels: { color: "#64748b", usePointStyle: true, boxWidth: 8, font: { family: "Inter, sans-serif", size: 11 } } },
        tooltip: TOOLTIP,
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 10 } } },
        y: { grid: { color: "#eef2f7" }, ticks: { color: "#94a3b8", font: { size: 10 }, callback: v => moneyShort(v) } },
      },
    };

    const chartId = `nxchart-${++chartSeq}`;
    canvas.id = chartId;
    const cfg = { type: "bar", data: { labels: spec.labels, datasets: [] }, options: baseOpts };

    if (spec.type === "doughnut") {
      cfg.type = "doughnut";
      cfg.options = {
        responsive: true, maintainAspectRatio: false, cutout: "62%",
        plugins: { legend: { position: "right", labels: { color: "#475569", usePointStyle: true, boxWidth: 8, font: { size: 11 } } }, tooltip: TOOLTIP },
      };
      cfg.data.datasets = spec.series.map((s, i) => ({
        label: s.label, data: s.data,
        backgroundColor: PALETTE.map((c, j) => PALETTE[j % PALETTE.length]),
        borderWidth: 2, borderColor: "#ffffff",
      }));
    } else if (spec.type === "line") {
      cfg.type = "line";
      cfg.data.datasets = spec.series.map((s, i) => ({
        label: s.label, data: s.data,
        borderColor: s.color || PALETTE[i], backgroundColor: s.color || PALETTE[i],
        tension: 0.35, fill: false, pointRadius: 3, pointBackgroundColor: "#fff", borderWidth: 2.5,
      }));
    } else if (spec.type === "hbar") {
      cfg.type = "bar";
      cfg.options = {
        indexAxis: "y",
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: false }, tooltip: TOOLTIP },
        scales: {
          x: { grid: { color: "#eef2f7" }, ticks: { color: "#94a3b8", font: { size: 10 }, callback: v => moneyShort(v) } },
          y: { grid: { display: false }, ticks: { color: "#475569", font: { size: 10 } } },
        },
      };
      cfg.data.datasets = spec.series.map((s, i) => ({
        label: s.label, data: s.data,
        backgroundColor: (s.color || PALETTE[i]) + "cc", borderRadius: 4, maxBarThickness: 16,
      }));
    } else {
      cfg.data.datasets = spec.series.map((s, i) => ({
        label: s.label, data: s.data,
        backgroundColor: (s.color || PALETTE[i]) + "d9", borderRadius: 5, maxBarThickness: 34,
      }));
    }

    // eslint-disable-next-line no-new
    const chart = new window.Chart(canvas.getContext("2d"), cfg);
    liveCharts.push(chart);
    return card;
  }

  function renderCharts(specs, hostEl) {
    destroyCharts();
    hostEl.innerHTML = "";
    (specs || []).forEach(s => buildChart(s, hostEl));
  }

  root.Charts = { buildChart, renderCharts, hasChartJs, destroyCharts };
})(typeof window !== "undefined" ? window : globalThis);
