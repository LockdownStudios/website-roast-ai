from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


@dataclass(frozen=True)
class ScenarioResult:
    name: str
    gross_revenue: float
    paystack_fee: float
    payfast_fee: float
    payfast_payout_fees: float = 0.0

    @property
    def payfast_total(self) -> float:
        return self.payfast_fee + self.payfast_payout_fees

    @property
    def paystack_advantage(self) -> float:
        return self.payfast_total - self.paystack_fee


def zar(value: float) -> str:
    return f"R{value:,.2f}"


REPORT_DATE = "09-04-2026"
SOURCES_ACCESSED_DATE = "09-04-2026"


def build_cost_scenarios() -> list[ScenarioResult]:
    # Scenario 1: SaaS recurring plan, card-heavy.
    s1_tx = 500
    s1_amount = 299.0
    s1_gross = s1_tx * s1_amount
    s1_paystack = s1_gross * 0.029 + s1_tx * 1.0
    s1_payfast = s1_gross * 0.032 + s1_tx * 2.0
    s1_payout = 4 * 8.70  # Weekly scheduled payouts

    # Scenario 2: Mixed checkout (70% card, 30% EFT), mid ticket.
    s2_tx = 1200
    s2_amount = 450.0
    s2_gross = s2_tx * s2_amount
    s2_card_tx = int(s2_tx * 0.7)
    s2_eft_tx = s2_tx - s2_card_tx
    s2_card_gross = s2_card_tx * s2_amount
    s2_eft_gross = s2_eft_tx * s2_amount
    s2_paystack = (s2_card_gross * 0.029 + s2_card_tx * 1.0) + (s2_eft_gross * 0.02)
    s2_payfast = (s2_card_gross * 0.032 + s2_card_tx * 2.0) + (
        s2_eft_gross * 0.02
    )  # min R2 not binding here
    s2_payout = 4 * 8.70

    # Scenario 3: Low-ticket growth funnel (50% card, 50% EFT), where min EFT fee matters.
    s3_tx = 3000
    s3_amount = 49.0
    s3_gross = s3_tx * s3_amount
    s3_card_tx = int(s3_tx * 0.5)
    s3_eft_tx = s3_tx - s3_card_tx
    s3_card_gross = s3_card_tx * s3_amount
    s3_eft_gross = s3_eft_tx * s3_amount
    s3_paystack = (s3_card_gross * 0.029 + s3_card_tx * 1.0) + (s3_eft_gross * 0.02)
    s3_payfast = (s3_card_gross * 0.032 + s3_card_tx * 2.0) + (
        s3_eft_tx * max(s3_amount * 0.02, 2.0)
    )
    s3_payout = 4 * 8.70

    return [
        ScenarioResult(
            name="SaaS recurring (500 x R299, card-heavy)",
            gross_revenue=s1_gross,
            paystack_fee=s1_paystack,
            payfast_fee=s1_payfast,
            payfast_payout_fees=s1_payout,
        ),
        ScenarioResult(
            name="Mixed checkout (1,200 x R450, 70% card / 30% EFT)",
            gross_revenue=s2_gross,
            paystack_fee=s2_paystack,
            payfast_fee=s2_payfast,
            payfast_payout_fees=s2_payout,
        ),
        ScenarioResult(
            name="Low-ticket funnel (3,000 x R49, 50% card / 50% EFT)",
            gross_revenue=s3_gross,
            paystack_fee=s3_paystack,
            payfast_fee=s3_payfast,
            payfast_payout_fees=s3_payout,
        ),
    ]


def paragraph_cell(value: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(value, style)


def build_wrapped_table_rows(
    rows: list[list[str]],
    header_style: ParagraphStyle,
    cell_style: ParagraphStyle,
) -> list[list[Paragraph]]:
    wrapped: list[list[Paragraph]] = []
    for row_index, row in enumerate(rows):
        style = header_style if row_index == 0 else cell_style
        wrapped.append([paragraph_cell(str(cell), style) for cell in row])
    return wrapped


def build_pdf(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title="Paystack vs Payfast - Usage Cases and Recommendation",
        author="Website Roast AI",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=21,
        leading=25,
        textColor=colors.HexColor("#111827"),
        spaceAfter=8,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor("#374151"),
        spaceAfter=10,
    )
    h2_style = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#111827"),
        spaceBefore=8,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#1f2937"),
    )
    note_style = ParagraphStyle(
        "Note",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#4b5563"),
    )
    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.9,
        leading=11,
        textColor=colors.white,
        wordWrap="CJK",
    )
    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=10.5,
        textColor=colors.HexColor("#1f2937"),
        wordWrap="CJK",
    )
    table_cell_style_dark_header = ParagraphStyle(
        "TableCellDarkHeader",
        parent=table_header_style,
        textColor=colors.white,
    )
    table_cell_style_teal_header = ParagraphStyle(
        "TableCellTealHeader",
        parent=table_header_style,
        textColor=colors.white,
    )

    story: list = []

    story.append(Paragraph("Paystack vs Payfast: Usage Cases and Recommendation", title_style))
    story.append(
        Paragraph(
            f"Date: {REPORT_DATE} | Region focus: South Africa",
            subtitle_style,
        )
    )
    story.append(
        Paragraph(
            "Executive summary: For your current SaaS direction (API-first, recurring billing, conversion product), "
            "<b>Paystack is the better default</b>. Payfast is strongest when you need broad South African payment-method "
            "coverage and plugin-heavy ecommerce rollouts.",
            body_style,
        )
    )
    story.append(Spacer(1, 8))

    story.append(Paragraph("1) Snapshot Comparison", h2_style))
    snapshot_data = [
        ["Category", "Paystack", "Payfast", "Why it matters for us"],
        [
            "Core SA card pricing",
            "2.9% + R1 (local cards)",
            "3.2% + R2 (cards)",
            "Lower variable and fixed fees improve unit economics on SaaS plans.",
        ],
        [
            "SA EFT pricing",
            "Capitec Pay / Ozow EFT: 2% (no flat fee)",
            "Instant EFT: 2% (minimum R2)",
            "Low-ticket checkouts are penalized by minimum EFT fee.",
        ],
        [
            "Payout charges",
            "All payouts are free",
            "R8.70 per payout; immediate payout 0.8% (min R14)",
            "Cash-out friction matters for frequent settlement.",
        ],
        [
            "Recurring billing controls",
            "Subscriptions API + recurring charges from saved authorization",
            "Subscriptions + tokenization + dashboard/API controls",
            "Both can do recurring; implementation style and economics differ.",
        ],
        [
            "Local method breadth",
            "Solid SA rails (cards, Capitec Pay, QR/Scan-to-Pay paths, Ozow provider)",
            "Broader method mix (18+ methods claimed on site)",
            "Payfast wins when method coverage breadth is the top priority.",
        ],
        [
            "Integration approach",
            "Strong API-first docs and flows",
            "Strong plugin + gateway ecosystem",
            "For Next.js custom product flows, API-first usually ships faster.",
        ],
    ]
    snapshot_table = Table(
        build_wrapped_table_rows(snapshot_data, table_cell_style_dark_header, table_cell_style),
        colWidths=[31 * mm, 43 * mm, 43 * mm, 56 * mm],
        repeatRows=1,
    )
    snapshot_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(snapshot_table)
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            "Inference note: The final column includes applied interpretation for Website Roast AI (SaaS product context), "
            "not direct vendor claims.",
            note_style,
        )
    )

    story.append(Paragraph("2) Usage-Case Decision Matrix", h2_style))
    use_case_data = [
        ["Usage case", "Better fit", "Reason"],
        [
            "API-first SaaS app (custom checkout, own backend)",
            "Paystack",
            "Lower base card cost and strong recurring authorization patterns for product-led flows.",
        ],
        [
            "SaaS subscriptions + low-ticket add-ons",
            "Paystack",
            "No flat EFT fee for Capitec/Ozow and lower card fixed fee improve margin at smaller order sizes.",
        ],
        [
            "Ecommerce with max local method variety",
            "Payfast",
            "Explicitly markets 18+ payment methods and deep plugin ecosystem.",
        ],
        [
            "Merchant asks for fastest plugin setup",
            "Payfast",
            "70+ plugins and gateway-first orientation reduce custom dev effort.",
        ],
        [
            "Cashflow-sensitive operations",
            "Paystack",
            "No payout charge listed; Payfast adds payout fee and optional immediate payout surcharge.",
        ],
        [
            "Need both recurring and one-click card charging",
            "Tie (slight edge Paystack for our stack)",
            "Both support recurring/tokenized flows; edge depends on method coverage vs API preference.",
        ],
    ]
    matrix_table = Table(
        build_wrapped_table_rows(use_case_data, table_cell_style_teal_header, table_cell_style),
        colWidths=[53 * mm, 27 * mm, 93 * mm],
        repeatRows=1,
    )
    matrix_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d1d5db")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(matrix_table)

    story.append(Paragraph("3) Cost Analysis Scenarios (ex VAT)", h2_style))
    scenarios = build_cost_scenarios()
    scenario_data = [["Scenario", "Gross", "Paystack fees", "Payfast fees (+payout)", "Paystack advantage"]]
    for s in scenarios:
        scenario_data.append(
            [
                s.name,
                zar(s.gross_revenue),
                zar(s.paystack_fee),
                zar(s.payfast_total),
                zar(s.paystack_advantage),
            ]
        )
    scenario_table = Table(
        build_wrapped_table_rows(scenario_data, table_cell_style_dark_header, table_cell_style),
        colWidths=[65 * mm, 20 * mm, 26 * mm, 31 * mm, 31 * mm],
        repeatRows=1,
    )
    scenario_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(scenario_table)
    story.append(Spacer(1, 6))
    story.append(
        Paragraph(
            "Model assumptions: Paystack local card 2.9% + R1; Paystack Capitec/Ozow EFT 2% no flat fee; "
            "Payfast card 3.2% + R2; Payfast Instant EFT 2% min R2; Payfast payout R8.70 each. "
            "Where custom enterprise pricing applies, actuals may differ.",
            note_style,
        )
    )

    story.append(Paragraph("4) Recommendation for Website Roast AI", h2_style))
    story.append(
        Paragraph(
            "<b>Recommendation:</b> Use <b>Paystack as primary</b> for Phase 1 billing.",
            body_style,
        )
    )
    story.append(
        Paragraph(
            "Why: Your product is a custom SaaS app (Next.js + API routes + Supabase), so API-first speed, predictable recurring flows, "
            "and stronger fee economics at SaaS price points matter most.",
            body_style,
        )
    )
    story.append(
        Paragraph(
            "<b>When to add Payfast as a second rail:</b> If live data shows a large share of failed/abandoned checkouts because users request payment methods "
            "outside the default Paystack set, or if plugin-based merchant deployments become a major revenue line.",
            body_style,
        )
    )
    story.append(
        Paragraph(
            "<b>Practical rollout:</b> 1) Ship Paystack checkout + webhook entitlement updates. "
            "2) Track failed checkout reasons and preferred payment methods. "
            "3) Re-evaluate dual-provider setup after 4-8 weeks of conversion data.",
            body_style,
        )
    )

    story.append(
        Paragraph(
            f"5) Sources (official pages, accessed {SOURCES_ACCESSED_DATE})",
            h2_style,
        )
    )
    sources = [
        "Paystack South Africa Pricing: https://paystack.com/za/pricing",
        "Paystack Payment Channels docs: https://paystack.com/docs/payments/payment-channels/",
        "Paystack Subscriptions docs: https://paystack.com/docs/payments/subscriptions/",
        "Paystack Recurring Charges docs: https://paystack.com/docs/payments/recurring-charges/",
        "Payfast Fees: https://payfast.io/fees/",
        "Payfast Subscriptions feature: https://payfast.io/features/subscriptions/",
        "Payfast Tokenization feature: https://payfast.io/features/tokenization/",
        "Payfast collection/payout process: https://support.payfast.help/portal/en/kb/articles/collection-and-payout-process-20-9-2022",
    ]
    for source in sources:
        story.append(Paragraph(source, body_style))

    doc.build(story)


def main() -> None:
    output = Path("docs/paystack-vs-payfast-usage-cases-09-04-2026.pdf")
    build_pdf(output)
    print(output.resolve())


if __name__ == "__main__":
    main()
