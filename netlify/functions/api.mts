import type { Config, Context } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const db = getDatabase();
const SESSION_COOKIE = "bbhmm_session";
const SESSION_DAYS = 60;

type User = { id: number; name: string };

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (data: unknown, status = 200) => Response.json(data, { status });

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Ungültige Anfrage");
  }
}

function str(v: unknown, field: string, max = 100): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new HttpError(400, `${field} fehlt`);
  if (s.length > max) throw new HttpError(400, `${field} ist zu lang`);
  return s;
}

async function currentUser(context: Context): Promise<User | null> {
  const token = context.cookies.get(SESSION_COOKIE);
  if (!token) return null;
  const rows = await db.sql<User>`
    SELECT u.id, u.name FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > NOW()`;
  return rows[0] ?? null;
}

async function requireUser(context: Context): Promise<User> {
  const user = await currentUser(context);
  if (!user) throw new HttpError(401, "Nicht angemeldet");
  return user;
}

async function startSession(context: Context, userId: number) {
  const token = randomBytes(32).toString("hex");
  await db.sql`INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, NOW() + make_interval(days => ${SESSION_DAYS}))`;
  context.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    expires: new Date(Date.now() + SESSION_DAYS * 864e5),
  });
}

async function requireMember(groupId: number, userId: number) {
  const rows = await db.sql`SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}`;
  if (!rows.length) throw new HttpError(404, "Gruppe nicht gefunden");
}

function inviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// Splits amount evenly; leftover cents go to the first participants.
function split(amount: number, userIds: number[]) {
  const base = Math.floor(amount / userIds.length);
  const rest = amount - base * userIds.length;
  return userIds.map((id, i) => ({ id, cents: base + (i < rest ? 1 : 0) }));
}

async function groupDetails(groupId: number) {
  const [group] = await db.sql`SELECT id, name, emoji, invite_code, created_by FROM groups WHERE id = ${groupId}`;
  const members = await db.sql<{ id: number; name: string; paid: string; share: string }>`
    SELECT u.id, u.name,
      COALESCE((SELECT SUM(e.amount_cents) FROM expenses e WHERE e.group_id = ${groupId} AND e.paid_by = u.id), 0) AS paid,
      COALESCE((SELECT SUM(s.share_cents) FROM expense_shares s JOIN expenses e ON e.id = s.expense_id
                WHERE e.group_id = ${groupId} AND s.user_id = u.id), 0) AS share
    FROM group_members gm JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ${groupId}
    ORDER BY gm.joined_at`;
  const expenses = await db.sql`
    SELECT e.id, e.title, e.amount_cents, e.paid_by, e.created_by, e.is_settlement, e.created_at,
      COALESCE(json_agg(json_build_object('user_id', s.user_id, 'cents', s.share_cents)) FILTER (WHERE s.user_id IS NOT NULL), '[]') AS shares
    FROM expenses e LEFT JOIN expense_shares s ON s.expense_id = e.id
    WHERE e.group_id = ${groupId}
    GROUP BY e.id
    ORDER BY e.created_at DESC`;
  return {
    group,
    members: members.map((m) => {
      const paid = Number(m.paid);
      const share = Number(m.share);
      return { id: m.id, name: m.name, paid, share, balance: paid - share };
    }),
    expenses,
  };
}

async function route(req: Request, context: Context): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, "").replace(/\/$/, "");
  const method = req.method;
  let m: RegExpMatchArray | null;

  if (path === "/register" && method === "POST") {
    const b = await body(req);
    const name = str(b.name, "Name", 40);
    const password = str(b.password, "Passwort", 200);
    if (password.length < 4) throw new HttpError(400, "Passwort muss mindestens 4 Zeichen haben");
    const exists = await db.sql`SELECT 1 FROM users WHERE LOWER(name) = LOWER(${name})`;
    if (exists.length) throw new HttpError(409, "Name ist schon vergeben");
    const hash = await bcrypt.hash(password, 10);
    const [user] = await db.sql<User>`INSERT INTO users (name, password_hash) VALUES (${name}, ${hash}) RETURNING id, name`;
    await startSession(context, user.id);
    return json({ user });
  }

  if (path === "/login" && method === "POST") {
    const b = await body(req);
    const name = str(b.name, "Name", 40);
    const password = str(b.password, "Passwort", 200);
    const [row] = await db.sql<User & { password_hash: string }>`
      SELECT id, name, password_hash FROM users WHERE LOWER(name) = LOWER(${name})`;
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      throw new HttpError(401, "Name oder Passwort falsch");
    }
    await startSession(context, row.id);
    return json({ user: { id: row.id, name: row.name } });
  }

  if (path === "/logout" && method === "POST") {
    const token = context.cookies.get(SESSION_COOKIE);
    if (token) await db.sql`DELETE FROM sessions WHERE token = ${token}`;
    context.cookies.delete({ name: SESSION_COOKIE, path: "/" });
    return json({ ok: true });
  }

  if (path === "/me" && method === "GET") {
    const user = await currentUser(context);
    if (!user) return json({ user: null, groups: [] });
    const groups = await db.sql<{ id: number; name: string; emoji: string; joined_at: string; expense_count: number }>`
      SELECT g.id, g.name, g.emoji, gm.joined_at,
        (SELECT COUNT(*)::int FROM expenses e WHERE e.group_id = g.id) AS expense_count
      FROM groups g JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.user_id = ${user.id}
      ORDER BY gm.joined_at DESC`;
    const members = await db.sql<{ group_id: number; id: number; name: string; paid: string; share: string }>`
      WITH mine AS (SELECT group_id FROM group_members WHERE user_id = ${user.id}),
      paid AS (
        SELECT group_id, paid_by AS user_id, SUM(amount_cents) AS cents FROM expenses
        WHERE group_id IN (SELECT group_id FROM mine) GROUP BY 1, 2),
      share AS (
        SELECT e.group_id, s.user_id, SUM(s.share_cents) AS cents
        FROM expense_shares s JOIN expenses e ON e.id = s.expense_id
        WHERE e.group_id IN (SELECT group_id FROM mine) GROUP BY 1, 2)
      SELECT gm.group_id, u.id, u.name, COALESCE(p.cents, 0) AS paid, COALESCE(sh.cents, 0) AS share
      FROM group_members gm JOIN users u ON u.id = gm.user_id
      LEFT JOIN paid p ON p.group_id = gm.group_id AND p.user_id = gm.user_id
      LEFT JOIN share sh ON sh.group_id = gm.group_id AND sh.user_id = gm.user_id
      WHERE gm.group_id IN (SELECT group_id FROM mine)
      ORDER BY gm.joined_at`;
    return json({
      user,
      groups: groups.map((g) => ({
        ...g,
        members: members
          .filter((m) => m.group_id === g.id)
          .map((m) => ({ id: m.id, name: m.name, balance: Number(m.paid) - Number(m.share) })),
      })),
    });
  }

  if (path === "/activity" && method === "GET") {
    const user = await requireUser(context);
    const expenses = await db.sql`
      SELECT 'expense' AS type, e.id, e.group_id, g.name AS group_name, g.emoji, e.title, e.amount_cents,
        e.paid_by, payer.name AS payer_name, e.is_settlement, e.created_by AS actor_id, actor.name AS actor_name, e.created_at AS at,
        (SELECT s.share_cents FROM expense_shares s WHERE s.expense_id = e.id AND s.user_id = ${user.id}) AS my_share
      FROM expenses e
      JOIN groups g ON g.id = e.group_id
      JOIN users payer ON payer.id = e.paid_by
      JOIN users actor ON actor.id = e.created_by
      WHERE e.group_id IN (SELECT group_id FROM group_members WHERE user_id = ${user.id})
      ORDER BY e.created_at DESC LIMIT 60`;
    const joins = await db.sql`
      SELECT CASE WHEN gm.user_id = g.created_by THEN 'created' ELSE 'joined' END AS type,
        gm.group_id, g.name AS group_name, g.emoji, gm.user_id AS actor_id, u.name AS actor_name, gm.joined_at AS at
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id IN (SELECT group_id FROM group_members WHERE user_id = ${user.id})
      ORDER BY gm.joined_at DESC LIMIT 60`;
    const items = [...expenses, ...joins]
      .sort((a, b) => new Date(b.at as string).getTime() - new Date(a.at as string).getTime())
      .slice(0, 60);
    return json({ items });
  }

  if (path === "/groups" && method === "POST") {
    const user = await requireUser(context);
    const b = await body(req);
    const name = str(b.name, "Gruppenname", 60);
    const emoji = typeof b.emoji === "string" && b.emoji.trim() && b.emoji.length <= 16 ? b.emoji.trim() : "💸";
    const [group] = await db.sql<{ id: number }>`
      INSERT INTO groups (name, emoji, invite_code, created_by)
      VALUES (${name}, ${emoji}, ${inviteCode()}, ${user.id}) RETURNING id`;
    await db.sql`INSERT INTO group_members (group_id, user_id) VALUES (${group.id}, ${user.id})`;
    return json({ id: group.id }, 201);
  }

  if (path === "/groups/join" && method === "POST") {
    const user = await requireUser(context);
    const code = str((await body(req)).code, "Einladungscode", 20).toUpperCase();
    const [group] = await db.sql<{ id: number }>`SELECT id FROM groups WHERE invite_code = ${code}`;
    if (!group) throw new HttpError(404, "Einladungscode ungültig");
    await db.sql`INSERT INTO group_members (group_id, user_id) VALUES (${group.id}, ${user.id}) ON CONFLICT DO NOTHING`;
    return json({ id: group.id });
  }

  if ((m = path.match(/^\/groups\/(\d+)$/)) && method === "GET") {
    const user = await requireUser(context);
    const groupId = Number(m[1]);
    await requireMember(groupId, user.id);
    return json(await groupDetails(groupId));
  }

  if ((m = path.match(/^\/groups\/(\d+)\/expenses$/)) && method === "POST") {
    const user = await requireUser(context);
    const groupId = Number(m[1]);
    await requireMember(groupId, user.id);
    const b = await body(req);
    const title = str(b.title, "Titel", 100);
    const amount = Math.round(Number(b.amount_cents));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) throw new HttpError(400, "Ungültiger Betrag");
    const paidBy = Number(b.paid_by);
    const participants = Array.isArray(b.participants) ? [...new Set(b.participants.map(Number))] : [];
    if (!participants.length) throw new HttpError(400, "Mindestens eine Person muss betroffen sein");

    const memberRows = await db.sql<{ user_id: number }>`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
    const memberIds = new Set(memberRows.map((r) => r.user_id));
    if (!memberIds.has(paidBy) || participants.some((id) => !memberIds.has(id))) {
      throw new HttpError(400, "Unbekannte Person in der Gruppe");
    }

    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `INSERT INTO expenses (group_id, title, amount_cents, paid_by, created_by, is_settlement)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [groupId, title, amount, paidBy, user.id, b.is_settlement === true],
      );
      for (const s of split(amount, participants)) {
        await client.query("INSERT INTO expense_shares (expense_id, user_id, share_cents) VALUES ($1, $2, $3)", [
          rows[0].id,
          s.id,
          s.cents,
        ]);
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    return json(await groupDetails(groupId), 201);
  }

  if ((m = path.match(/^\/expenses\/(\d+)$/)) && method === "DELETE") {
    const user = await requireUser(context);
    const [expense] = await db.sql<{ group_id: number }>`SELECT group_id FROM expenses WHERE id = ${Number(m[1])}`;
    if (!expense) throw new HttpError(404, "Eintrag nicht gefunden");
    await requireMember(expense.group_id, user.id);
    await db.sql`DELETE FROM expenses WHERE id = ${Number(m[1])}`;
    return json(await groupDetails(expense.group_id));
  }

  throw new HttpError(404, "Nicht gefunden");
}

export default async (req: Request, context: Context) => {
  try {
    return await route(req, context);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Serverfehler" }, 500);
  }
};

export const config: Config = { path: "/api/*" };
