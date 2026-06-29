// db-helpers.ts — utilities for safe database access.
// Returns empty/default results instead of 500 when the database isn't ready.

import { db } from "@/lib/db";

let dbAvailable: boolean | null = null;

/**
 * Check if the database is accessible.
 * Caches the result so we don't keep retrying on every request.
 */
export async function isDbAvailable(): Promise<boolean> {
  if (dbAvailable !== null) return dbAvailable;
  try {
    await db.agentSettings.count({ where: { id: "global" } });
    dbAvailable = true;
    return true;
  } catch (e) {
    console.error("[db-helpers] Database not available:", e instanceof Error ? e.message : e);
    dbAvailable = false;
    return false;
  }
}

/**
 * Reset the cached DB availability (e.g., after running init-db).
 */
export function resetDbAvailability() {
  dbAvailable = null;
}

/**
 * Ensure the AgentSettings singleton exists.
 */
export async function ensureSettings() {
  try {
    return await db.agentSettings.upsert({
      where: { id: "global" },
      create: { id: "global" },
      update: {},
    });
  } catch (e) {
    console.error("[db-helpers] Failed to ensure settings:", e);
    throw e;
  }
}
