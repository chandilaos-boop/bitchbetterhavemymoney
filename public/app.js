const app = document.getElementById("app");
const state = { user: null, groups: [] };

// ---------- helpers ----------
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fmt = (cents) =>
  (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

const COLORS = ["#3ddc84", "#a3e635", "#34d399", "#facc15", "#5eead4", "#86efac", "#fbbf24", "#bef264"];
const color = (id) => COLORS[id % COLORS.length];
const initials = (name) => name.trim().slice(0, 2).toUpperCase();
const avatar = (u) => `<div class="avatar" style="background:${color(u.id)}">${esc(initials(u.name))}</div>`;

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("show"), 2200);
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
    if (res.status === 401 && path !== "/login") {
      state.user = null;
    }
    throw new Error(data.error || "Etwas ist schiefgelaufen");
  }
  return data;
}

function navigate(path, replace = false) {
  history[replace ? "replaceState" : "pushState"]({}, "", path);
  render();
}

document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (a) {
    e.preventDefault();
    navigate(a.getAttribute("href"));
  }
});
window.addEventListener("popstate", render);

function topbar() {
  return `
    <header class="topbar">
      <a href="/" data-link class="brand" style="color:inherit;text-decoration:none">
        <div class="brand-logo">€</div><span>Better Have My Money</span>
      </a>
      <button class="icon-btn" id="logout" title="Abmelden">Abmelden</button>
    </header>`;
}

function bindLogout() {
  document.getElementById("logout")?.addEventListener("click", async () => {
    await api("/logout", { method: "POST" }).catch(() => {});
    state.user = null;
    navigate("/", true);
  });
}

async function refreshMe() {
  const data = await api("/me");
  state.user = data.user;
  state.groups = data.groups;
}

// ---------- views ----------
function authView(pendingCode) {
  let mode = "login";
  const draw = () => {
    app.innerHTML = `
      <section class="hero">
        <div class="brand-logo">€</div>
        <h1>Better Have My Money</h1>
        <p class="muted">Gemeinsame Ausgaben mit Freunden – fair geteilt.</p>
      </section>
      <form class="card stack" id="auth">
        <div class="tabs">
          <button type="button" data-mode="login" class="${mode === "login" ? "active" : ""}">Anmelden</button>
          <button type="button" data-mode="register" class="${mode === "register" ? "active" : ""}">Registrieren</button>
        </div>
        ${pendingCode ? `<p class="muted small">Melde dich an, um der Gruppe beizutreten (Code <b>${esc(pendingCode)}</b>).</p>` : ""}
        <div>
          <label for="name">Name</label>
          <input type="text" id="name" autocomplete="username" autocapitalize="words" required maxlength="40" placeholder="z. B. Jan">
        </div>
        <div>
          <label for="password">Passwort</label>
          <input type="password" id="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" required placeholder="mind. 4 Zeichen">
        </div>
        <p class="error" id="err"></p>
        <button class="btn block" type="submit">${mode === "login" ? "Anmelden" : "Konto erstellen"}</button>
      </form>`;
    app.querySelectorAll("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => {
        mode = b.dataset.mode;
        draw();
      }),
    );
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
        btn.disabled = false;
      }
    });
  };
  draw();
}

function homeView() {
  const groups = state.groups;
  app.innerHTML = `
    ${topbar()}
    <h1>Hi ${esc(state.user.name)} 👋</h1>
    <p class="muted" style="margin-top:6px">Deine Gruppen</p>

    <div class="list section" style="margin-top:16px">
      ${
        groups.length
          ? groups
              .map(
                (g) => `
        <a class="list-item" href="/g/${g.id}" data-link>
          ${avatar(g)}
          <div class="grow">
            <div class="title">${esc(g.name)}</div>
            <div class="muted small">${g.member_count} ${g.member_count === 1 ? "Person" : "Personen"}</div>
          </div>
          <span class="muted">›</span>
        </a>`,
              )
              .join("")
          : `<div class="card empty">Noch keine Gruppe. Erstell eine oder tritt mit einem Code bei.</div>`
      }
    </div>

    <form class="card stack section" id="create">
      <h2>Neue Gruppe</h2>
      <input type="text" id="gname" placeholder="z. B. WG, Urlaub Kroatien …" maxlength="60" required>
      <button class="btn block" type="submit">Gruppe erstellen</button>
    </form>

    <form class="card stack section" id="join">
      <h2>Gruppe beitreten</h2>
      <input type="text" id="gcode" placeholder="Einladungscode" maxlength="20" required style="text-transform:uppercase">
      <button class="btn ghost block" type="submit">Beitreten</button>
    </form>`;
  bindLogout();

  app.querySelector("#create").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const { id } = await api("/groups", { method: "POST", body: { name: app.querySelector("#gname").value } });
      await refreshMe();
      navigate(`/g/${id}`);
    } catch (err) {
      toast(err.message);
    }
  });
  app.querySelector("#join").addEventListener("submit", async (e) => {
    e.preventDefault();
    joinGroup(app.querySelector("#gcode").value);
  });
}

async function joinGroup(code) {
  try {
    const { id } = await api("/groups/join", { method: "POST", body: { code } });
    await refreshMe();
    navigate(`/g/${id}`, true);
    toast("Willkommen in der Gruppe!");
  } catch (err) {
    toast(err.message);
    navigate("/", true);
  }
}

// Greedy minimal set of transfers to settle all balances.
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

async function groupView(id) {
  app.innerHTML = `${topbar()}<div class="loading">Lädt …</div>`;
  bindLogout();
  let data;
  try {
    data = await api(`/groups/${id}`);
  } catch (err) {
    toast(err.message);
    return navigate("/", true);
  }
  drawGroup(data);
}

function drawGroup({ group, members, expenses }) {
  const me = state.user;
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  const total = expenses.reduce((s, e) => s + e.amount_cents, 0);
  const transfers = settlements(members);
  const inviteUrl = `${location.origin}/join/${group.invite_code}`;

  app.innerHTML = `
    ${topbar()}
    <a href="/" data-link class="back">‹ Gruppen</a>
    <div style="margin:10px 0 4px"><h1>${esc(group.name)}</h1></div>
    <p class="muted">${members.length} ${members.length === 1 ? "Person" : "Personen"} · Gesamt ${fmt(total)}</p>

    <div class="invite section" style="margin-top:16px">
      <div>
        <div class="muted small">Einladungscode</div>
        <div class="code">${esc(group.invite_code)}</div>
      </div>
      <button class="btn small" id="share">Link teilen</button>
    </div>

    <form class="card stack section" id="expense">
      <h2>Neue Ausgabe</h2>
      <div>
        <label for="title">Titel</label>
        <input type="text" id="title" placeholder="z. B. Einkauf, Pizza, Tanken …" maxlength="100" required>
      </div>
      <div>
        <label for="amount">Betrag</label>
        <div class="amount-input">
          <input type="text" id="amount" inputmode="decimal" placeholder="0,00" required autocomplete="off">
          <span>€</span>
        </div>
      </div>
      <div>
        <label for="paid">Bezahlt von</label>
        <select id="paid">
          ${members.map((m) => `<option value="${m.id}" ${m.id === me.id ? "selected" : ""}>${esc(m.name)}${m.id === me.id ? " (du)" : ""}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Betrifft</label>
        <div class="checks">
          ${members
            .map(
              (m) => `
            <label class="check"><input type="checkbox" name="p" value="${m.id}" checked>${esc(m.name)}</label>`,
            )
            .join("")}
        </div>
        <p class="muted small" id="per" style="margin-top:8px"></p>
      </div>
      <button class="btn block" type="submit">Ausgabe speichern</button>
    </form>

    <div class="section">
      <div class="section-head"><h2>Übersicht</h2></div>
      <div class="balances">
        ${members
          .map(
            (m) => `
          <div class="card balance-card">
            <div class="balance-top">
              ${avatar(m)}
              <div class="grow">
                <div class="title" style="font-weight:700">${esc(m.name)}${m.id === me.id ? ' <span class="muted small">(du)</span>' : ""}</div>
              </div>
              <div class="balance-amount ${m.balance > 0 ? "pos" : m.balance < 0 ? "neg" : "muted"}">
                <span class="lbl">${m.balance > 0 ? "bekommt" : m.balance < 0 ? "schuldet" : "ausgeglichen"}</span>
                ${fmt(Math.abs(m.balance))}
              </div>
            </div>
            <div class="stats">
              <div class="stat"><div class="lbl">Ausgegeben</div><div class="val">${fmt(m.paid)}</div></div>
              <div class="stat"><div class="lbl">Anteil gesamt</div><div class="val">${fmt(m.share)}</div></div>
            </div>
          </div>`,
          )
          .join("")}
      </div>
    </div>

    ${
      transfers.length
        ? `<div class="section">
      <div class="section-head"><h2>So wird's ausgeglichen</h2></div>
      <div class="card stack">
        ${transfers
          .map(
            (t) => `<div class="settle">${esc(t.from.name)} <span class="arrow">→</span> ${esc(t.to.name)} <strong>${fmt(t.cents)}</strong></div>`,
          )
          .join("")}
      </div>
    </div>`
        : ""
    }

    <div class="section">
      <div class="section-head"><h2>Ausgaben</h2><span class="muted small">${expenses.length}</span></div>
      <div class="list">
        ${
          expenses.length
            ? expenses
                .map((e) => {
                  const payer = byId[e.paid_by];
                  const names = e.shares.map((s) => byId[s.user_id]?.name ?? "?");
                  const forAll = e.shares.length === members.length;
                  return `
          <div class="list-item expense" style="cursor:default">
            <div class="expense-icon">🧾</div>
            <div class="grow">
              <div class="title">${esc(e.title)}</div>
              <div class="meta">${esc(payer?.name ?? "?")} hat bezahlt · für ${forAll ? "alle" : esc(names.join(", "))}</div>
              <div class="meta">${new Date(e.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}</div>
            </div>
            <div class="amount">${fmt(e.amount_cents)}</div>
            <button class="icon-btn" data-del="${e.id}" title="Löschen">✕</button>
          </div>`;
                })
                .join("")
            : `<div class="card empty">Noch keine Ausgaben eingetragen.</div>`
        }
      </div>
    </div>`;
  bindLogout();

  const form = app.querySelector("#expense");
  const amountEl = form.querySelector("#amount");
  const per = form.querySelector("#per");
  const parseAmount = () => {
    const v = amountEl.value.replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  };
  const checked = () => [...form.querySelectorAll("input[name=p]:checked")].map((c) => Number(c.value));
  const updatePer = () => {
    const n = checked().length;
    const cents = parseAmount();
    per.textContent = n && cents ? `${fmt(Math.floor(cents / n))} pro Person (${n})` : n ? `${n} ${n === 1 ? "Person" : "Personen"}` : "Niemand ausgewählt";
  };
  form.addEventListener("input", updatePer);
  updatePer();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount_cents = parseAmount();
    const participants = checked();
    if (!amount_cents) return toast("Bitte einen gültigen Betrag eingeben");
    if (!participants.length) return toast("Mindestens eine Person auswählen");
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const data = await api(`/groups/${group.id}/expenses`, {
        method: "POST",
        body: { title: form.querySelector("#title").value, amount_cents, paid_by: Number(form.querySelector("#paid").value), participants },
      });
      drawGroup(data);
      toast("Ausgabe gespeichert ✓");
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  });

  app.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Diese Ausgabe löschen?")) return;
      try {
        drawGroup(await api(`/expenses/${b.dataset.del}`, { method: "DELETE" }));
        toast("Gelöscht");
      } catch (err) {
        toast(err.message);
      }
    }),
  );

  app.querySelector("#share").addEventListener("click", async () => {
    const text = `Komm in unsere Gruppe „${group.name}“ bei Better Have My Money:`;
    if (navigator.share) {
      navigator.share({ title: group.name, text, url: inviteUrl }).catch(() => {});
    } else {
      await navigator.clipboard?.writeText(inviteUrl).catch(() => {});
      toast("Einladungslink kopiert");
    }
  });
}

// ---------- router ----------
async function render() {
  const path = location.pathname;
  const join = path.match(/^\/join\/([A-Za-z0-9]+)/);
  if (join) sessionStorage.setItem("pendingJoin", join[1].toUpperCase());

  if (!state.user) return authView(sessionStorage.getItem("pendingJoin"));

  const pending = sessionStorage.getItem("pendingJoin");
  if (pending) {
    sessionStorage.removeItem("pendingJoin");
    return joinGroup(pending);
  }

  const g = path.match(/^\/g\/(\d+)/);
  if (g) return groupView(g[1]);
  if (path !== "/") history.replaceState({}, "", "/");
  homeView();
}

(async () => {
  app.innerHTML = `<div class="loading">Lädt …</div>`;
  try {
    await refreshMe();
  } catch {
    /* not logged in or offline */
  }
  render();
})();
