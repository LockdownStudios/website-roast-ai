import { getLocalReview } from "@/lib/localReview";
import { isClientReadyReport } from "@/lib/reportQuality";
import { renderRoastReportPdf } from "@/lib/reportPdf";

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const site = new URL(request.url).searchParams.get("site") || undefined;
  const internalDraftPreview = new URL(request.url).searchParams.get("draft") === "1";
  const result = await getLocalReview(site);
  if (!result) return new Response("Not found", { status: 404 });
  if (!isClientReadyReport(result.roast) && !internalDraftPreview) return new Response("Report has not passed evidence review", { status: 409 });
  const access = { tier: "full_unlocked" as const, priceZar: 49, unlockSource: "office" as const };
  const pdf = await renderRoastReportPdf({ ...result, id: "local-review", roast: { ...result.roast, access },
    createdAt: new Date().toISOString(), scrapeHash: "local-review" }, { access, isUnlocked: true, internalDraftPreview });
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${internalDraftPreview ? "INTERNAL-DRAFT-" : ""}${site || "local-reviewed"}-roast.pdf"`, "Cache-Control": "no-store" } });
}
