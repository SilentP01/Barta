const crypto = require("crypto");
const fs = require("fs/promises");
const http = require("http");
const https = require("https");
const path = require("path");
const { Pool } = require("pg");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK for FCM V1
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
  }
} catch (e) {
  console.log("Firebase Admin not initialized: ", e.message);
}




process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});


const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const SESSION_COOKIE = "p2p_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;
const MAGIC_LINK_TTL_MS = 10 * 60 * 1000;
const MAX_ONLINE_USERS = Number(process.env.MAX_ONLINE_USERS || 250);
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const SERVER_RUN_ID = crypto.randomBytes(8).toString("hex");
const LATEST_APP_VERSION_CODE = 2;

const online = new Map();
const pendingRequests = new Map();
const rateLimits = new Map();


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX || 12),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on("error", (err) => {
  console.error("🔥 Unexpected PG error:", err);
});

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

async function initDatabase() {
  await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS otps (
    id TEXT PRIMARY KEY,
    purpose TEXT NOT NULL,
    user_id TEXT,
    email TEXT NOT NULL,
    username TEXT,
    password_hash TEXT,
    code_hash TEXT NOT NULL,
    expires_at BIGINT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS magic_links (
    id TEXT PRIMARY KEY,
    purpose TEXT NOT NULL,
    user_id TEXT,
    email TEXT NOT NULL,
    username TEXT,
    password_hash TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at BIGINT NOT NULL,
    used_at BIGINT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_magic_links_token_hash ON magic_links(token_hash);
  CREATE INDEX IF NOT EXISTS idx_magic_links_email_purpose ON magic_links(email, purpose);
  `);

  // Safe migration: add fcm_token column if not exists
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;`).catch(() => {});


  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at BIGINT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS friends (
      user_id_1 TEXT NOT NULL,
      user_id_2 TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at BIGINT NOT NULL,
      PRIMARY KEY (user_id_1, user_id_2),
      FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE
    );
  `).catch(() => {});
}

async function one(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

async function run(sql, params = []) {
  await pool.query(sql, params);
}

async function createUser(user) {
  await run(
    "INSERT INTO users (id, username, email, password_hash, email_verified, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [user.id, user.username, user.email, user.passwordHash, 1, new Date().toISOString()]
  );
}

async function findUserByEmail(email) {
  return one("SELECT id, username, email, password_hash, email_verified FROM users WHERE email = $1", [email]);
}

async function findUserByUsername(username) {
  return one("SELECT id, username, email, password_hash, email_verified FROM users WHERE username = $1", [username]);
}

async function findUserByIdentifier(identifier) {
  return one("SELECT id, username, email, password_hash, email_verified FROM users WHERE email = $1 OR username = $1", [identifier]);
}

async function findUserById(id) {
  return one("SELECT id, username, email, password_hash, email_verified FROM users WHERE id = $1", [id]);
}

async function updateUserEmail(email, userId) {
  await run("UPDATE users SET email = $1, email_verified = 1 WHERE id = $2", [email, userId]);
}

async function updateUserPassword(passwordHash, userId) {
  await run("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt}$${derivedKey.toString("hex")}`);
    });
  });
}

function verifyPassword(password, passwordHash) {
  return new Promise((resolve, reject) => {
    const [scheme, salt, hash] = String(passwordHash).split("$");
    if (scheme !== "scrypt" || !salt || !hash) return resolve(false);
    crypto.scrypt(String(password), salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, submitted) => {
      if (err) return reject(err);
      const stored = Buffer.from(hash, "hex");
      resolve(stored.length === submitted.length && crypto.timingSafeEqual(stored, submitted));
    });
  });
}

function safeUser(user) {
  return { id: user.id, username: user.username };
}

function safeSelfUser(user) {
  return { id: user.id, username: user.username, email: user.email };
}

// ── FCM push notification ─────────────────────────────────────────────────────
async function sendFcmPush(fcmToken, fromUser) {
  if (!fcmToken || !admin.apps.length) return;

  const message = {
    token: fcmToken,
    data: {
      type: "incoming-request",
      fromId: String(fromUser.id),
      fromUsername: fromUser.username
    },
    notification: {
      title: "Incoming Connection Request",
      body: `${fromUser.username} wants to connect with you`
    },
    android: {
      priority: "high",
      notification: { channelId: "barta_calls" }
    }
  };

  try {
    await admin.messaging().send(message);
  } catch (error) {
    console.error("FCM error:", error.message);
  }
}


function requireFields(fields, body) {
  return fields.every((field) => typeof body[field] === "string" && body[field].trim());
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function sendJsonWithHeaders(res, status, data, headers) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...headers
  });
  res.end(body);
}

function cookieOptions(req, maxAge) {
  const secure = req.socket.encrypted || req.headers["x-forwarded-proto"] === "https";
  return `HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(maxAge / 1000)}${secure ? "; Secure" : ""}`;
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((cookie) => cookie.trim().split("="))
      .filter(([key, value]) => key && value)
  );
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getBaseUrl(req) {
  const proto =
    req.headers["x-forwarded-proto"] ||
    (req.socket.encrypted ? "https" : "http");

  const host =
    req.headers["x-forwarded-host"] ||
    req.headers.host ||
    process.env.RAILWAY_PUBLIC_DOMAIN;

  return `${proto}://${host}`;
}

async function createSession(user) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  await run("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)", [crypto.randomUUID(), user.id, tokenHash, Date.now() + SESSION_TTL_MS]);
  return token;
}

async function getSessionUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = await one("SELECT user_id, expires_at FROM sessions WHERE token_hash = $1", [tokenHash]);
  if (!row || row.expires_at <= Date.now()) {
    await run("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
    return null;
  }
  return findUserById(row.user_id);
}

async function clearSession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) await run("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  return sendJsonWithHeaders(res, 200, { ok: true }, { "Set-Cookie": `${SESSION_COOKIE}=; ${cookieOptions(req, 0)}` });
}

function getClientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function rateLimit(req, key) {
  const id = `${key}:${getClientIp(req)}`;
  const now = Date.now();
  const record = rateLimits.get(id);
  if (!record || record.resetAt <= now) {
    rateLimits.set(id, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  record.count += 1;
  return record.count > RATE_LIMIT_MAX;
}

function validateSignup(email, username, password, passwordConfirm) {
  const blockedPasswords = new Set([
    "password123",
    "password1234",
    "password@123",
    "admin12345",
    "qwerty12345",
    "welcome123",
    "letmein123"
  ]);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Use a valid email.";
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return "Username must be 3-24 letters, numbers, or underscores.";
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (password !== passwordConfirm) return "Passwords do not match.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include uppercase, lowercase, and a number.";
  }
  if (blockedPasswords.has(password.toLowerCase())) return "Use a stronger password.";
  return "";
}

function validatePassword(password) {
  const blockedPasswords = new Set([
    "password123", "password1234", "password@123",
    "admin12345", "qwerty12345", "welcome123", "letmein123"
  ]);
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password))
    return "Password must include uppercase, lowercase, and a number.";
  if (blockedPasswords.has(password.toLowerCase())) return "Use a stronger password.";
  return "";
}

async function createAndSendMagicLink({ req, userId = null, email, purpose, subject, username = null, passwordHash = null, path }) {
  await run("DELETE FROM magic_links WHERE expires_at <= $1 OR used_at IS NOT NULL", [Date.now()]);
  const token = purpose === "signup" || purpose === "password-reset" ? String(Math.floor(100000 + Math.random() * 900000)) : crypto.randomBytes(32).toString("base64url");
  await run(
    "INSERT INTO magic_links (id, purpose, user_id, email, username, password_hash, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    [crypto.randomUUID(), purpose, userId, email, username, passwordHash, hashToken(token), Date.now() + MAGIC_LINK_TTL_MS, new Date().toISOString()]
  );
  const link = `${getBaseUrl(req)}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  
  const textContent = `Dear User,\n\nYour verification code is: ${token}\n\nYou can also click this secure link to continue: ${link}\n\nThis will be valid for 10 minutes.`;
  const htmlContent = `<p>Dear User,</p><h2>Your verification code is: ${token}</h2><p>You can also <a href="${link}">click this secure link to continue</a></p><p>This will be valid for 10 minutes.</p>`;

  const provider = String(process.env.EMAIL_PROVIDER || "brevo").toLowerCase();
  const apiKey = process.env.EMAIL_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || "no-reply.Barta";
  if (!apiKey || !fromEmail) throw new Error("Email service is not configured.");

  if (provider === "sendgrid") {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: email }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [{ type: "text/plain", value: textContent }, { type: "text/html", value: htmlContent }]
      })
    });
    if (!response.ok) throw new Error("Email API failed.");
    return;
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { accept: "application/json", "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: email }],
      subject,
      textContent,
      htmlContent
    })
  });
  if (!response.ok) throw new Error("Email API failed.");
}

function emailServiceReady() {
  return Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);
}

async function consumeMagicLink(token, purpose) {
  await run("DELETE FROM magic_links WHERE expires_at <= $1 OR used_at IS NOT NULL", [Date.now()]);
  const link = await one(
    "SELECT id, purpose, user_id, email, username, password_hash, expires_at, used_at FROM magic_links WHERE token_hash = $1",
    [hashToken(token)]
  );
  if (!link || link.purpose !== purpose) return { error: "Magic link is invalid or expired." };
  if (link.used_at) return { error: "Magic link was already used." };
  if (link.expires_at <= Date.now()) return { error: "Magic link expired. Request a new link." };
  await run("UPDATE magic_links SET used_at = $1 WHERE id = $2", [Date.now(), link.id]);
  return { link };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
      if (body.length > 16384) {
        req.destroy();
        return reject(new Error("Request is too large."));
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });

    req.on("error", reject);
  });
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, app: "Barta" });
    }

    if (req.method === "GET" && url.pathname === "/api/version") {
      return sendJson(res, 200, { hash: SERVER_RUN_ID, latestVersionCode: LATEST_APP_VERSION_CODE });
    }

    if (req.method === "POST" && url.pathname === "/api/signup") {
      if (rateLimit(req, "signup")) return sendError(res, 429, "Too many attempts. Try again in a minute.");

      const body = await readBody(req);
      if (!requireFields(["email", "username", "password", "passwordConfirm"], body)) return sendError(res, 400, "Fill all fields.");

      const email = normalizeEmail(body.email);
      const username = normalizeUsername(body.username);
      const password = String(body.password);
      const validationError = validateSignup(email, username, password, String(body.passwordConfirm));

      if (validationError) return sendError(res, 400, validationError);
      if (!emailServiceReady()) return sendError(res, 503, "Email service is not configured.");
      if (await findUserByEmail(email)) return sendError(res, 409, "Email already registered.");
      if (await findUserByUsername(username)) return sendError(res, 409, "Username already taken.");

      await createAndSendMagicLink({
        req,
        email,
        username,
        passwordHash: await hashPassword(password),
        purpose: "signup",
        subject: "Barta verification link",
        path: "/api/magic/signup"
      });
      return sendJson(res, 200, { verificationRequired: true });
    }

    if (req.method === "GET" && url.pathname === "/api/magic/signup") {
      const token = url.searchParams.get("token");
      if (!token) return sendError(res, 400, "Magic link is missing.");

      const result = await consumeMagicLink(token, "signup");
      if (result.error) return sendError(res, 400, result.error);

      if (await findUserByEmail(result.link.email)) return sendError(res, 409, "Email already registered.");
      if (await findUserByUsername(result.link.username)) return sendError(res, 409, "Username already taken.");

      const user = {
        id: crypto.randomUUID(),
        username: result.link.username,
        email: result.link.email
      };

      await createUser({ ...user, passwordHash: result.link.password_hash });
      const sessionToken = await createSession(user);
      res.writeHead(302, {
        "Set-Cookie": `${SESSION_COOKIE}=${sessionToken}; ${cookieOptions(req, SESSION_TTL_MS)}`,
        Location: "/?verified=1"
      });
      return res.end();
    }

    if (req.method === "POST" && url.pathname === "/api/verify") {
      if (rateLimit(req, "verify")) return sendError(res, 429, "Too many attempts.");
      const body = await readBody(req);
      if (!requireFields(["email", "code"], body)) return sendError(res, 400, "Fill all fields.");

      const result = await consumeMagicLink(String(body.code).trim(), "signup");
      if (result.error) return sendError(res, 400, result.error);
      if (result.link.email !== normalizeEmail(body.email)) return sendError(res, 400, "Invalid email.");

      if (await findUserByEmail(result.link.email)) return sendError(res, 409, "Email already registered.");
      if (await findUserByUsername(result.link.username)) return sendError(res, 409, "Username already taken.");

      const user = {
        id: crypto.randomUUID(),
        username: result.link.username,
        email: result.link.email
      };

      await createUser({ ...user, passwordHash: result.link.password_hash });
      const sessionToken = await createSession(user);
      return sendJsonWithHeaders(res, 200, { user: safeSelfUser(user) }, { "Set-Cookie": `${SESSION_COOKIE}=${sessionToken}; ${cookieOptions(req, SESSION_TTL_MS)}` });
    }

    if (req.method === "POST" && url.pathname === "/api/verify-email") {
      return sendError(res, 410, "Use the magic link sent to your email.");
    }

    if (req.method === "POST" && (url.pathname === "/api/resend-verification-link" || url.pathname === "/api/resend-verification-otp")) {
      if (rateLimit(req, "resend-verification")) return sendError(res, 429, "Too many attempts. Try again in a minute.");

      const body = await readBody(req);
      if (!requireFields(["email"], body)) return sendError(res, 400, "Enter your email.");

      const email = normalizeEmail(body.email);
      if (await findUserByEmail(email)) return sendError(res, 409, "Email already registered.");
      if (!emailServiceReady()) return sendError(res, 503, "Email service is not configured.");

      const pendingSignup = await one(
        "SELECT username, email, password_hash FROM magic_links WHERE purpose = 'signup' AND email = $1 AND used_at IS NULL AND expires_at > $2 ORDER BY expires_at DESC LIMIT 1",
        [email, Date.now()]
      );
      if (!pendingSignup) return sendError(res, 404, "Pending signup not found. Please sign up again.");

      await createAndSendMagicLink({
        req,
        email,
        username: pendingSignup.username,
        passwordHash: pendingSignup.password_hash,
        purpose: "signup",
        subject: "Barta verification link",
        path: "/api/magic/signup"
      });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      if (rateLimit(req, "login")) return sendError(res, 429, "Too many attempts. Try again in a minute.");

      const body = await readBody(req);
      if (!requireFields(["identifier", "password"], body)) return sendError(res, 400, "Fill all fields.");

      const identifier = String(body.identifier).trim().toLowerCase();
      const user = await findUserByIdentifier(identifier);
      if (!user) return sendError(res, 401, "Invalid login.");
      if (!user.email_verified) return sendError(res, 403, "Account setup incomplete. Please sign up again.");

      if (!await verifyPassword(body.password, user.password_hash)) return sendError(res, 401, "Invalid login.");

      const token = await createSession(user);
      return sendJsonWithHeaders(res, 200, { user: safeSelfUser(user) }, { "Set-Cookie": `${SESSION_COOKIE}=${token}; ${cookieOptions(req, SESSION_TTL_MS)}` });
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      return await clearSession(req, res);
    }

    if (req.method === "POST" && (url.pathname === "/api/forgot-password/send-link" || url.pathname === "/api/forgot-password/send-otp")) {
      if (rateLimit(req, "forgot-password")) return sendError(res, 429, "Too many attempts. Try again in a minute.");

      const body = await readBody(req);
      if (!requireFields(["email"], body)) return sendError(res, 400, "Enter your email.");

      const email = normalizeEmail(body.email);
      const user = await findUserByEmail(email);
      if (!user) return sendError(res, 404, "Account doesn't exist.");
      if (!emailServiceReady()) return sendError(res, 503, "Email service is not configured.");

      await createAndSendMagicLink({
        req,
        userId: user.id,
        email,
        purpose: "password-reset",
        subject: "Barta password reset link",
        path: "/?reset=1"
      });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/forgot-password/reset") {
      if (rateLimit(req, "reset-password")) return sendError(res, 429, "Too many attempts. Try again in a minute.");

      const body = await readBody(req);
      if (!requireFields(["token", "password", "passwordConfirm"], body)) return sendError(res, 400, "Fill all fields.");

      const result = await consumeMagicLink(body.token, "password-reset");
      if (result.error) return sendError(res, 400, result.error);

      const user = await findUserByEmail(result.link.email);
      if (!user) return sendError(res, 404, "Account doesn't exist.");

      const passwordError = validatePassword(String(body.password));
      if (passwordError) return sendError(res, 400, passwordError);
      if (body.password !== body.passwordConfirm) return sendError(res, 400, "Passwords do not match.");

      await updateUserPassword(await hashPassword(body.password), user.id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const user = await getSessionUser(req);
      if (!user) return sendError(res, 401, "Unauthorized.");
      return sendJson(res, 200, { user: safeSelfUser(user) });
    }

    if (req.method === "GET" && url.pathname === "/api/session") {
      const user = await getSessionUser(req);
      if (!user) return sendError(res, 401, "Login expired. Please sign in again.");
      return sendJson(res, 200, { user: safeUser(user) });
    }

    if (req.method === "GET" && url.pathname === "/api/profile") {
      const sessionUser = await getSessionUser(req);
      if (!sessionUser) return sendError(res, 401, "Login expired. Please sign in again.");
      const user = await findUserById(sessionUser.id);
      return sendJson(res, 200, { user: { id: user.id, username: user.username, email: user.email } });
    }

    if (req.method === "POST" && (url.pathname === "/api/profile/email/send-link" || url.pathname === "/api/profile/email/send-otp")) {
      if (rateLimit(req, "profile-email")) return sendError(res, 429, "Too many attempts. Try again in a minute.");

      const sessionUser = await getSessionUser(req);
      if (!sessionUser) return sendError(res, 401, "Login expired. Please sign in again.");

      const body = await readBody(req);
      if (!requireFields(["email"], body)) return sendError(res, 400, "Enter your new email.");

      const email = normalizeEmail(body.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res, 400, "Use a valid email.");
      if (await findUserByEmail(email)) return sendError(res, 409, "Email already registered.");
      if (!emailServiceReady()) return sendError(res, 503, "Email service is not configured.");

      await createAndSendMagicLink({
        req,
        userId: sessionUser.id,
        email,
        purpose: "profile-email",
        subject: "Barta email change link",
        path: "/api/magic/profile-email"
      });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/magic/profile-email") {
      const sessionUser = await getSessionUser(req);
      if (!sessionUser) return sendError(res, 401, "Login expired. Please sign in again.");

      const token = url.searchParams.get("token");
      if (!token) return sendError(res, 400, "Magic link is missing.");

      const result = await consumeMagicLink(token, "profile-email");
      if (result.error) return sendError(res, 400, result.error);
      if (result.link.user_id !== sessionUser.id) return sendError(res, 403, "Magic link does not match this account.");
      if (await findUserByEmail(result.link.email)) return sendError(res, 409, "Email already registered.");

      await updateUserEmail(result.link.email, sessionUser.id);
      res.writeHead(302, { Location: "/?profile=email-updated" });
      return res.end();
    }

    if (req.method === "POST" && url.pathname === "/api/profile/email/verify") {
      const sessionUser = await getSessionUser(req);
      if (!sessionUser) return sendError(res, 401, "Login expired. Please sign in again.");

      const body = await readBody(req);
      if (!requireFields(["email", "code"], body)) return sendError(res, 400, "Fill all fields.");

      const email = normalizeEmail(body.email);
      return sendError(res, 410, "Use the magic link sent to your new email.");
    }

    if (req.method === "POST" && (url.pathname === "/api/profile/password/send-link" || url.pathname === "/api/profile/password/send-otp")) {
      if (rateLimit(req, "profile-password")) return sendError(res, 429, "Too many attempts. Try again in a minute.");

      const sessionUser = await getSessionUser(req);
      if (!sessionUser) return sendError(res, 401, "Login expired. Please sign in again.");
      const user = await findUserById(sessionUser.id);
      if (!emailServiceReady()) return sendError(res, 503, "Email service is not configured.");

      await createAndSendMagicLink({
        req,
        userId: user.id,
        email: user.email,
        purpose: "password-reset",
        subject: "Barta password change link",
        path: "/?reset=1"
      });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/profile/password") {
      return sendError(res, 410, "Use the password reset magic link sent to your email.");
    }

    if (req.method === "POST" && url.pathname === "/api/friends/request") {
      const user = await getSessionUser(req);
      if (!user) return sendError(res, 401, "Unauthorized");
      const body = await readBody(req);
      const toUserId = body.to_user_id;
      if (!toUserId || toUserId === user.id) return sendError(res, 400, "Invalid user");
      const targetUser = await findUserById(toUserId);
      if (!targetUser) return sendError(res, 404, "User not found");

      const existing = await one("SELECT * FROM friends WHERE (user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)", [user.id, targetUser.id]);
      if (existing) return sendError(res, 400, "Request already exists or you are already friends.");

      await run("INSERT INTO friends (user_id_1, user_id_2, status, created_at) VALUES ($1, $2, 'pending', $3)", [user.id, targetUser.id, Date.now()]);
      return sendJson(res, 200, { ok: true, message: "Friend request sent." });
    }

    if (req.method === "POST" && url.pathname === "/api/friends/accept") {
      const user = await getSessionUser(req);
      if (!user) return sendError(res, 401, "Unauthorized");
      const body = await readBody(req);
      const fromUserId = body.from_user_id;
      
      const reqRow = await one("SELECT * FROM friends WHERE user_id_1 = $1 AND user_id_2 = $2 AND status = 'pending'", [fromUserId, user.id]);
      if (!reqRow) return sendError(res, 404, "Friend request not found.");

      await run("UPDATE friends SET status = 'accepted' WHERE user_id_1 = $1 AND user_id_2 = $2", [fromUserId, user.id]);
      return sendJson(res, 200, { ok: true, message: "Friend request accepted." });
    }

    if (req.method === "POST" && url.pathname === "/api/friends/remove") {
      const user = await getSessionUser(req);
      if (!user) return sendError(res, 401, "Unauthorized");
      const body = await readBody(req);
      const peerId = body.peer_id;
      
      await run("DELETE FROM friends WHERE (user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)", [user.id, peerId]);
      return sendJson(res, 200, { ok: true, message: "Removed." });
    }

    if (req.method === "GET" && url.pathname === "/api/friends") {
      const user = await getSessionUser(req);
      if (!user) return sendError(res, 401, "Unauthorized");

      const friendsRes = await pool.query(`
        SELECT u.id, u.username, f.status, f.user_id_1, f.user_id_2
        FROM friends f
        JOIN users u ON (u.id = f.user_id_1 OR u.id = f.user_id_2)
        WHERE (f.user_id_1 = $1 OR f.user_id_2 = $1) AND u.id != $1
      `, [user.id]);
      
      const friends = friendsRes.rows.map(r => {
        const live = online.get(r.id);
        return {
          id: r.id,
          username: r.username,
          status: live ? live.status : "offline",
          friendship_status: r.status,
          is_incoming: r.user_id_1 !== user.id
        };
      });

      return sendJson(res, 200, { friends });
    }

    if (req.method === "GET" && url.pathname === "/api/search") {
      if (rateLimit(req, "search")) return sendError(res, 429, "Too many searches. Try again in a minute.");

      const sessionUser = await getSessionUser(req);
      if (!sessionUser) return sendError(res, 401, "Login expired. Please sign in again.");

      const q = url.searchParams.get("q");
      if (q) {
        const users = await pool.query("SELECT id, username FROM users WHERE username ILIKE $1 OR email ILIKE $1 LIMIT 20", [`%${q}%`]);
        const friendsRes = await pool.query(`SELECT user_id_1, user_id_2, status FROM friends WHERE user_id_1 = $1 OR user_id_2 = $1`, [sessionUser.id]);
        
        const mappedUsers = users.rows.map(u => {
          const live = online.get(u.id);
          let fStatus = "none";
          let isIncoming = false;
          const fRow = friendsRes.rows.find(r => r.user_id_1 === u.id || r.user_id_2 === u.id);
          if (fRow) {
            fStatus = fRow.status;
            isIncoming = fRow.user_id_1 === u.id;
          }
          return {
            id: u.id,
            username: u.username,
            status: live ? live.status : "offline",
            friendship_status: fStatus,
            is_incoming: isIncoming
          };
        });
        return sendJson(res, 200, { users: mappedUsers });
      }

      const username = normalizeUsername(url.searchParams.get("username"));
      if (!username) return sendError(res, 400, "Enter a username or q parameter.");

      const user = await findUserByUsername(username);
      if (!user) return sendError(res, 404, "User not found.");

      const live = online.get(user.id);
      return sendJson(res, 200, {
        user: {
          id: user.id,
          username: user.username,
          status: live ? live.status : "offline"
        }
      });
    }

    // ── FCM token registration ────────────────────────────────────────────────
    if (req.method === "POST" && url.pathname === "/api/fcm-token") {
      const sessionUser = await getSessionUser(req);
      if (!sessionUser) return sendError(res, 401, "Login expired.");
      const body = await readBody(req);
      const token = String(body.token || "").trim();
      if (!token) return sendError(res, 400, "Token required.");
      await run("UPDATE users SET fcm_token = $1 WHERE id = $2", [token, sessionUser.id]);
      return sendJson(res, 200, { ok: true });
    }

    // ── Admin API ────────────────────────────────────────────
    if (url.pathname.startsWith("/api/admin/")) {

      const secret = req.headers["x-admin-secret"] || "";
      if (!ADMIN_SECRET || secret !== ADMIN_SECRET) return sendError(res, 401, "Unauthorized.");

      if (req.method === "GET" && url.pathname === "/api/admin/users") {
        const users = await pool.query("SELECT id, username, email, email_verified, created_at FROM users ORDER BY created_at DESC");
        return sendJson(res, 200, { users: users.rows });
      }

      if (req.method === "POST" && url.pathname === "/api/admin/users") {
        const body = await readBody(req);
        if (!requireFields(["email", "username"], body)) return sendError(res, 400, "Email and username are required.");
        const email = normalizeEmail(body.email);
        const username = normalizeUsername(body.username);
        const password = String(body.password || "0000000000");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res, 400, "Invalid email.");
        if (!/^[a-z0-9_]{3,24}$/.test(username)) return sendError(res, 400, "Username must be 3-24 letters, numbers, or underscores.");
        if (password.length < 10) return sendError(res, 400, "Password must be at least 10 characters.");
        if (await findUserByEmail(email)) return sendError(res, 409, "Email already registered.");
        if (await findUserByUsername(username)) return sendError(res, 409, "Username already taken.");
        await run(
          "INSERT INTO users (id, email, username, password_hash, email_verified, created_at) VALUES ($1, $2, $3, $4, 1, $5)",
          [crypto.randomUUID(), email, username, await hashPassword(password), new Date().toISOString()]
        );
        return sendJson(res, 200, { ok: true, message: `User @${username} created with password: ${password}` });
      }

      if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/users/")) {
        const identifier = decodeURIComponent(url.pathname.replace("/api/admin/users/", ""));
        const user = await one("SELECT id, username FROM users WHERE email = $1 OR username = $1", [identifier.toLowerCase()]);
        if (!user) return sendError(res, 404, "User not found.");
        // Clear sessions from database
        await run("DELETE FROM sessions WHERE user_id = $1", [user.id]);
        await run("DELETE FROM users WHERE id = $1", [user.id]);
        // kick them offline if connected
        const entry = online.get(user.id);
        if (entry) { endPair(user.id); entry.ws.end(); online.delete(user.id); notifyPresenceChange(user.id, "offline"); }
        return sendJson(res, 200, { ok: true, message: `User @${user.username} deleted.` });
      }

      return sendError(res, 404, "Admin route not found.");
    }

    sendError(res, 404, "Not found.");
  } catch (error) {
    if (error.message === "Invalid JSON.") return sendError(res, 400, "Invalid request.");
    if (error.message === "Request is too large.") return sendError(res, 413, "Request is too large.");
    if (error.message.startsWith("Email service") || error.message.startsWith("Email API")) return sendError(res, 503, error.message);
    console.error(error);
    sendError(res, 500, "Something went wrong. Please try again.");
  }
}

async function serveStatic(req, res, url) {
  let requested = decodeURIComponent(url.pathname);
  if (requested === "/" || requested === "/home" || requested === "/check-in") {
    requested = "/index.html";
  }
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url);
    return;
  }
  serveStatic(req, res, url);
});

function send(ws, type, payload = {}) {
  wsSend(ws, JSON.stringify({ type, ...payload }));
}

function notifyPresenceChange(changedUserId, status) {
  for (const entry of online.values()) {
    if (entry.ws.subscriptions && entry.ws.subscriptions.has(changedUserId)) {
      send(entry.ws, "presence-update", { user: { id: changedUserId, status } });
    }
  }
}

function endPair(userId, notifyPeer = true) {
  const entry = online.get(userId);
  if (!entry || !entry.peerId) return;

  const peerId = entry.peerId;
  entry.peerId = null;
  entry.status = "online";
  notifyPresenceChange(userId, "online");

  const peer = online.get(peerId);
  if (peer && peer.peerId === userId) {
    peer.peerId = null;
    peer.status = "online";
    notifyPresenceChange(peerId, "online");
    if (notifyPeer) send(peer.ws, "peer-disconnected");
  }
}

function clearRequestsFor(userId) {
  pendingRequests.delete(userId);
  for (const [toId, fromId] of pendingRequests.entries()) {
    if (fromId === userId || toId === userId) pendingRequests.delete(toId);
  }
}

function handleSocketMessage(ws, user, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return send(ws, "error-message", { error: "Invalid message." });
  }

  const me = online.get(user.id);
  if (!me) return;

  if (message.type === "request") {
    const target = online.get(message.to);
    if (!target || target.status !== "online" || target.user.id === user.id || me.status !== "online") {
      // Target not online — try FCM push if they have a token
      if (!target && message.to) {
        one("SELECT fcm_token FROM users WHERE id = $1", [message.to]).then((row) => {
          if (row && row.fcm_token) sendFcmPush(row.fcm_token, user);
        }).catch(() => {});
      }
      return send(ws, "error-message", { error: "User is not available." });
    }
    pendingRequests.set(target.user.id, user.id);
    send(target.ws, "incoming-request", { from: safeUser(user) });
    send(ws, "request-sent", { to: safeUser(target.user) });
  }


  if (message.type === "respond-request") {
    const fromId = pendingRequests.get(user.id);
    const requester = fromId && online.get(fromId);
    pendingRequests.delete(user.id);

    if (!requester || requester.status !== "online" || me.status !== "online") {
      return send(ws, "error-message", { error: "Request is no longer available." });
    }

    if (!message.accept) {
      send(requester.ws, "request-rejected", { by: safeUser(user) });
      return;
    }

    me.status = "connected";
    me.peerId = requester.user.id;
    requester.status = "connected";
    requester.peerId = user.id;

    send(requester.ws, "request-accepted", { peer: safeUser(user), initiator: true });
    send(ws, "connected", { peer: safeUser(requester.user), initiator: false });
    notifyPresenceChange(user.id, "connected");
    notifyPresenceChange(requester.user.id, "connected");
  }

  if (message.type === "signal") {
    const peer = me.peerId && online.get(me.peerId);
    if (peer) send(peer.ws, "signal", { from: user.id, signal: message.signal });
  }

  if (message.type === "disconnect-peer") {
    endPair(user.id);
    send(ws, "peer-disconnected");
  }

  if (message.type === "refresh-presence") {
    const users = [];
    if (ws.subscriptions) {
      for (const subId of ws.subscriptions) {
        const entry = online.get(subId);
        users.push({ id: subId, status: entry ? entry.status : "offline" });
      }
    }
    send(ws, "presence", { users });
  }

  if (message.type === "subscribe") {
    ws.subscriptions = new Set(message.ids || []);
    const users = [];
    for (const subId of ws.subscriptions) {
      const entry = online.get(subId);
      users.push({ id: subId, status: entry ? entry.status : "offline" });
    }
    send(ws, "presence", { users });
  }
}

function wsSend(ws, text) {
  if (ws.destroyed) return;
  const payload = Buffer.from(text);
  let header;

  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }

  ws.write(Buffer.concat([header, payload]));
}

function readFrame(buffer) {
  if (buffer.length < 2) return null;

  const fin = (buffer[0] & 0x80) === 0x80;
  const opcode = buffer[0] & 0x0f;
  const masked = Boolean(buffer[1] & 0x80);
  let length = buffer[1] & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    length = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  if (!masked || buffer.length < offset + 4 + length) return null;

  const mask = buffer.subarray(offset, offset + 4);
  offset += 4;
  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];

  return { fin, opcode, payload, bytes: offset + length };
}

async function acceptWebSocket(req, socket) {
  if (rateLimit(req, "websocket")) {
    socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
    socket.destroy();
    return;
  }

  const user = await getSessionUser(req);

  if (!user) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  if (!online.has(user.id) && online.size >= MAX_ONLINE_USERS) {
    socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );

  const existing = online.get(user.id);
  if (existing) existing.ws.end();

  socket.subscriptions = new Set();
  online.set(user.id, { ws: socket, user, status: "online", peerId: null });
  send(socket, "ready", { user });
  notifyPresenceChange(user.id, "online");

  let buffer = Buffer.alloc(0);
  let messageFragments = [];

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    let frame = readFrame(buffer);
    while (frame) {
      buffer = buffer.subarray(frame.bytes);
      
      if (frame.opcode === 0x8) {
        socket.end();
        return;
      }

      if (frame.opcode === 0x1 || frame.opcode === 0x0) {
        messageFragments.push(frame.payload);
        const totalFragmentSize = messageFragments.reduce((sum, b) => sum + b.length, 0);
        if (totalFragmentSize > 65536) { // 64 KB max per WebSocket message
          socket.end();
          return;
        }
        if (frame.fin) {
          const fullMessage = Buffer.concat(messageFragments).toString("utf8");
          messageFragments = [];
          handleSocketMessage(socket, user, fullMessage);
        }
      }
      
      frame = readFrame(buffer);
    }
  });

  socket.on("close", () => {
    const current = online.get(user.id);
    if (current && current.ws === socket) {
      endPair(user.id);
      online.delete(user.id);
      clearRequestsFor(user.id);
      notifyPresenceChange(user.id, "offline");
    }
  });
}

server.on("upgrade", (req, socket) => {
  if ((req.headers.upgrade || "").toLowerCase() !== "websocket") {
    socket.destroy();
    return;
  }
  acceptWebSocket(req, socket).catch((error) => {
    console.error(error);
    socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
    socket.destroy();
  });
});

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
  throw new Error("DATABASE_URL is missing or empty");
}


async function startApplication() {
  try {
    console.log("🚀 Booting app...");

    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is missing in environment variables");
    }

    await initDatabase();
    console.log("✅ Database connected successfully");

    const port = process.env.PORT || 3000;

    server.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server running at http://0.0.0.0:${port}`);
    });

  } catch (err) {
    console.error("❌ Startup failed:", err);
    process.exit(1);
  }
}

startApplication();