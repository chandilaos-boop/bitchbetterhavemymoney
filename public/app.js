const app = document.getElementById("app");
const state = { user: null, groups: [] };

// ---------- helpers ----------
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (cents) => (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const firstName = (name) => String(name).trim().split(/\s+/)[0];

const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
  del: (k) => { try { sessionStorage.removeItem(k); } catch {} },
};

const ICONS = {
  groups: '<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="8" r="3.5"/><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.6a3.5 3.5 0 0 1 0 6.8"/>',
  friend: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  activity: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 14l3-3 3 3 4-5"/>',
  account: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.6 18.4a6 6 0 0 1 10.8 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  receipt: '<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

// Deterministic geometric avatar, Splitwise-style but greener.
const PALETTES = [
  ["#0f5a3c", "#34d399", "#a7f3d0"], ["#134e4a", "#2dd4bf", "#99f6e4"], ["#7c2d12", "#fb923c", "#fed7aa"],
  ["#1e3a5f", "#60a5fa", "#bfdbfe"], ["#4c1d95", "#a78bfa", "#ddd6fe"], ["#713f12", "#facc15", "#fef08a"],
  ["#831843", "#f472b6", "#fbcfe8"], ["#365314", "#a3e635", "#d9f99d"], ["#164e63", "#22d3ee", "#a5f3fc"],
];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
function avatar(u, size = 44, cls = "") {
  const h = hash(`${u.id}:${u.name}`);
  const [a, b, c] = PALETTES[h % PALETTES.length];
  const x = 20 + (h % 60), y = 20 + ((h >> 4) % 60), r = (h >> 8) % 4;
  const shapes = [
    `<polygon points="0,0 100,0 ${x},${y}" fill="${b}"/><polygon points="0,100 ${x},${y} 100,100" fill="${c}" opacity=".85"/>`,
    `<polygon points="0,${y} 100,0 100,100" fill="${b}"/><polygon points="${x},100 100,${y} 100,100" fill="${c}"/>`,
    `<polygon points="0,0 ${x},0 0,100" fill="${b}"/><polygon points="100,0 100,100 ${x},${y}" fill="${c}" opacity=".9"/>`,
    `<polygon points="0,0 100,${y} 0,100" fill="${b}"/><polygon points="0,100 ${x},100 0,${y}" fill="${c}"/>`,
  ][r];
  const ini = esc(String(u.name).trim().slice(0, 1).toUpperCase());
  return `<svg class="avatar ${cls}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-label="${esc(u.name)}">
    <clipPath id="c${h}"><circle cx="50" cy="50" r="50"/></clipPath>
    <g clip-path="url(#c${h})"><rect width="100" height="100" fill="${a}"/>${shapes}</g>
    <text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="40" fill="#fff" opacity=".92">${ini}</text>
  </svg>`;
}
function groupTile(g, cls = "") {
  const [a, b] = PALETTES[hash(`g${g.id}`) % PALETTES.length];
  return `<div class="tile ${cls}" style="background:linear-gradient(140deg, ${b}55, ${a})">${esc(g.emoji || "💸")}</div>`;
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("show"), 2400);
}


// ---------- fun stuff ----------
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const buzz = (p = 10) => { try { navigator.vibrate?.(p); } catch {} };
document.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".btn, .pill-btn, .round-btn, .chip, .nav a, .segmented button, .emoji-grid button")) buzz(8);
});

const EMOJI_RULES = [
  [/pizza/, "🍕"], [/d[öo]ner|kebab|anadolu|dürüm/, "🥙"], [/burger|mcdonald|burger king/, "🍔"], [/sushi/, "🍣"],
  [/pommes|imbiss/, "🍟"], [/bier|beer|kasten|späti/, "🍺"], [/wein|sekt|prosecco/, "🍷"], [/cocktail|drinks?\b|schnaps|shots?/, "🍹"],
  [/kaffee|coffee|café|latte/, "☕"], [/\beis\b|gelato/, "🍦"], [/tank|benzin|diesel|sprit/, "⛽"], [/taxi|uber|bolt/, "🚕"],
  [/bahn|zug|\bdb\b|flixbus|bus/, "🚆"], [/flug|flight|ryanair|lufthansa|easyjet/, "✈️"], [/hotel|airbnb|unterkunft|hostel/, "🛏️"],
  [/rewe|edeka|lidl|aldi|netto|penny|einkauf|supermarkt|kaufland/, "🛒"], [/miete|wohnung/, "🏠"], [/strom|gas\b|nebenkosten/, "⚡"],
  [/internet|wlan|wifi|router|handy/, "📡"], [/klopapier|spüli|putz|drogerie|\bdm\b|rossmann/, "🧻"], [/kino|film|netflix|spotify|streaming/, "🍿"],
  [/konzert|festival|ticket/, "🎟️"], [/party|geburtstag|bday/, "🎉"], [/geschenk/, "🎁"], [/restaurant|essen|dinner|lunch|mittag|abendessen/, "🍽️"],
  [/frühstück|brötchen|bäcker|croissant/, "🥐"], [/grill|bbq/, "🍖"], [/club|eintritt|disco/, "🪩"], [/park(en|haus|ticket)/, "🅿️"],
  [/apotheke|medizin|tabletten/, "💊"], [/sport|gym|fitness|bouldern/, "🏋️"], [/spiel|game|playstation|bowling/, "🎮"], [/kippen|zigarette|tabak/, "🚬"],
  [/blumen/, "💐"], [/ski|lift/, "🎿"], [/boot|fähre/, "⛴️"], [/mietwagen|auto|sixt/, "🚗"], [/pfand/, "♻️"],
];
function guessEmoji(title) {
  const t = String(title).toLowerCase();
  for (const [re, e] of EMOJI_RULES) if (re.test(t)) return e;
  return "🧾";
}
function amountVibe(cents) {
  if (!cents) return "";
  const e = cents / 100;
  if (e < 3) return "Kleinvieh macht auch Mist 🐁";
  if (e < 10) return "Peanuts 🥜";
  if (e < 30) return "Geht klar 👌";
  if (e < 75) return "Solide 💪";
  if (e < 150) return "Uff, okay 😮‍💨";
  if (e < 400) return "Big Spender 💸";
  if (e < 1500) return "Wer hat im Lotto gewonnen? 🎰";
  return "Habt ihr ein Auto gekauft?! 🚗";
}
const TITLE_IDEAS = [
  "Döner um 3 Uhr nachts", "Pizza (ja, mit Ananas 🍍)", "Bier für die ganze Crew", "Tanken, weil Kevin fahren wollte",
  "Wocheneinkauf Rewe", "Klopapier-Großeinkauf", "Späti-Runde", "Airbnb Lissabon", "Sushi-Abend", "Kinotickets + Popcorn",
];
const MSG = {
  saved: ["Ka-ching! 🤑", "Notiert. Keiner entkommt 😈", "Gespeichert – jetzt wird kassiert 💰", "Zack, eingetragen ⚡", "Die Buchhaltung ist stolz auf dich 📒"],
  settled: ["Schulden adé! 🕊️", "Ehrenhafter Move 🫡", "Bezahlt wie ein Profi 🤝", "Konto: glücklich 😌"],
  allSettled: ["Alles quitt! Party! 🎉", "Schuldenfrei – sauber! ✨"],
  deleted: ["Weg damit 🗑️", "Hat's nie gegeben 🤫", "Puff – gelöscht 💨"],
  created: ["Gruppe steht! Jetzt Leute einladen 📣", "Neue Gang, neues Glück 🎉"],
  joined: ["Willkommen in der Gang! 🎉", "Du bist drin 😎"],
};
function heroMood(net) {
  if (net > 50000) return pick(["Du bist quasi die Bank 🏦", "Zeit, Zinsen zu verlangen 📈"]);
  if (net > 0) return pick(["Die anderen stehen in deiner Schuld 😏", "Freundlich erinnern ist erlaubt 🔔", "Deine Kohle wartet auf dich 💰"]);
  if (net < -50000) return pick(["Vielleicht mal ein paar Pfandflaschen sammeln? ♻️", "Uff. Zeit für einen Kassensturz 😬"]);
  if (net < 0) return pick(["Zeit, die Spendierhosen anzuziehen 👖", "Ehrensache: zurückzahlen 🫡", "Kleiner Reminder: PayPal existiert 😇"]);
  return pick(["Alles quitt. Zen-Modus 🧘", "Keine Schulden, keine Sorgen ✨"]);
}
function greeting() {
  const h = new Date().getHours();
  const n = esc(firstName(state.user.name));
  if (h < 5) return `Noch wach, ${n}? 🦉`;
  if (h < 11) return `Guten Morgen, ${n} ☀️`;
  if (h < 17) return `Hey ${n} 👋`;
  if (h < 22) return `N'Abend, ${n} 🌆`;
  return `Späte Runde, ${n}? 🌙`;
}

// Count-up animation for elements with data-count (cents); remembers last shown value per key.
const shownCounts = new Map();
function animateCounts(root) {
  root.querySelectorAll("[data-count]").forEach((el) => {
    const to = Number(el.dataset.count);
    const key = el.dataset.key || "";
    const from = shownCounts.has(key) ? shownCounts.get(key) : 0;
    shownCounts.set(key, to);
    if (reducedMotion || from === to) return (el.textContent = fmt(to));
    const start = performance.now(), dur = 900;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 4);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (t < 1) requestAnimationFrame(step);
    };
    el.textContent = fmt(from);
    requestAnimationFrame(step);
  });
}

function fxCanvas() {
  const c = document.createElement("canvas");
  c.className = "fx";
  const dpr = devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  return { c, ctx, W: innerWidth, H: innerHeight };
}
function moneyRain(n = 36, emojis = ["💸", "💶", "🤑", "💰", "🪙"]) {
  if (reducedMotion) return;
  const { c, ctx, W, H } = fxCanvas();
  const ps = Array.from({ length: n }, () => ({
    x: Math.random() * W, y: -40 - Math.random() * H * 0.45, vy: 5 + Math.random() * 4, vx: (Math.random() - 0.5) * 1.2,
    r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.12, s: 22 + Math.random() * 20, e: pick(emojis), ph: Math.random() * 10,
  }));
  let t = 0;
  const step = () => {
    t++;
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of ps) {
      p.vy += 0.04; p.y += p.vy; p.x += p.vx + Math.sin(t / 14 + p.ph) * 0.8; p.r += p.vr;
      if (p.y < H + 50) alive++;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.font = `${p.s}px serif`; ctx.textAlign = "center"; ctx.fillText(p.e, 0, 0);
      ctx.restore();
    }
    if (alive && t < 420) requestAnimationFrame(step);
    else c.remove();
  };
  step();
}
function confetti(x = innerWidth / 2, y = innerHeight * 0.6, n = 90) {
  if (reducedMotion) return;
  const { c, ctx, W, H } = fxCanvas();
  const colors = ["#34d399", "#a7f3d0", "#facc15", "#f472b6", "#60a5fa", "#ffffff", "#fb923c"];
  const ps = Array.from({ length: n }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1, v = 7 + Math.random() * 9;
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, col: pick(colors) };
  });
  let t = 0;
  const step = () => {
    t++;
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, 1 - t / 140);
      ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(t / 6 + p.r)));
      ctx.restore();
    }
    if (t < 140) requestAnimationFrame(step);
    else c.remove();
  };
  step();
}
function shake(el) {
  if (!el) return;
  buzz([20, 40, 20]);
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}
function fail(msg, el) {
  toast(msg);
  shake(el ?? currentSheet?.querySelector(".sheet"));
}

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });
function ago(date) {
  const s = (new Date(date) - Date.now()) / 1000;
  const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [u, sec] of units) if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), u);
  return "gerade eben";
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !["/login", "/register"].includes(path)) {
      state.user = null;
      render();
    }
    throw new Error(data.error || "Etwas ist schiefgelaufen");
  }
  return data;
}

async function refreshMe() {
  const data = await api("/me");
  state.user = data.user;
  state.groups = data.groups;
}

// Greedy minimal set of transfers that settles a group.
function settlements(members) {
  const debtors = members.filter((m) => m.balance < 0).map((m) => ({ ...m, rest: -m.balance }));
  const creditors = members.filter((m) => m.balance > 0).map((m) => ({ ...m, rest: m.balance }));
  debtors.sort((a, b) => b.rest - a.rest);
  creditors.sort((a, b) => b.rest - a.rest);
  const out = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const x = Math.min(debtors[i].rest, creditors[j].rest);
    if (x > 0) out.push({ from: debtors[i], to: creditors[j], cents: x });
    debtors[i].rest -= x;
    creditors[j].rest -= x;
    if (!debtors[i].rest) i++;
    if (!creditors[j].rest) j++;
  }
  return out;
}

// What others owe me (+) / I owe others (-) within a group, per person.
function myDebts(members) {
  const me = state.user.id;
  return settlements(members)
    .filter((t) => t.from.id === me || t.to.id === me)
    .map((t) => (t.to.id === me ? { person: t.from, cents: t.cents } : { person: t.to, cents: -t.cents }));
}

function totals() {
  let owed = 0, owe = 0;
  for (const g of state.groups) {
    const me = g.members.find((m) => m.id === state.user.id);
    if (!me) continue;
    if (me.balance > 0) owed += me.balance;
    else owe -= me.balance;
  }
  return { owed, owe, net: owed - owe };
}

function heroCard() {
  const { owed, owe, net } = totals();
  const label = net > 0 ? "Insgesamt bekommst du" : net < 0 ? "Insgesamt schuldest du" : "Du bist überall quitt";
  return `
    <section class="hero fade-in">
      <div class="hero-deco">${net > 0 ? "🤑" : net < 0 ? "😬" : "🧘"}</div>
      <div class="hero-label">${label}</div>
      <div class="hero-amount money ${net > 0 ? "pos" : net < 0 ? "neg" : ""}" data-count="${Math.abs(net)}" data-key="total">${fmt(Math.abs(net))}</div>
      <div class="hero-mood">${heroMood(net)}</div>
      <div class="hero-sub">
        <span>Du bekommst <b class="money">${fmt(owed)}</b></span>
        <span>Du schuldest <b class="money">${fmt(owe)}</b></span>
      </div>
    </section>`;
}

function statusHtml(cents, { me = true, settledText = "quitt" } = {}) {
  if (!cents) return `<div class="status settled"><div class="lbl">${settledText}</div></div>`;
  const pos = cents > 0;
  const lbl = me ? (pos ? "du bekommst" : "du schuldest") : pos ? "schuldet dir" : "du schuldest";
  return `<div class="status ${pos ? "pos" : "neg"}"><div class="lbl">${lbl}</div><div class="amt money">${fmt(Math.abs(cents))}</div></div>`;
}

// ---------- shell ----------
function shell(content, { nav = null, fab = true } = {}) {
  app.innerHTML = `
    <div class="shell ${nav ? "" : "no-nav"}">${content}</div>
    ${fab && state.groups.length ? `<button class="btn fab" id="fab">${icon("receipt")} Ausgabe hinzufügen</button>` : ""}
    ${nav ? navHtml(nav) : ""}`;
  app.querySelector("#fab")?.addEventListener("click", () => expenseSheet(fab === true ? null : fab));
  animateCounts(app);
}

function navHtml(active) {
  const items = [
    ["/", "groups", "Gruppen"],
    ["/freunde", "friend", "Freunde"],
    ["/aktivitaet", "activity", "Aktivität"],
    ["/konto", "account", "Konto"],
  ];
  return `<nav class="nav">${items
    .map(([href, ic, label]) => `<a href="${href}" data-link class="${active === href ? "active" : ""}">${icon(ic)}<span>${label}</span></a>`)
    .join("")}</nav>`;
}

function navigate(path, replace = false) {
  history[replace ? "replaceState" : "pushState"]({}, "", path);
  render();
  window.scrollTo(0, 0);
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (a) {
    e.preventDefault();
    if (a.getAttribute("href") !== location.pathname) navigate(a.getAttribute("href"));
  }
});
window.addEventListener("popstate", () => {
  closeSheet(true);
  render();
});

// ---------- sheet ----------
let currentSheet = null;
function openSheet(title, html, onMount) {
  closeSheet(true);
  const wrap = document.createElement("div");
  wrap.className = "sheet-backdrop";
  wrap.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-handle"></div>
      <div class="sheet-head"><h2>${esc(title)}</h2><button class="round-btn" data-close aria-label="Schließen">${icon("close")}</button></div>
      <div class="sheet-body">${html}</div>
    </div>`;
  document.body.appendChild(wrap);
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => wrap.classList.add("open"));
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap || e.target.closest("[data-close]")) closeSheet();
  });
  currentSheet = wrap;
  onMount?.(wrap.querySelector(".sheet-body"));
  return wrap.querySelector(".sheet-body");
}
function closeSheet(instant = false) {
  const el = currentSheet;
  if (!el) return;
  currentSheet = null;
  document.body.style.overflow = "";
  if (instant) return el.remove();
  el.classList.remove("open");
  setTimeout(() => el.remove(), 260);
}
document.addEventListener("keydown", (e) => e.key === "Escape" && closeSheet());

// ---------- auth ----------
function authView(pendingCode) {
  let mode = "login";
  const draw = () => {
    app.innerHTML = `
      <div class="shell no-nav">
        <div class="auth fade-in">
          <div class="auth-brand">
            <div class="logo-wrap">
              <span class="orbit o1">💸</span><span class="orbit o2">🍕</span><span class="orbit o3">🍻</span><span class="orbit o4">🪙</span>
              <div class="logo"><img src="/icons/logo.webp" alt="Better Have My Money"></div>
            </div>
            <h1>Better Have<br><span class="shimmer">My Money</span></h1>
            <p>Geld teilen unter Freunden – ohne Excel, ohne Drama, ohne „Ich zahl dir's nächste Woche“. 🎤</p>
          </div>
          <form class="card" id="auth" style="padding:18px">
            <div class="segmented" style="margin-bottom:18px">
              <button type="button" data-mode="login" class="${mode === "login" ? "active" : ""}">Anmelden</button>
              <button type="button" data-mode="register" class="${mode === "register" ? "active" : ""}">Registrieren</button>
            </div>
            ${pendingCode ? `<p class="muted small" style="margin:-4px 0 14px">Melde dich an, um der Gruppe mit Code <b style="color:var(--text)">${esc(pendingCode)}</b> beizutreten.</p>` : ""}
            <label class="field"><span class="field-label">Name</span>
              <input class="input" id="name" autocomplete="username" autocapitalize="words" required maxlength="40" placeholder="z. B. Jan"></label>
            <label class="field"><span class="field-label">Passwort</span>
              <input class="input" type="password" id="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" required placeholder="mind. 4 Zeichen"></label>
            <p class="error" id="err"></p>
            <button class="btn block" type="submit">${mode === "login" ? "Anmelden" : "Konto erstellen"}</button>
            ${mode === "login" ? `<div style="text-align:center;margin-top:12px"><button type="button" class="link-btn" id="forgot">Passwort vergessen?</button></div>` : ""}
          </form>
        </div>
      </div>`;
    app.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { mode = b.dataset.mode; draw(); }));
    app.querySelector("#forgot")?.addEventListener("click", forgotSheet);
    app.querySelector("#auth").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        await api(mode === "login" ? "/login" : "/register", {
          method: "POST",
          body: { name: app.querySelector("#name").value, password: app.querySelector("#password").value },
        });
        await refreshMe();
        render();
      } catch (err) {
        app.querySelector("#err").textContent = err.message;
        shake(app.querySelector("#auth"));
        btn.disabled = false;
      }
    });
  };
  draw();
}

// ---------- groups (home) ----------
function groupsView() {
  const groups = state.groups;
  const rows = groups
    .map((g) => {
      const me = g.members.find((m) => m.id === state.user.id);
      const debts = myDebts(g.members);
      const status = !g.expense_count
        ? `<div class="status none"><div class="lbl">keine Ausgaben</div></div>`
        : statusHtml(me?.balance ?? 0);
      const tree = debts.length
        ? `<div class="tree">${debts
            .slice(0, 4)
            .map((d) =>
              d.cents > 0
                ? `<div>${esc(d.person.name)} schuldet dir <b class="pos money">${fmt(d.cents)}</b></div>`
                : `<div>Du schuldest ${esc(d.person.name)} <b class="neg money">${fmt(-d.cents)}</b></div>`,
            )
            .join("")}</div>`
        : "";
      return `
        <div class="group-block">
          <a class="row" href="/g/${g.id}" data-link>
            ${groupTile(g)}
            <div class="grow">
              <div class="row-title">${esc(g.name)}</div>
              <div class="row-sub">${g.members.length} ${g.members.length === 1 ? "Person" : "Personen"}</div>
            </div>
            ${status}
          </a>
          ${tree}
        </div>`;
    })
    .join("");

  shell(
    `
    <header class="header">
      <div class="title-with-logo"><img class="mini-logo" src="/icons/logo.webp" alt=""><div><h1 class="page-title">Gruppen</h1><p class="greet">${greeting()}</p></div></div>
      <button class="pill-btn" id="new-group">${icon("plus")} Gruppe</button>
    </header>
    ${heroCard()}
    <div class="section">
      ${
        groups.length
          ? `<div class="rows stagger">${rows}</div>`
          : `<div class="empty"><div class="big wobble">🦗</div><b>So leer wie dein Kühlschrank am Monatsende</b>Erstell eine Gruppe für WG, Urlaub oder Kneipentour – oder tritt mit einem Code bei.
             <div style="margin-top:16px"><button class="btn" id="new-group-2">${icon("plus")} Gruppe erstellen</button></div></div>`
      }
    </div>`,
    { nav: "/" },
  );
  app.querySelector("#new-group").addEventListener("click", groupSheet);
  app.querySelector("#new-group-2")?.addEventListener("click", groupSheet);
}

const EMOJIS = ["🏠", "🏖️", "✈️", "🍕", "🍻", "🎉", "🚗", "⛺", "🎿", "🛒", "❤️", "💸"];
function groupSheet() {
  let emoji = EMOJIS[0];
  openSheet(
    "Neue Gruppe",
    `
    <form id="create">
      <div class="field"><span class="field-label">Symbol</span>
        <div class="emoji-grid">${EMOJIS.map((e, i) => `<button type="button" data-e="${e}" class="${i ? "" : "active"}">${e}</button>`).join("")}</div>
      </div>
      <label class="field"><span class="field-label">Name der Gruppe</span>
        <input class="input" id="gname" placeholder="z. B. WG Lassallestr. 19" maxlength="60" required></label>
      <button class="btn block mt" type="submit">Gruppe erstellen</button>
    </form>
    <div class="section" style="margin-top:26px">
      <div class="section-head"><span class="h2">Oder beitreten</span></div>
      <form id="join" style="display:flex;gap:10px">
        <input class="input" id="gcode" placeholder="Einladungscode" maxlength="20" required style="text-transform:uppercase;flex:1">
        <button class="btn ghost" type="submit">Beitreten</button>
      </form>
    </div>`,
    (el) => {
      el.querySelectorAll("[data-e]").forEach((b) =>
        b.addEventListener("click", () => {
          emoji = b.dataset.e;
          el.querySelectorAll("[data-e]").forEach((x) => x.classList.toggle("active", x === b));
        }),
      );
      el.querySelector("#create").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector("button[type=submit]");
        btn.disabled = true;
        try {
          const { id } = await api("/groups", { method: "POST", body: { name: el.querySelector("#gname").value, emoji } });
          await refreshMe();
          closeSheet();
          navigate(`/g/${id}`);
          toast(pick(MSG.created));
          confetti();
        } catch (err) {
          fail(err.message);
          btn.disabled = false;
        }
      });
      el.querySelector("#join").addEventListener("submit", (e) => {
        e.preventDefault();
        closeSheet();
        joinGroup(el.querySelector("#gcode").value);
      });
    },
  );
}

async function joinGroup(code) {
  try {
    const { id } = await api("/groups/join", { method: "POST", body: { code } });
    await refreshMe();
    navigate(`/g/${id}`, true);
    toast(pick(MSG.joined));
    confetti();
  } catch (err) {
    toast(err.message);
    navigate("/", true);
  }
}

// ---------- friends ----------
function friendsView() {
  const people = new Map();
  for (const g of state.groups) {
    for (const m of g.members) if (m.id !== state.user.id && !people.has(m.id)) people.set(m.id, { ...m, cents: 0, groups: [] });
    for (const d of myDebts(g.members)) {
      const p = people.get(d.person.id);
      p.cents += d.cents;
      p.groups.push(g.name);
    }
  }
  const list = [...people.values()].sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents) || a.name.localeCompare(b.name));
  shell(
    `
    <header class="header"><h1 class="page-title">Freunde</h1></header>
    ${heroCard()}
    <div class="section">
      ${
        list.length
          ? `<div class="rows stagger">${list
              .map(
                (p) => `
            <div class="row" style="cursor:default">
              ${avatar(p, 50)}
              <div class="grow">
                <div class="row-title">${esc(p.name)}</div>
                ${p.groups.length ? `<div class="row-sub">${esc(p.groups.join(", "))}</div>` : ""}
              </div>
              ${statusHtml(p.cents, { me: false })}
            </div>`,
              )
              .join("")}</div>`
          : `<div class="empty"><div class="big wobble">🫂</div><b>Freunde kann man nicht kaufen</b>…aber einladen! Teile den Link einer Gruppe – alle, die beitreten, tauchen hier auf.</div>`
      }
    </div>`,
    { nav: "/freunde" },
  );
}

// ---------- activity ----------
async function activityView() {
  shell(`<header class="header"><h1 class="page-title">Aktivität</h1></header><div class="loading"><div class="spinner"></div></div>`, { nav: "/aktivitaet" });
  let items;
  try {
    ({ items } = await api("/activity"));
  } catch (err) {
    return toast(err.message);
  }
  if (location.pathname !== "/aktivitaet") return;
  const me = state.user.id;
  const who = (id, name) => (id === me ? "Du" : esc(name));
  const html = items
    .map((it) => {
      const g = { id: it.group_id, emoji: it.emoji };
      let text, effect = "";
      if (it.type === "expense") {
        if (it.is_settlement) {
          text = `<b>${who(it.paid_by, it.payer_name)}</b> ${it.paid_by === me ? "hast" : "hat"} eine Zahlung über <b>${fmt(it.amount_cents)}</b> in „<b>${esc(it.group_name)}</b>“ eingetragen.`;
        } else {
          text = `<b>${who(it.actor_id, it.actor_name)}</b> ${it.actor_id === me ? "hast" : "hat"} „<b>${esc(it.title)}</b>“ in „<b>${esc(it.group_name)}</b>“ hinzugefügt.`;
        }
        const net = (it.paid_by === me ? it.amount_cents : 0) - (it.my_share ?? 0);
        if (net > 0) effect = `<div class="effect pos money">Du bekommst ${fmt(net)} zurück</div>`;
        else if (net < 0) effect = `<div class="effect neg money">Du schuldest ${fmt(-net)}</div>`;
        else effect = `<div class="effect faint">Nicht beteiligt</div>`;
      } else if (it.type === "reset") {
        text = `<b>${who(it.actor_id, it.actor_name)}</b> ${it.actor_id === me ? "hast" : "hat"} einen Passwort-Reset-Link für <b>${it.target_id === me ? "dich" : esc(it.target_name)}</b> erstellt 🔑`;
      } else if (it.type === "created") {
        text = `<b>${who(it.actor_id, it.actor_name)}</b> ${it.actor_id === me ? "hast" : "hat"} die Gruppe „<b>${esc(it.group_name)}</b>“ erstellt.`;
      } else {
        text = it.actor_id === me
          ? `<b>Du</b> bist der Gruppe „<b>${esc(it.group_name)}</b>“ beigetreten.`
          : `<b>${esc(it.actor_name)}</b> ist der Gruppe „<b>${esc(it.group_name)}</b>“ beigetreten.`;
      }
      return `
        <a class="activity" href="/g/${it.group_id}" data-link>
          <div class="avatar-wrap">${groupTile(g, "sm")}<span class="badge">${avatar({ id: it.actor_id, name: it.actor_name }, 24)}</span></div>
          <div class="grow">${text}${effect}<div class="when">${ago(it.at)}</div></div>
        </a>`;
    })
    .join("");
  app.querySelector(".loading").outerHTML = items.length
    ? `<div class="stagger">${html}</div>`
    : `<div class="empty"><div class="big wobble">🦗</div><b>Totenstille</b>Noch hat niemand Geld ausgegeben. Verdächtig.</div>`;
}

// ---------- account ----------
function accountView() {
  const u = state.user;
  const { net } = totals();
  shell(
    `
    <header class="header"><h1 class="page-title">Konto</h1></header>
    <div class="account-head fade-in">
      ${avatar(u, 92)}
      <h1>${esc(u.name)}</h1>
      <p class="muted">${state.groups.length} ${state.groups.length === 1 ? "Gruppe" : "Gruppen"} · ${net >= 0 ? "bekommst" : "schuldest"} <b class="${net >= 0 ? "pos" : "neg"} money">${fmt(Math.abs(net))}</b></p>
    </div>
    <div class="section">
      <div class="menu">
        <button class="menu-item" id="add-home">${icon("share")}<span class="grow">Zum Home-Bildschirm hinzufügen</span>${icon("chev")}</button>
        <button class="menu-item danger" id="logout">${icon("logout")}<span class="grow">Abmelden</span></button>
      </div>
    </div>`,
    { nav: "/konto" },
  );
  app.querySelector("#logout").addEventListener("click", async () => {
    await api("/logout", { method: "POST" }).catch(() => {});
    state.user = null;
    state.groups = [];
    navigate("/", true);
  });
  app.querySelector("#add-home").addEventListener("click", () =>
    openSheet(
      "Als App installieren",
      `<div class="stack muted">
        <p><b style="color:var(--text)">iPhone (Safari):</b> Tippe unten auf <b style="color:var(--text)">Teilen</b> und dann auf <b style="color:var(--text)">„Zum Home-Bildschirm“</b>.</p>
        <p><b style="color:var(--text)">Android (Chrome):</b> Tippe oben rechts auf <b style="color:var(--text)">⋮</b> und dann auf <b style="color:var(--text)">„App installieren“</b>.</p>
      </div>`,
    ),
  );
}

// ---------- group detail ----------
const groupCache = new Map();
let groupTab = "expenses";

async function groupView(id) {
  const cached = groupCache.get(id);
  if (cached) drawGroup(cached);
  else shell(`<div class="loading"><div class="spinner"></div></div>`, { fab: false });
  try {
    const data = await api(`/groups/${id}`);
    groupCache.set(id, data);
    if (location.pathname === `/g/${id}`) drawGroup(data);
  } catch (err) {
    toast(err.message);
    navigate("/", true);
  }
}

function updateGroup(data) {
  groupCache.set(String(data.group.id), data);
  const g = state.groups.find((x) => x.id === data.group.id);
  if (g) {
    g.members = data.members.map((m) => ({ id: m.id, name: m.name, balance: m.balance }));
    g.expense_count = data.expenses.length;
  }
  if (location.pathname === `/g/${data.group.id}`) drawGroup(data);
}

function myNet(e) {
  const me = state.user.id;
  const mine = e.shares.find((s) => s.user_id === me)?.cents ?? 0;
  return (e.paid_by === me ? e.amount_cents : 0) - mine;
}

function drawGroup(data) {
  const { group, members, expenses } = data;
  const me = members.find((m) => m.id === state.user.id);
  const byId = Object.fromEntries([...(data.former ?? []), ...members].map((m) => [m.id, m]));
  const total = expenses.filter((e) => !e.is_settlement).reduce((s, e) => s + e.amount_cents, 0);
  const transfers = settlements(members);

  let lastMonth = "";
  const expenseRows = expenses
    .map((e) => {
      const d = new Date(e.created_at);
      const month = d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
      const header = month !== lastMonth ? `<div class="month">${month}</div>` : "";
      lastMonth = month;
      const payer = byId[e.paid_by]?.name ?? "?";
      const net = myNet(e);
      const right = e.is_settlement
        ? `<div class="status none"><div class="lbl">Zahlung</div></div>`
        : net
          ? statusHtml(net)
          : `<div class="status none"><div class="lbl">nicht beteiligt</div></div>`;
      const sub = e.is_settlement
        ? `${esc(payer)} → ${esc(byId[e.shares[0]?.user_id]?.name ?? "?")} · ${fmt(e.amount_cents)}`
        : `${e.paid_by === state.user.id ? "Du" : esc(firstName(payer))} · ${fmt(e.amount_cents)}`;
      return `${header}
        <div class="row" data-exp="${e.id}">
          <div class="date-block"><div class="m">${MONTHS[d.getMonth()]}</div><div class="d">${String(d.getDate()).padStart(2, "0")}</div></div>
          <div class="receipt emoji ${e.is_settlement ? "settle" : ""}">${e.is_settlement ? "🤝" : guessEmoji(e.title)}</div>
          <div class="grow"><div class="row-title" style="font-size:16px">${esc(e.title)}</div><div class="row-sub money">${sub}</div></div>
          ${right}
        </div>`;
    })
    .join("");

  const badges = {};
  const topPayer = [...members].sort((a, b) => b.paid - a.paid)[0];
  const topDebtor = [...members].sort((a, b) => a.balance - b.balance)[0];
  if (topPayer?.paid > 0) badges[topPayer.id] = "👑 Sponsor";
  if (topDebtor?.balance < 0 && !badges[topDebtor.id]) badges[topDebtor.id] = "🐌 Schnorrer-Alarm";
  for (const m of members) if (!badges[m.id] && m.paid > 0 && !m.balance) badges[m.id] = "😇 Ehrenmensch";
  const balanceCards = members
    .map(
      (m) => `
      <div class="card balance-card">
        <div class="balance-top">
          ${avatar(m, 42)}
          <div class="grow">${esc(m.name)}${m.id === state.user.id ? ' <span class="faint small">(du)</span>' : ""}${badges[m.id] ? `<div class="badge-chip">${badges[m.id]}</div>` : ""}</div>
          ${m.balance ? `<div class="status ${m.balance > 0 ? "pos" : "neg"}"><div class="lbl">${m.balance > 0 ? "bekommt" : "schuldet"}</div><div class="amt money">${fmt(Math.abs(m.balance))}</div></div>`
                      : `<div class="status settled"><div class="lbl">quitt</div></div>`}
        </div>
        <div class="stats">
          <div class="stat"><div class="lbl">Ausgegeben</div><div class="val money">${fmt(m.paid)}</div></div>
          <div class="stat"><div class="lbl">Anteil gesamt</div><div class="val money">${fmt(m.share)}</div></div>
        </div>
        <div class="member-actions">
          ${m.id === state.user.id
            ? `<button class="btn ghost sm" data-leave>🚪 Gruppe verlassen</button>`
            : `<button class="btn ghost sm" data-reset="${m.id}">🔑 Passwort-Reset</button><button class="btn ghost sm" data-remove="${m.id}">🚪 Entfernen</button>`}
        </div>
      </div>`,
    )
    .join("");

  const transferRows = transfers
    .map(
      (t, i) => `
      <div class="transfer">
        ${avatar(t.from, 32)}
        <div class="grow"><b>${esc(t.from.id === state.user.id ? "Du" : firstName(t.from.name))}</b> → <b>${esc(t.to.id === state.user.id ? "dir" : firstName(t.to.name))}</b><div class="money ${t.to.id === state.user.id ? "pos" : t.from.id === state.user.id ? "neg" : "muted"}" style="font-weight:800">${fmt(t.cents)}</div></div>
        <button class="btn ghost sm" data-settle="${i}">Begleichen</button>
      </div>`,
    )
    .join("");

  shell(
    `
    <header class="header">
      <a href="/" data-link class="round-btn" aria-label="Zurück">${icon("back")}</a>
      <button class="pill-btn" id="invite">${icon("share")} Einladen</button>
    </header>
    <div class="group-head">
      ${groupTile(group, "lg")}
      <h1>${esc(group.name)}</h1>
      <div class="avatar-stack">${members.slice(0, 6).map((m) => avatar(m, 30)).join("")}</div>
      <p class="muted small">${members.length} ${members.length === 1 ? "Person" : "Personen"} · Gesamtausgaben <b style="color:var(--text)" class="money">${fmt(total)}</b></p>
    </div>
    <section class="hero" style="padding:18px 20px">
      <div class="hero-deco">${me?.balance > 0 ? "🤑" : me?.balance < 0 ? "😬" : "🧘"}</div>
      <div class="hero-label">${!me?.balance ? "Du bist in dieser Gruppe quitt" : me.balance > 0 ? "Du bekommst in dieser Gruppe" : "Du schuldest in dieser Gruppe"}</div>
      ${me?.balance ? `<div class="hero-amount money ${me.balance > 0 ? "pos" : "neg"}" style="font-size:34px" data-count="${Math.abs(me.balance)}" data-key="g${group.id}">${fmt(Math.abs(me.balance))}</div>` : ""}
      <div class="hero-mood">${heroMood(me?.balance ?? 0)}</div>
      <div class="hero-sub">
        <span>Ausgegeben <b class="money">${fmt(me?.paid ?? 0)}</b></span>
        <span>Dein Anteil <b class="money">${fmt(me?.share ?? 0)}</b></span>
      </div>
    </section>
    <div class="segmented mt">
      <button data-tab="expenses" class="${groupTab === "expenses" ? "active" : ""}">Ausgaben</button>
      <button data-tab="balances" class="${groupTab === "balances" ? "active" : ""}">Übersicht</button>
    </div>
    <div id="tab" class="fade-in">
      ${
        groupTab === "expenses"
          ? expenses.length
            ? `<div class="rows stagger">${expenseRows}</div>`
            : `<div class="empty mt"><div class="big wobble">🤨</div><b>Verdächtig sparsam hier</b>${members.length < 2 ? "Alleine teilen ist langweilig – lad erst deine Leute ein!" : "Tippe auf „Ausgabe hinzufügen“ und los geht's."}</div>`
          : `<div class="mt stagger">${balanceCards}</div>
             ${transfers.length ? `<div class="section"><div class="section-head"><span class="h2">So wird's ausgeglichen</span></div><div class="card" style="padding:6px 14px">${transferRows}</div></div>` : ""}`
      }
    </div>
    <div class="section" style="text-align:center">
      <span class="faint small">Einladungscode <b class="money" style="letter-spacing:.12em;color:var(--muted)">${esc(group.invite_code)}</b></span>
    </div>`,
    { fab: group.id },
  );

  app.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      groupTab = b.dataset.tab;
      drawGroup(data);
    }),
  );
  app.querySelectorAll("[data-exp]").forEach((r) =>
    r.addEventListener("click", () => expenseDetail(data, expenses.find((e) => String(e.id) === r.dataset.exp))),
  );
  app.querySelectorAll("[data-settle]").forEach((b) =>
    b.addEventListener("click", () => settleSheet(group, transfers[Number(b.dataset.settle)])),
  );
  app.querySelector("#invite").addEventListener("click", () => inviteSheet(group));
  app.querySelectorAll("[data-reset]").forEach((b) =>
    b.addEventListener("click", () => resetSheet(group, byId[b.dataset.reset])),
  );
  app.querySelectorAll("[data-remove]").forEach((b) =>
    b.addEventListener("click", () => removeSheet(group, byId[b.dataset.remove])),
  );
  app.querySelector("[data-leave]")?.addEventListener("click", () => removeSheet(group, me, true));
}

function inviteSheet(group) {
  const url = `${location.origin}/join/${group.invite_code}`;
  openSheet(
    "Leute einladen",
    `
    <div style="text-align:center">
      <p class="muted">Schick diesen Link an deine Freunde. Wer ihn öffnet und sich anmeldet, ist direkt in „${esc(group.name)}“.</p>
      <div class="card mt" style="padding:18px">
        <div class="h2">Einladungscode</div>
        <div class="money" style="font-size:34px;font-weight:800;letter-spacing:.16em;margin-top:6px">${esc(group.invite_code)}</div>
      </div>
      <button class="btn block mt" id="share-link">${icon("share")} Link teilen</button>
      <button class="btn ghost block" id="copy-link" style="margin-top:10px">${icon("link")} Link kopieren</button>
    </div>`,
    (el) => {
      const copy = async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast("Link kopiert ✓");
        } catch {
          prompt("Link kopieren:", url);
        }
      };
      el.querySelector("#copy-link").addEventListener("click", copy);
      el.querySelector("#share-link").addEventListener("click", () => {
        if (navigator.share) navigator.share({ title: group.name, text: `Komm in „${group.name}“ bei Better Have My Money 💸`, url }).catch(() => {});
        else copy();
      });
    },
  );
}

function expenseDetail(data, e) {
  const byId = Object.fromEntries([...(data.former ?? []), ...data.members].map((m) => [m.id, m]));
  const d = new Date(e.created_at);
  const payer = byId[e.paid_by];
  openSheet(
    e.is_settlement ? "Zahlung" : "Ausgabe",
    `
    <div style="display:flex;gap:14px;align-items:center">
      <div class="receipt emoji ${e.is_settlement ? "settle" : ""}" style="width:60px;height:60px;font-size:30px">${e.is_settlement ? "🤝" : guessEmoji(e.title)}</div>
      <div style="min-width:0">
        <div style="font-size:20px;font-weight:800">${esc(e.title)}</div>
        <div class="money" style="font-size:28px;font-weight:800">${fmt(e.amount_cents)}</div>
      </div>
    </div>
    <p class="muted small mt">Eingetragen von ${esc(byId[e.created_by]?.name ?? "?")} am ${d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr</p>
    <div class="people mt">
      <div class="person" style="cursor:default">${avatar(payer ?? { id: 0, name: "?" }, 34)}<span class="grow">${esc(payer?.name ?? "?")} hat ${fmt(e.amount_cents)} bezahlt</span></div>
      ${e.shares
        .map((s) => `<div class="person" style="cursor:default;padding-left:30px">${avatar(byId[s.user_id] ?? { id: s.user_id, name: "?" }, 28)}<span class="grow muted" style="font-weight:500">${esc(byId[s.user_id]?.name ?? "?")} ${e.is_settlement ? "hat erhalten" : "schuldet"}</span><span class="share">${fmt(s.cents)}</span></div>`)
        .join("")}
    </div>
    <button class="btn danger block mt" id="del">${icon("trash")} Löschen</button>`,
    (el) =>
      el.querySelector("#del").addEventListener("click", async () => {
        if (!confirm(`„${e.title}“ löschen?\nDas Geld ist dadurch leider trotzdem weg 🕵️`)) return;
        try {
          updateGroup(await api(`/expenses/${e.id}`, { method: "DELETE" }));
          closeSheet();
          toast(pick(MSG.deleted));
        } catch (err) {
          toast(err.message);
        }
      }),
  );
}

function settleSheet(group, t) {
  const me = state.user.id;
  const fromName = t.from.id === me ? "Du" : t.from.name;
  const toName = t.to.id === me ? "dir" : t.to.name;
  openSheet(
    "Schulden begleichen",
    `
    <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin:4px 0 18px">
      ${avatar(t.from, 60)}<span class="muted">${icon("chev")}</span>${avatar(t.to, 60)}
    </div>
    <p style="text-align:center;font-size:17px"><b>${esc(fromName)}</b> ${t.from.id === me ? "zahlst" : "zahlt"} <b>${esc(toName)}</b></p>
    <div class="amount-field mt"><input id="amt" inputmode="decimal" value="${(t.cents / 100).toFixed(2).replace(".", ",")}"><span>€</span></div>
    <p class="muted small" style="text-align:center;margin-top:10px">Trag das ein, wenn das Geld wirklich geflossen ist (bar, PayPal, Überweisung …).</p>
    <button class="btn block mt" id="ok">Zahlung eintragen</button>`,
    (el) =>
      el.querySelector("#ok").addEventListener("click", async (ev) => {
        const cents = parseAmount(el.querySelector("#amt").value);
        if (!cents) return fail("Ohne Betrag kein Deal 🙃");
        ev.target.disabled = true;
        try {
          const data = await api(`/groups/${group.id}/expenses`, {
            method: "POST",
            body: { title: "Ausgleich", amount_cents: cents, paid_by: t.from.id, participants: [t.to.id], is_settlement: true },
          });
          updateGroup(data);
          closeSheet();
          const allSettled = data.members.every((m) => !m.balance);
          toast(pick(allSettled ? MSG.allSettled : MSG.settled));
          moneyRain(allSettled ? 60 : 30, allSettled ? ["🎉", "🥳", "💸", "✨", "🍾"] : ["🤝", "💸", "🕊️", "💶"]);
        } catch (err) {
          toast(err.message);
          ev.target.disabled = false;
        }
      }),
  );
}

// ---------- add expense ----------
function parseAmount(raw) {
  let v = String(raw).replace(/[\s€]/g, "");
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

async function expenseSheet(presetGroupId) {
  let groupId = presetGroupId ?? (state.groups.length === 1 ? state.groups[0].id : null);
  const body = openSheet(
    "Neue Ausgabe",
    `
    ${presetGroupId ? "" : `
      <div class="field"><span class="field-label">Gruppe</span>
        <div class="chips">${state.groups
          .map((g) => `<button type="button" class="chip ${g.id === groupId ? "active" : ""}" data-g="${g.id}"><span style="font-size:18px">${esc(g.emoji)}</span>${esc(g.name)}</button>`)
          .join("")}</div>
      </div>`}
    <form id="exp">
      <label class="field"><span class="field-label">Titel</span>
        <div class="input-icon"><span class="title-emoji" id="temoji">🧾</span><input class="input" id="title" placeholder="${esc(pick(TITLE_IDEAS))}" maxlength="100" required autocomplete="off"></div></label>
      <div class="field"><span class="field-label">Betrag</span>
        <label class="amount-field"><input id="amount" inputmode="decimal" placeholder="0,00" required autocomplete="off"><span>€</span></label>
        <p class="vibe" id="vibe"></p></div>
      <div id="who"></div>
      <button class="btn block mt" type="submit" id="save">Ausgabe speichern</button>
    </form>`,
  );

  const who = body.querySelector("#who");
  const amountEl = body.querySelector("#amount");
  let members = [];

  const updateShares = () => {
    const checked = [...who.querySelectorAll(".check:checked")].map((c) => Number(c.value));
    const cents = parseAmount(amountEl.value);
    const n = checked.length;
    who.querySelectorAll(".person").forEach((p) => {
      const on = p.querySelector(".check").checked;
      const idx = checked.indexOf(Number(p.querySelector(".check").value));
      const share = on && n && cents ? Math.floor(cents / n) + (idx < cents % n ? 1 : 0) : 0;
      p.querySelector(".share").textContent = on && cents ? fmt(share) : "";
    });
    const vibe = body.querySelector("#vibe");
    const v = amountVibe(cents);
    if (vibe.textContent !== v) { vibe.textContent = v; vibe.classList.remove("pop"); void vibe.offsetWidth; vibe.classList.add("pop"); }
    const te = body.querySelector("#temoji");
    const em = guessEmoji(body.querySelector("#title").value);
    if (te.textContent !== em) { te.textContent = em; te.classList.remove("pop"); void te.offsetWidth; te.classList.add("pop"); }
    const all = who.querySelector("#all");
    if (all) all.textContent = n === members.length ? "Keinen" : "Alle";
    const hint = who.querySelector("#hint");
    if (hint) hint.textContent = n === 0 ? "Wähl mindestens eine Person aus 👆" : n === 1 ? "Nur eine Person? Großzügig 😇" : n === members.length ? `Alle ${n} sind dabei – fair is fair 🤝` : `Geteilt durch ${n} Personen`;
  };

  const loadMembers = async () => {
    if (!groupId) {
      who.innerHTML = `<p class="muted small mt" style="text-align:center">Wähl zuerst eine Gruppe aus.</p>`;
      return;
    }
    const cached = groupCache.get(String(groupId));
    members = cached?.members ?? state.groups.find((g) => g.id === groupId)?.members ?? [];
    who.innerHTML = `
      <label class="field"><span class="field-label">Bezahlt von</span>
        <select class="select" id="paid">${members
          .map((m) => `<option value="${m.id}" ${m.id === state.user.id ? "selected" : ""}>${esc(m.name)}${m.id === state.user.id ? " (du)" : ""}</option>`)
          .join("")}</select></label>
      <div class="field">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="field-label">Betrifft</span><button type="button" class="link-btn" id="all">Keinen</button>
        </div>
        <div class="people">${members
          .map(
            (m) => `
          <label class="person">${avatar(m, 34)}<span class="grow">${esc(m.name)}${m.id === state.user.id ? ' <span class="faint small">(du)</span>' : ""}</span>
            <span class="share"></span><input type="checkbox" class="check" value="${m.id}" checked></label>`,
          )
          .join("")}</div>
        <p class="faint small" id="hint" style="margin:8px 2px 0"></p>
      </div>`;
    who.querySelector("#all").addEventListener("click", () => {
      const boxes = [...who.querySelectorAll(".check")];
      const allOn = boxes.every((c) => c.checked);
      boxes.forEach((c) => (c.checked = !allOn));
      updateShares();
    });
    updateShares();
  };

  body.querySelectorAll("[data-g]").forEach((b) =>
    b.addEventListener("click", () => {
      groupId = Number(b.dataset.g);
      body.querySelectorAll("[data-g]").forEach((x) => x.classList.toggle("active", x === b));
      loadMembers();
    }),
  );
  body.addEventListener("input", updateShares);
  body.addEventListener("change", updateShares);
  await loadMembers();
  setTimeout(() => body.querySelector("#title")?.focus(), 300);

  body.querySelector("#exp").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!groupId) return fail("Erst eine Gruppe wählen 👆");
    const amount_cents = parseAmount(amountEl.value);
    const participants = [...who.querySelectorAll(".check:checked")].map((c) => Number(c.value));
    if (!amount_cents) return fail("Ohne Betrag kein Deal 🙃");
    if (!participants.length) return fail("Irgendwer muss das ja bezahlen 👀");
    const btn = body.querySelector("#save");
    btn.disabled = true;
    try {
      const data = await api(`/groups/${groupId}/expenses`, {
        method: "POST",
        body: { title: body.querySelector("#title").value, amount_cents, paid_by: Number(who.querySelector("#paid").value), participants },
      });
      updateGroup(data);
      closeSheet();
      toast(pick(MSG.saved));
      moneyRain(amount_cents >= 10000 ? 50 : 26, ["💸", "💶", "🤑", guessEmoji(body.querySelector("#title").value)].filter((x) => x !== "🧾"));
      if (location.pathname !== `/g/${groupId}`) {
        groupTab = "expenses";
        navigate(`/g/${groupId}`);
      }
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  });
}


function resetSheet(group, person) {
  openSheet(
    "Passwort zurücksetzen",
    `
    <div style="text-align:center">
      <div style="display:flex;justify-content:center;margin-bottom:12px">${avatar(person, 72)}</div>
      <p><b>${esc(person.name)}</b> hat das Passwort vergessen? Kein Drama.</p>
      <p class="muted small" style="margin-top:8px">Du erstellst einen Link, mit dem ${esc(firstName(person.name))} ein neues Passwort setzen kann.
        Er gilt <b style="color:var(--text)">24 Stunden</b> und nur <b style="color:var(--text)">einmal</b>. Die Gruppe sieht im Aktivitäts-Feed, dass du ihn erstellt hast.</p>
      <p class="muted small" style="margin-top:8px">⚠️ Nur machen, wenn ${esc(firstName(person.name))} dich wirklich darum gebeten hat.</p>
      <button class="btn block mt" id="mk">🔑 Reset-Link erstellen</button>
    </div>`,
    (el) =>
      el.querySelector("#mk").addEventListener("click", async (ev) => {
        ev.target.disabled = true;
        try {
          const { token } = await api(`/groups/${group.id}/members/${person.id}/reset`, { method: "POST" });
          const url = `${location.origin}/reset/${token}`;
          el.innerHTML = `
            <div style="text-align:center">
              <div class="big wobble" style="font-size:48px">🔑</div>
              <p class="mt">Schick diesen Link an <b>${esc(person.name)}</b>:</p>
              <div class="card mt money" style="word-break:break-all;font-size:13.5px;padding:12px">${esc(url)}</div>
              <button class="btn block mt" id="share-reset">${icon("share")} Link senden</button>
              <button class="btn ghost block" id="copy-reset" style="margin-top:10px">${icon("link")} Kopieren</button>
            </div>`;
          const copy = async () => {
            try { await navigator.clipboard.writeText(url); toast("Link kopiert ✓"); } catch { prompt("Link kopieren:", url); }
          };
          el.querySelector("#copy-reset").addEventListener("click", copy);
          el.querySelector("#share-reset").addEventListener("click", () => {
            if (navigator.share) navigator.share({ title: "Neues Passwort", text: `Hier kannst du dein Passwort für Better Have My Money neu setzen 🔑`, url }).catch(() => {});
            else copy();
          });
        } catch (err) {
          fail(err.message);
          ev.target.disabled = false;
        }
      }),
  );
}

function removeSheet(group, person, self = false) {
  const blocked = person.balance !== 0;
  openSheet(
    self ? "Gruppe verlassen" : "Mitglied entfernen",
    `
    <div style="text-align:center">
      <div style="display:flex;justify-content:center;margin-bottom:12px">${self ? groupTile(group, "lg") : avatar(person, 72)}</div>
      ${blocked
        ? `<p><b>${self ? "Du" : esc(person.name)}</b> ${self ? (person.balance > 0 ? "bekommst" : "schuldest") : person.balance > 0 ? "bekommt" : "schuldet"} noch <b class="${person.balance > 0 ? "pos" : "neg"} money">${fmt(Math.abs(person.balance))}</b>.</p>
           <p class="muted small" style="margin-top:8px">Erst ausgleichen (Übersicht → „Begleichen“) oder die Ausgaben löschen – dann klappt's. Sonst würde die Rechnung der anderen nicht mehr aufgehen 🧮</p>
           <button class="btn ghost block mt" data-close>Okay</button>`
        : `<p>${self ? `Willst du „<b>${esc(group.name)}</b>“ wirklich verlassen?` : `<b>${esc(person.name)}</b> aus „<b>${esc(group.name)}</b>“ entfernen?`}</p>
           <p class="muted small" style="margin-top:8px">${self ? "Du kannst jederzeit mit dem Einladungscode zurückkommen." : `Alte Ausgaben bleiben erhalten. ${esc(firstName(person.name))} kann mit dem Einladungscode wieder beitreten.`}</p>
           <button class="btn danger block mt" id="rm">🚪 ${self ? "Verlassen" : "Entfernen"}</button>`}
    </div>`,
    (el) =>
      el.querySelector("#rm")?.addEventListener("click", async (ev) => {
        ev.target.disabled = true;
        try {
          const res = await api(`/groups/${group.id}/members/${person.id}`, { method: "DELETE" });
          closeSheet();
          if (res.left) {
            groupCache.delete(String(group.id));
            await refreshMe();
            navigate("/", true);
            toast("Tschüss, Gruppe 👋");
          } else {
            updateGroup(res);
            await refreshMe();
            toast(`${firstName(person.name)} ist raus 👋`);
          }
        } catch (err) {
          fail(err.message);
          ev.target.disabled = false;
        }
      }),
  );
}

function resetView(token) {
  app.innerHTML = `<div class="shell no-nav"><div class="loading"><div class="spinner"></div></div></div>`;
  api(`/reset/${token}`)
    .then(({ name, creator }) => {
      app.innerHTML = `
        <div class="shell no-nav">
          <div class="auth fade-in">
            <div class="auth-brand">
              <div class="logo-wrap"><span class="orbit o1">🔑</span><span class="orbit o3">✨</span><div class="logo"><img src="/icons/logo.webp" alt="Better Have My Money"></div></div>
              <h1>Hi ${esc(firstName(name))}! 👋</h1>
              <p>${esc(creator)} hat dir diesen Link geschickt. Setz einfach ein neues Passwort – diesmal merken 😉</p>
            </div>
            <form class="card" id="rs" style="padding:18px">
              <label class="field"><span class="field-label">Neues Passwort</span>
                <input class="input" type="password" id="pw" autocomplete="new-password" required placeholder="mind. 4 Zeichen"></label>
              <p class="error" id="err"></p>
              <button class="btn block" type="submit">Passwort speichern</button>
            </form>
          </div>
        </div>`;
      app.querySelector("#rs").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector("button");
        btn.disabled = true;
        try {
          await api(`/reset/${token}`, { method: "POST", body: { password: app.querySelector("#pw").value } });
          await refreshMe();
          history.replaceState({}, "", "/");
          render();
          toast("Neues Passwort gesetzt 🎉");
          confetti();
        } catch (err) {
          app.querySelector("#err").textContent = err.message;
          shake(app.querySelector("#rs"));
          btn.disabled = false;
        }
      });
    })
    .catch((err) => {
      app.innerHTML = `
        <div class="shell no-nav"><div class="auth fade-in">
          <div class="empty"><div class="big wobble">⌛</div><b>Link ungültig</b>${esc(err.message)}. Frag einfach nochmal nach einem neuen.
            <div style="margin-top:16px"><a class="btn" href="/" id="home">Zur Anmeldung</a></div></div>
        </div></div>`;
      app.querySelector("#home").addEventListener("click", (e) => { e.preventDefault(); history.replaceState({}, "", "/"); render(); });
    });
}

function forgotSheet() {
  openSheet(
    "Passwort vergessen? 🙈",
    `<div class="stack">
      <p>Kein Problem – deine Freunde retten dich:</p>
      <div class="card stack small">
        <p>1️⃣ Schreib jemandem aus deiner Gruppe (z. B. per WhatsApp).</p>
        <p>2️⃣ Die Person öffnet die Gruppe → <b>Übersicht</b> → bei dir auf <b>🔑 Passwort-Reset</b>.</p>
        <p>3️⃣ Sie schickt dir den Link – du setzt ein neues Passwort. Fertig!</p>
      </div>
      <p class="muted small">Der Link gilt 24 Stunden und nur einmal.</p>
      <button class="btn ghost block" data-close>Alles klar</button>
    </div>`,
  );
}

// ---------- router ----------
async function render() {
  const path = location.pathname;
  const join = path.match(/^\/join\/([A-Za-z0-9]+)/);
  if (join) {
    store.set("pendingJoin", join[1].toUpperCase());
    history.replaceState({}, "", "/");
  }

  const reset = path.match(/^\/reset\/([A-Za-z0-9_-]+)/);
  if (reset) return resetView(reset[1]);

  if (!state.user) return authView(store.get("pendingJoin"));

  const pending = store.get("pendingJoin");
  if (pending) {
    store.del("pendingJoin");
    return joinGroup(pending);
  }

  const g = path.match(/^\/g\/(\d+)/);
  if (g) return groupView(g[1]);
  if (path === "/freunde") return friendsView();
  if (path === "/aktivitaet") return activityView();
  if (path === "/konto") return accountView();
  if (path !== "/") history.replaceState({}, "", "/");
  groupsView();
  refreshMe()
    .then(() => location.pathname === "/" && !currentSheet && groupsViewIfChanged())
    .catch(() => {});
}

let lastGroupsJson = "";
function groupsViewIfChanged() {
  const j = JSON.stringify(state.groups);
  if (j !== lastGroupsJson) {
    lastGroupsJson = j;
    groupsView();
  }
}

(async () => {
  app.innerHTML = `<div class="loading" style="min-height:100dvh"><div class="spinner"></div></div>`;
  try {
    await refreshMe();
    lastGroupsJson = JSON.stringify(state.groups);
  } catch {
    /* not logged in or offline */
  }
  render();
})();
