import { NextRequest, NextResponse } from "next/server";
import { runLiveCalibration } from "@/lib/liveCalibration";
import { defaultCalibrationSites } from "@/lib/liveCalibrationPreset";
import type { LiveCalibrationSiteInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = (rawBody ? JSON.parse(rawBody) : {}) as {
      sites?: LiveCalibrationSiteInput[];
      usePreset?: boolean;
    };

    const incomingSites = Array.isArray(body.sites) ? body.sites : [];
    const usePreset =
      incomingSites.length === 0 ? body.usePreset !== false : false;
    const sites = incomingSites.length > 0 ? incomingSites : defaultCalibrationSites;

    if (sites.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one site in `sites`." },
        { status: 400 },
      );
    }

    if (sites.length > 30) {
      return NextResponse.json(
        { error: "For now, max 30 sites per run." },
        { status: 400 },
      );
    }

    const result = await runLiveCalibration(sites, { presetUsed: usePreset });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to run live calibration." },
      { status: 500 },
    );
  }
}
