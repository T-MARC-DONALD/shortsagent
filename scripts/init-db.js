/* eslint-disable @typescript-eslint/no-require-imports */
// scripts/init-db.js
// Runs before the Next.js server starts in production.
// Ensures the SQLite database file exists and the schema is pushed.

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("[init-db] Starting database initialization...");

// 1. Ensure the db directory exists
const dbDir = path.join(process.cwd(), "db");
if (!fs.existsSync(dbDir)) {
  console.log("[init-db] Creating db directory:", dbDir);
  fs.mkdirSync(dbDir, { recursive: true });
}

// 2. Set DATABASE_URL if not already set (relative path)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./db/custom.db";
  console.log("[init-db] Set DATABASE_URL to:", process.env.DATABASE_URL);
}

// 3. Check if prisma schema exists
const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
if (!fs.existsSync(schemaPath)) {
  console.error("[init-db] FATAL: Prisma schema not found at:", schemaPath);
  console.error("[init-db] CWD:", process.cwd());
  try {
    console.error("[init-db] Contents:", fs.readdirSync(process.cwd()));
  } catch (e) {
    console.error("[init-db] Could not list CWD:", e.message);
  }
  process.exit(1);
}

// 4. Run prisma db push to create/migrate the database
try {
  console.log("[init-db] Running prisma db push...");
  execSync("npx prisma db push --skip-generate", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
    timeout: 60000,
  });
  console.log("[init-db] Database schema pushed successfully");
} catch (e) {
  console.error("[init-db] prisma db push failed:", e.message);
  // Try with bunx as fallback
  try {
    console.log("[init-db] Retrying with bunx prisma db push...");
    execSync("bunx prisma db push --skip-generate", {
      stdio: "inherit",
      cwd: process.cwd(),
      env: process.env,
      timeout: 60000,
    });
    console.log("[init-db] Database schema pushed successfully (via bunx)");
  } catch (e2) {
    console.error("[init-db] bunx prisma db push also failed:", e2.message);
    // Don't exit — the server might still work if the db already exists
  }
}

// 5. Verify the database file was created
const dbPath = path.join(process.cwd(), "db", "custom.db");
if (fs.existsSync(dbPath)) {
  const stat = fs.statSync(dbPath);
  console.log(`[init-db] Database file exists: ${dbPath} (${stat.size} bytes)`);
} else {
  console.warn("[init-db] WARNING: Database file not found at:", dbPath);
  // The PrismaClient will create it on first query, but let's try to create it manually
  try {
    fs.writeFileSync(dbPath, "");
    console.log("[init-db] Created empty db file — Prisma will initialize it on first query");
  } catch (e) {
    console.error("[init-db] Failed to create db file:", e.message);
  }
}

console.log("[init-db] Done");
