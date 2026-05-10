const crypto = require("crypto");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined
});

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function usage() {
  console.log(`
Usage:
  node admin-users.js list
  node admin-users.js add <email> <username> [password]
  node admin-users.js get <email-or-username>
  node admin-users.js set-email <email-or-username> <new-email>
  node admin-users.js set-username <email-or-username> <new-username>
  node admin-users.js set-password <email-or-username> <new-password>
  node admin-users.js delete <email-or-username>
`);
}

async function one(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

async function findUser(identifier) {
  return one("SELECT id, username, email, email_verified, created_at FROM users WHERE email = $1 OR username = $1", [
    String(identifier).trim().toLowerCase()
  ]);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

  const [command, identifier, value] = process.argv.slice(2);

  if (command === "list") {
    const users = await pool.query("SELECT id, username, email, email_verified, created_at FROM users ORDER BY created_at DESC");
    console.table(users.rows);
  } else if (command === "get" && identifier) {
    const user = await findUser(identifier);
    if (!user) throw new Error("User not found.");
    console.table([user]);
  } else if (command === "set-email" && identifier && value) {
    const user = await findUser(identifier);
    if (!user) throw new Error("User not found.");
    await pool.query("UPDATE users SET email = $1, email_verified = 1 WHERE id = $2", [value.trim().toLowerCase(), user.id]);
    console.log("Email updated.");
  } else if (command === "set-username" && identifier && value) {
    const user = await findUser(identifier);
    if (!user) throw new Error("User not found.");
    const username = value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new Error("Username must be 3-24 letters, numbers, or underscores.");
    await pool.query("UPDATE users SET username = $1 WHERE id = $2", [username, user.id]);
    console.log("Username updated.");
  } else if (command === "set-password" && identifier && value) {
    const user = await findUser(identifier);
    if (!user) throw new Error("User not found.");
    if (value.length < 10) throw new Error("Password must be at least 10 characters.");
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hashPassword(value), user.id]);
    console.log("Password updated.");
  } else if (command === "delete" && identifier) {
    const user = await findUser(identifier);
    if (!user) throw new Error("User not found.");
    await pool.query("DELETE FROM sessions WHERE user_id = $1", [user.id]);
    await pool.query("DELETE FROM users WHERE id = $1", [user.id]);
    console.log("User deleted.");
  } else if (command === "add" && identifier && value) {
    const email = identifier.trim().toLowerCase();
    const username = value.trim().toLowerCase();
    const password = process.argv[5] || "0000000000";
    if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new Error("Username must be 3-24 letters, numbers, or underscores.");
    if (password.length < 10) throw new Error("Password must be at least 10 characters (default is 0000000000).");
    const existingEmail = await findUser(email);
    if (existingEmail) throw new Error("User with that email already exists.");
    const existingUsername = await findUser(username);
    if (existingUsername) throw new Error("User with that username already exists.");
    await pool.query(
      "INSERT INTO users (id, email, username, password_hash, email_verified, created_at) VALUES ($1, $2, $3, $4, 0, $5)",
      [crypto.randomUUID(), email, username, hashPassword(password), Date.now()]
    );
    console.log(`User created! Email: ${email}, Username: ${username}, Password: ${password}`);
  } else {
    usage();
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
