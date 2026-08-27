import { NextResponse } from "next/server";
import { runBenchmarkSuite } from "@/lib/benchmark";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const results = runBenchmarkSuite();
    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Failed to run benchmark suite." },
      { status: 500 },
    );
  }
}
