import { NextResponse } from "next/server";
import { getInstallProgress } from "@/lib/tool-installer";

// GET /api/install-debug — return install logs from getInstallProgress()
export async function GET() {
  try {
    const progress = await getInstallProgress();
    return NextResponse.json(progress);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
