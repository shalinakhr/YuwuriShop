/**
 * YUWURI — Google Analytics 4 dashboard (client-side, GA4 Data API).
 * Tanpa backend: OAuth token disimpan di localStorage browser admin.
 *
 * Data yang diambil:
 *  - ringkasan 7/28/90 hari (users, new users, sessions, views, durasi, engagement)
 *  - grafik pengguna harian + perbandingan periode sebelumnya
 *  - halaman teratas, sumber traffic, perangkat, pengguna aktif saat ini
 */
(function () {
  "use strict";

  var CFG = window.YUWURI_GA_CONFIG || {};
  var LS_TOKEN = "yuwuri_ga_token";
  var LS_PROP = "yuwuri_ga_property";
  var LS_RANGE = "yuwuri_ga_range";
  var API = "https://analyticsdata.googleapis.com/v1beta";

  var state = {
    root: null,
    token: null,
    property: "",
    range: 28,
    mode: "demo",
    loading: false,
    gisLoaded: false,
    tokenClient: null
  };

  /* ------------------------------------------------------------------ utils */

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function num(value) {
    var n = Number(value);
    if (!isFinite(n)) return "0";
    return new Intl.NumberFormat("id-ID").format(Math.round(n));
  }

  function pct(value) {
    var n = Number(value);
    if (!isFinite(n)) return "—";
    return (n * 100).toFixed(1).replace(".", ",") + "%";
  }

  function duration(seconds) {
    var s = Math.round(Number(seconds) || 0);
    var m = Math.floor(s / 60);
    var rest = s % 60;
    return m + "m " + String(rest).padStart(2, "0") + "s";
  }

  function dateKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function rangeDates(days) {
    var end = new Date();
    var start = new Date();
    start.setDate(start.getDate() - (days - 1));
    return { start: dateKey(start), end: dateKey(end) };
  }

  function status(text, kind) {
    var el = $("[data-ga-status]");
    if (!el) return;
    el.innerHTML = text;
    el.className = "yw-ga-bar" + (kind === "error" ? " yw-notice--error" : "");
  }

  /* ---------------------------------------------------------------- storage */

  function saveToken(token, expiresIn) {
    state.token = token;
    try {
      localStorage.setItem(
        LS_TOKEN,
        JSON.stringify({ access_token: token, expires_at: Date.now() + (expiresIn || 3500) * 1000 })
      );
    } catch (e) {}
  }

  function loadToken() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_TOKEN) || "null");
      if (raw && raw.access_token && raw.expires_at > Date.now() + 60000) {
        state.token = raw.access_token;
        return true;
      }
    } catch (e) {}
    return false;
  }

  function clearToken() {
    state.token = null;
    try {
      localStorage.removeItem(LS_TOKEN);
    } catch (e) {}
  }

  /* ------------------------------------------------------------------- auth */

  function loadGis() {
    if (state.gisLoaded) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = function () {
        state.gisLoaded = true;
        resolve();
      };
      s.onerror = function () {
        reject(new Error("Gagal memuat Google Identity Services."));
      };
      document.head.appendChild(s);
    });
  }

  function connect() {
    if (!CFG.clientId) {
      status(
        '<span class="yw-ga-bar__status"><span class="yw-dot"></span>Client ID belum diisi. Buka <code>js/ga-config.js</code> dan isi <code>clientId</code>.</span>',
        "error"
      );
      return;
    }
    status('<span class="yw-ga-bar__status"><span class="yw-dot"></span>Membuka izin Google…</span>');
    loadGis()
      .then(function () {
        if (!state.tokenClient) {
          state.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: CFG.clientId,
            scope: CFG.scope || "https://www.googleapis.com/auth/analytics.readonly",
            callback: function (resp) {
              if (resp && resp.access_token) {
                saveToken(resp.access_token, resp.expires_in);
                load();
              } else {
                status(
                  '<span class="yw-ga-bar__status"><span class="yw-dot"></span>Izin dibatalkan.</span>',
                  "error"
                );
              }
            },
            error_callback: function (err) {
              status(
                '<span class="yw-ga-bar__status"><span class="yw-dot"></span>Gagal izin: ' +
                  esc((err && err.message) || "unknown") +
                  "</span>",
                "error"
              );
            }
          });
        }
        state.tokenClient.requestAccessToken({ prompt: state.token ? "" : "consent" });
      })
      .catch(function (err) {
        status('<span class="yw-ga-bar__status"><span class="yw-dot"></span>' + esc(err.message) + "</span>", "error");
      });
  }

  /* -------------------------------------------------------------------- api */

  function api(path, body) {
    var url = API + "/properties/" + encodeURIComponent(state.property) + ":" + path;
    return fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + state.token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.text().then(function (text) {
        var json = {};
        try {
          json = text ? JSON.parse(text) : {};
        } catch (e) {}
        if (!res.ok) {
          var msg = (json.error && json.error.message) || res.status + " " + res.statusText;
          if (res.status === 401) clearToken();
          throw new Error(msg);
        }
        return json;
      });
    });
  }

  function reportBody(days) {
    var cur = rangeDates(days);
    var prevEnd = new Date(cur.start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    var prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (days - 1));
    return {
      dateRanges: [
        { startDate: cur.start, endDate: cur.end },
        { startDate: dateKey(prevStart), endDate: dateKey(prevEnd) }
      ],
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "activeUsers" },
        { name: "newUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
        { name: "engagementRate" }
      ],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 400
    };
  }

  function fetchAll(days) {
    var body = reportBody(days);
    return Promise.all([
      api("runReport", body),
      api("runReport", {
        dateRanges: body.dateRanges.slice(0, 1),
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 8
      }),
      api("runReport", {
        dateRanges: body.dateRanges.slice(0, 1),
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 6
      }),
      api("runReport", {
        dateRanges: body.dateRanges.slice(0, 1),
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 4
      }),
      api("runRealtimeReport", { metrics: [{ name: "activeUsers" }] })
    ]).then(function (res) {
      return normalize(res[0], res[1], res[2], res[3], res[4]);
    });
  }

  /* ---------------------------------------------------------------- mapping */

  function normalize(main, pages, sources, devices, realtime) {
    var rows = (main.rows || []).map(function (row) {
      var raw = row.dimensionValues[0].value; // YYYYMMDD
      return {
        date: raw.slice(0, 4) + "-" + raw.slice(4, 6) + "-" + raw.slice(6, 8),
        users: Number(row.metricValues[0].value) || 0,
        newUsers: Number(row.metricValues[1].value) || 0,
        sessions: Number(row.metricValues[2].value) || 0,
        views: Number(row.metricValues[3].value) || 0,
        avgDuration: Number(row.metricValues[4].value) || 0,
        engagement: Number(row.metricValues[5].value) || 0
      };
    });

    function totalsOf(index) {
      var t = (main.totals || [])[index];
      if (t) {
        return {
          users: Number(t.metricValues[0].value) || 0,
          newUsers: Number(t.metricValues[1].value) || 0,
          sessions: Number(t.metricValues[2].value) || 0,
          views: Number(t.metricValues[3].value) || 0,
          avgDuration: Number(t.metricValues[4].value) || 0,
          engagement: Number(t.metricValues[5].value) || 0
        };
      }
      return sumRows(rows);
    }

    var current = totalsOf(0);
    var previous = (main.totals || [])[1] ? totalsOf(1) : null;

    return {
      demo: false,
      rows: rows,
      current: current,
      previous: previous,
      pages: (pages.rows || []).map(function (r) {
        return { label: r.dimensionValues[0].value, views: Number(r.metricValues[0].value) || 0, users: Number(r.metricValues[1].value) || 0 };
      }),
      sources: (sources.rows || []).map(function (r) {
        return { label: r.dimensionValues[0].value, value: Number(r.metricValues[0].value) || 0 };
      }),
      devices: (devices.rows || []).map(function (r) {
        return { label: r.dimensionValues[0].value, value: Number(r.metricValues[0].value) || 0 };
      }),
      realtime: realtime.rows && realtime.rows[0] ? Number(realtime.rows[0].metricValues[0].value) || 0 : 0
    };
  }

  function sumRows(rows) {
    var out = { users: 0, newUsers: 0, sessions: 0, views: 0, avgDuration: 0, engagement: 0 };
    rows.forEach(function (r) {
      out.users += r.users;
      out.newUsers += r.newUsers;
      out.sessions += r.sessions;
      out.views += r.views;
      out.avgDuration += r.avgDuration;
      out.engagement += r.engagement;
    });
    if (rows.length) {
      out.avgDuration = out.avgDuration / rows.length;
      out.engagement = out.engagement / rows.length;
    }
    return out;
  }

  /* ------------------------------------------------------------- demo data */

  function demoData(days) {
    var rows = [];
    var today = new Date();
    var seed = 7;
    function rnd() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(d.getDate() - i);
      var dow = d.getDay();
      var weekend = dow === 0 || dow === 6 ? 1.28 : 1;
      var trend = 1 + (days - i) / (days * 2.4);
      var users = Math.round((150 + rnd() * 90) * weekend * trend);
      rows.push({
        date: dateKey(d),
        users: users,
        newUsers: Math.round(users * (0.42 + rnd() * 0.16)),
        sessions: Math.round(users * (1.24 + rnd() * 0.28)),
        views: Math.round(users * (2.6 + rnd() * 1.1)),
        avgDuration: 78 + rnd() * 46,
        engagement: 0.46 + rnd() * 0.16
      });
    }
    var current = sumRows(rows);
    var previous = {
      users: Math.round(current.users * 0.86),
      newUsers: Math.round(current.newUsers * 0.83),
      sessions: Math.round(current.sessions * 0.88),
      views: Math.round(current.views * 0.85),
      avgDuration: current.avgDuration * 0.94,
      engagement: current.engagement * 0.97
    };
    return {
      demo: true,
      rows: rows,
      current: current,
      previous: previous,
      pages: [
        { label: "/index.html", views: 1842, users: 690 },
        { label: "/catalog.html", views: 1263, users: 498 },
        { label: "/product-detail.html", views: 884, users: 372 },
        { label: "/about.html", views: 402, users: 208 },
        { label: "/contact.html", views: 268, users: 141 },
        { label: "/cart.html", views: 197, users: 96 }
      ],
      sources: [
        { label: "Organic Search", value: 1420 },
        { label: "Direct", value: 860 },
        { label: "Social", value: 512 },
        { label: "Referral", value: 208 },
        { label: "Email", value: 74 }
      ],
      devices: [
        { label: "mobile", value: 2110 },
        { label: "desktop", value: 1180 },
        { label: "tablet", value: 96 }
      ],
      realtime: 7
    };
  }

  /* --------------------------------------------------------------- render */

  function delta(current, previous, invert) {
    if (previous == null || !isFinite(previous) || previous === 0) return "";
    var diff = ((current - previous) / previous) * 100;
    if (!isFinite(diff)) return "";
    var up = diff >= 0;
    var good = invert ? !up : up;
    return (
      '<span class="' +
      (good ? "yw-kpi__hint--up" : "yw-kpi__hint--down") +
      '">' +
      (up ? "▲" : "▼") +
      " " +
      Math.abs(diff).toFixed(1).replace(".", ",") +
      "% vs periode lalu</span>"
    );
  }

  function renderKpis(data) {
    var c = data.current;
    var p = data.previous;
    var map = {
      activeUsers: { value: num(c.users), hint: delta(c.users, p && p.users) },
      newUsers: { value: num(c.newUsers), hint: delta(c.newUsers, p && p.newUsers) },
      sessions: { value: num(c.sessions), hint: delta(c.sessions, p && p.sessions) },
      screenPageViews: { value: num(c.views), hint: delta(c.views, p && p.views) },
      averageSessionDuration: { value: duration(c.avgDuration), hint: delta(c.avgDuration, p && p.avgDuration) },
      engagementRate: { value: pct(c.engagement), hint: delta(c.engagement, p && p.engagement) }
    };
    Object.keys(map).forEach(function (key) {
      var el = $('[data-ga-kpi="' + key + '"]');
      if (!el) return;
      el.textContent = map[key].value;
      var hint = $('[data-ga-kpi-hint="' + key + '"]');
      if (hint) hint.innerHTML = map[key].hint || "&nbsp;";
    });
    var rt = $("[data-ga-realtime]");
    if (rt) rt.textContent = num(data.realtime);
  }

  function renderChart(data) {
    var svg = $("[data-ga-chart]");
    if (!svg) return;
    var rows = data.rows;
    if (!rows.length) {
      svg.innerHTML = "";
      return;
    }
    var W = 640;
    var H = 220;
    var padL = 34;
    var padR = 8;
    var padT = 12;
    var padB = 24;
    var max = Math.max.apply(
      null,
      rows.map(function (r) {
        return r.users;
      })
    );
    max = Math.max(max, 10) * 1.12;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;
    var step = rows.length > 1 ? innerW / (rows.length - 1) : innerW;

    function x(i) {
      return padL + i * step;
    }
    function y(v) {
      return padT + innerH - (v / max) * innerH;
    }

    var line = rows
      .map(function (r, i) {
        return (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(r.users).toFixed(1);
      })
      .join(" ");

    var area = line + " L" + x(rows.length - 1).toFixed(1) + " " + (padT + innerH) + " L" + padL + " " + (padT + innerH) + " Z";

    var grid = "";
    for (var g = 0; g <= 4; g++) {
      var gy = padT + (innerH / 4) * g;
      var val = Math.round(max - (max / 4) * g);
      grid +=
        '<line class="yw-chart__grid" x1="' +
        padL +
        '" y1="' +
        gy.toFixed(1) +
        '" x2="' +
        (W - padR) +
        '" y2="' +
        gy.toFixed(1) +
        '"/>' +
        '<text class="yw-chart__label" x="' +
        (padL - 6) +
        '" y="' +
        (gy + 3).toFixed(1) +
        '" text-anchor="end">' +
        num(val) +
        "</text>";
    }

    var labels = "";
    var every = Math.max(1, Math.ceil(rows.length / 6));
    rows.forEach(function (r, i) {
      if (i % every !== 0 && i !== rows.length - 1) return;
      var parts = r.date.split("-");
      labels +=
        '<text class="yw-chart__label" x="' +
        x(i).toFixed(1) +
        '" y="' +
        (H - 6) +
        '" text-anchor="middle">' +
        parts[2] +
        "/" +
        parts[1] +
        "</text>";
    });

    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML =
      '<defs><linearGradient id="ywChartFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#000000" stop-opacity="0.14"/>' +
      '<stop offset="100%" stop-color="#000000" stop-opacity="0"/>' +
      "</linearGradient></defs>" +
      grid +
      '<path class="yw-chart__area" d="' + area + '"/>' +
      '<path class="yw-chart__line" d="' + line + '"/>' +
      labels;
  }

  function renderPages(data) {
    var body = $("[data-ga-pages]");
    if (!body) return;
    if (!data.pages.length) {
      body.innerHTML = '<tr><td colspan="3" class="yw-tiny">Belum ada data halaman.</td></tr>';
      return;
    }
    var max = data.pages[0].views || 1;
    body.innerHTML = data.pages
      .map(function (p) {
        return (
          "<tr><td>" +
          esc(p.label) +
          '<div class="yw-bar"><span style="width:' +
          Math.max(3, Math.round((p.views / max) * 100)) +
          '%"></span></div></td><td class="yw-muted">' +
          num(p.users) +
          "</td><td>" +
          num(p.views) +
          "</td></tr>"
        );
      })
      .join("");
  }

  function renderList(sel, items, suffix) {
    var el = $(sel);
    if (!el) return;
    if (!items.length) {
      el.innerHTML = '<p class="yw-tiny">Belum ada data.</p>';
      return;
    }
    var total = items.reduce(function (s, i) {
      return s + i.value;
    }, 0) || 1;
    el.innerHTML = items
      .map(function (item) {
        return (
          '<div class="yw-source-row"><div style="flex:1">' +
          '<div style="display:flex;justify-content:space-between;gap:1rem"><span>' +
          esc(item.label) +
          "</span><span>" +
          num(item.value) +
          (suffix || "") +
          "</span></div>" +
          '<div class="yw-bar"><span style="width:' +
          Math.max(2, Math.round((item.value / total) * 100)) +
          '%"></span></div></div></div>'
        );
      })
      .join("");
  }

  function render(data) {
    state.data = data;
    state.mode = data.demo ? "demo" : "live";
    renderKpis(data);
    renderChart(data);
    renderPages(data);
    renderList("[data-ga-sources]", data.sources, "");
    renderList("[data-ga-devices]", data.devices, "");
    var tag = $("[data-ga-mode]");
    if (tag) {
      tag.textContent = data.demo ? "Data contoh (demo)" : "Data live GA4";
      tag.className = "yw-badge " + (data.demo ? "yw-badge--off" : "yw-badge--ok");
    }
    var connectBtn = $("[data-ga-connect]");
    if (connectBtn) {
      connectBtn.textContent = state.mode === "live" ? "Hubungkan ulang" : "Hubungkan Google Analytics";
    }
  }

  function setLoading(on) {
    state.loading = on;
    $$("[data-ga-refresh], [data-ga-range], [data-ga-connect]").forEach(function (el) {
      el.disabled = on;
    });
    var btn = $("[data-ga-refresh]");
    if (btn) btn.textContent = on ? "Memuat…" : "Muat ulang";
  }

  /* ------------------------------------------------------------------ load */

  function load() {
    if (!state.root || state.loading) return;
    setLoading(true);

    var property = state.property;
    var hasLive = !!state.token && /^\d+$/.test(property);

    if (!hasLive) {
      if (CFG.demoWhenUnconfigured !== false) {
        setTimeout(function () {
          render(demoData(state.range));
          setLoading(false);
          if (!CFG.clientId || !property) {
            status(
              '<span class="yw-ga-bar__status"><span class="yw-dot"></span>Mode demo — isi <code>clientId</code> di <code>js/ga-config.js</code> dan Property ID, lalu hubungkan.</span>'
            );
          } else {
            status('<span class="yw-ga-bar__status"><span class="yw-dot"></span>Belum terhubung ke Google Analytics.</span>');
          }
        }, 320);
      } else {
        setLoading(false);
        status('<span class="yw-ga-bar__status"><span class="yw-dot"></span>Belum terhubung ke Google Analytics.</span>', "error");
      }
      return;
    }

    status('<span class="yw-ga-bar__status"><span class="yw-dot"></span>Mengambil data dari GA4…</span>');

    fetchAll(state.range)
      .then(function (data) {
        render(data);
        status(
          '<span class="yw-ga-bar__status"><span class="yw-dot yw-dot--live"></span>Terhubung ke properti ' +
            esc(property) +
            " · " +
            state.range +
            " hari terakhir</span>"
        );
      })
      .catch(function (err) {
        var message = String(err.message || err);
        if (/permission|403|does not have sufficient/i.test(message)) {
          message += " — pastikan akun Google punya akses ke properti GA4 ini.";
        }
        status('<span class="yw-ga-bar__status"><span class="yw-dot"></span>GA4: ' + esc(message) + "</span>", "error");
        if (CFG.demoWhenUnconfigured !== false && !state.data) render(demoData(state.range));
      })
      .then(function () {
        setLoading(false);
      });
  }

  /* ------------------------------------------------------------------ init */

  function init() {
    var root = $("[data-ga-dashboard]");
    if (!root) return;
    state.root = root;

    try {
      state.property = localStorage.getItem(LS_PROP) || CFG.propertyId || "";
      var savedRange = Number(localStorage.getItem(LS_RANGE));
      if (savedRange === 7 || savedRange === 28 || savedRange === 90) state.range = savedRange;
    } catch (e) {
      state.property = CFG.propertyId || "";
    }

    var propInput = $("[data-ga-property]", root);
    if (propInput) {
      propInput.value = state.property;
      propInput.addEventListener("change", function () {
        state.property = propInput.value.replace(/\D/g, "");
        propInput.value = state.property;
        try {
          localStorage.setItem(LS_PROP, state.property);
        } catch (e) {}
        load();
      });
    }

    $$("[data-ga-range]", root).forEach(function (btn) {
      var value = Number(btn.getAttribute("data-ga-range"));
      btn.classList.toggle("is-active", value === state.range);
      btn.addEventListener("click", function () {
        state.range = value;
        $$("[data-ga-range]", root).forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        try {
          localStorage.setItem(LS_RANGE, String(value));
        } catch (e) {}
        load();
      });
    });

    var connectBtn = $("[data-ga-connect]", root);
    if (connectBtn) {
      connectBtn.addEventListener("click", function () {
        if (state.token) {
          clearToken();
          load();
        } else {
          connect();
        }
      });
    }

    var refreshBtn = $("[data-ga-refresh]", root);
    if (refreshBtn) refreshBtn.addEventListener("click", load);

    if (loadToken()) {
      load();
    } else {
      load();
    }
  }

  window.YuwuriAnalytics = {
    init: init,
    refresh: load,
    connect: connect,
    demo: function () {
      render(demoData(state.range));
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
