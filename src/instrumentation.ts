// instrumentation.ts — runs once when the Next.js server starts.
// This file must be Edge-compatible (no top-level Node.js imports).
// The actual Node.js work is done in a dynamically imported module.

export async function register() {
  // Only run in Node.js runtime, not Edge
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Dynamically import the Node.js-only module
  // This prevents Edge Runtime from parsing the Node.js imports
  const { initServer } = await import("./instrumentation-node");
  await initServer();
}
