import assert from "node:assert/strict";
import { inferJourneyIntent } from "../lib/businessProfile";

assert.equal(inferJourneyIntent({ label: "Contact", destination: "/contact" }, "Book your stay Reserve a Table"), "contact");
assert.equal(inferJourneyIntent({ label: "Explore tiles", destination: "/tiles" }, "Hospitality projects Check Availability"), "learn");
assert.equal(inferJourneyIntent({ label: "Book Now", destination: "/booking" }, "Salon beauty treatments"), "book_appointment");
assert.equal(inferJourneyIntent({ label: "Book Now", destination: "https://book.nightsbridge.com/123" }, "Panorama Chalets Camping"), "book_stay");
assert.equal(inferJourneyIntent({ label: "Send message", destination: "/contact" }, "Coffee menu"), "contact");
console.log("CTA isolation regressions passed.");
