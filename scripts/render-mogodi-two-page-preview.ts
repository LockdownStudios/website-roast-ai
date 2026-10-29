import { readFile, writeFile } from "node:fs/promises";
import { renderRoastReportPdf } from "../lib/reportPdf";
import type { StoredRoastReport } from "../lib/types";

async function main() {
  const saved = JSON.parse(await readFile("tmp/roast-batch/mogodi-v32.json", "utf8")) as StoredRoastReport;
  // Editorial demonstration of the saved findings, not a new scan or model generation.
  const roast = {
    ...saved.roast,
    first_impression: '"PRODUCT ELEMENT" is not lodge romance; it is a theme demo wandering around in a bathrobe. The real homepage has a better story: Graskop Gorge Falls, a strong location hook and a visible "Make a Booking" button. The destination has appeal. The website just needs to stop leaving its maintenance cupboard open.',
    single_biggest_leak: "The booking path exists. The bigger concern is uneven polish around it: public demo/shop leftovers and too little accommodation context near the first booking action. The reviewed evidence does not show ordinary visitors being routed through those demo pages, so this is a housekeeping risk - not proof of a broken booking funnel.",
    high_impact: "Keep the location punch. Clean up the public leftovers, explain the room options earlier and sharpen the existing booking path. This looks like a focused refresh, not a reason to send in a demolition crew.",
    mistakes: [
      'The view is outselling the room choices. The homepage has a clear booking button, but the accommodation options - self-catering chalets and B&B hotel rooms - need clearer context near that decision.',
      'The booking form is sharing a filing cabinet. The reviewed contact page places it alongside contact, directions and policy information. Give the booking task a clearer introduction without claiming the form is broken.',
      'The theme demo has checked itself in. Public demo-style content and shop/account language were found. That does not establish that guests normally encounter them, but it is worth checking which pages should remain public.',
      'The proof is not pulling its weight. Guest reviews, ratings or testimonials were not observed in the supplied sample. That is a visibility limitation, not proof the lodge has none.',
      'The typos are checking in before the guests. The reviewed material includes "Accomodation" and "Tell:(013) 767 1110". Fix visible mistakes before visitors have to trust the site with dates and money.',
    ],
    quick_fixes: [
      'Keep the existing location hook. Add a concise line naming self-catering chalets and B&B hotel rooms beside the booking action, using confirmed current offerings.',
      'Above the contact-page form, explain what to provide: preferred dates, accommodation type and contact details. Do not invent response times or a confirmed booking process.',
      'Review public demo/shop pages and navigation. Remove, redirect or noindex irrelevant material where appropriate; retain genuine booking content and clarify enquiry versus purchase language.',
      'Bring verified guest proof into the accommodation/booking journey: current review snippets with a source, recent room photographs or confirmed policy details.',
      'Proofread accommodation labels, contact details and public page copy. Correct the observed errors and check that the remaining details are current.',
    ],
  };
  const pdf = await renderRoastReportPdf({ ...saved, roast, id: "mogodi-editorial-preview", createdAt: "2026-10-28T10:00:00Z", scrapeHash: "editorial-preview" }, { access: { tier: "full_unlocked", priceZar: 49, unlockSource: "office" }, isUnlocked: true, internalDraftPreview: true });
  await writeFile("../output/pdf/mogodi-two-page-roast-draft.pdf", pdf);
  console.log("Two-page Mogodi editorial preview generated from saved findings. No scan or paid AI call.");
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
