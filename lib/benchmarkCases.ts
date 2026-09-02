import type { BenchmarkCase, ScrapedWebsiteData } from "./types";

function buildScraped(partial: Partial<ScrapedWebsiteData>): ScrapedWebsiteData {
  return {
    url: partial.url ?? "https://example.test",
    title: partial.title ?? "No title found.",
    description: partial.description ?? "No meta description found.",
    headings: partial.headings ?? { h1: [], h2: [] },
    content: partial.content ?? "",
    contentSnippet: partial.contentSnippet ?? (partial.content ?? "").slice(0, 1500),
    ctas: partial.ctas ?? [],
    trustSignals: partial.trustSignals ?? [],
    contactSignals: partial.contactSignals ?? [],
    genericPhrasesFound: partial.genericPhrasesFound ?? [],
    visualHints: partial.visualHints ?? {
      aboveFoldCtaLikely: false,
      heroHeadingEarly: false,
      formAboveFoldLikely: false,
      trustTokenAboveFold: false,
      buttonCount: 0,
      linkCount: 0,
    },
    visualAudit: partial.visualAudit,
    crawl: partial.crawl,
    siteFacts: partial.siteFacts,
    contentLength: partial.contentLength ?? (partial.content ?? "").length,
    retryUsed: partial.retryUsed ?? false,
    usedRelaxedFallback: partial.usedRelaxedFallback ?? false,
    scrapeQuality:
      partial.scrapeQuality ??
      ((partial.contentLength ?? (partial.content ?? "").length) >= 1200
        ? "high"
        : (partial.contentLength ?? (partial.content ?? "").length) >= 350
          ? "medium"
          : "low"),
  };
}

export const benchmarkCases: BenchmarkCase[] = [
  {
    id: "thin-placeholder",
    label: "Thin placeholder page",
    expectedScoreRange: [0, 2.5],
    mustFlag: ["clarity", "trust", "CTA"],
    scraped: buildScraped({
      url: "https://example.com",
      title: "Example Domain",
      headings: { h1: ["Example Domain"], h2: [] },
      content: "Example Domain. This domain is for use in documentation examples.",
    }),
  },
  {
    id: "parked-domain",
    label: "Parked domain / coming soon",
    expectedScoreRange: [0, 2.8],
    mustFlag: ["clarity", "trust", "CTA", "differentiation"],
    scraped: buildScraped({
      url: "https://comingsoon.test",
      title: "Coming Soon",
      description: "Our website is launching soon.",
      headings: { h1: ["Coming Soon"], h2: [] },
      content:
        "We are working hard on something amazing. Check back later for updates.",
      genericPhrasesFound: ["best solutions", "we care"],
    }),
  },
  {
    id: "brochure-no-cta",
    label: "Brochure site with no CTA",
    expectedScoreRange: [0, 3.8],
    mustFlag: ["CTA", "trust"],
    scraped: buildScraped({
      url: "https://brochure.test",
      title: "BlueRock Interiors | Home Design Services",
      description:
        "BlueRock Interiors designs modern living spaces for homes and offices.",
      headings: {
        h1: ["Modern Interiors for Contemporary Homes"],
        h2: ["Our Process", "About Us", "Portfolio"],
      },
      content:
        "BlueRock Interiors provides home and office interior design services across the city. " +
        "Our professional team works with clients to design beautiful and functional spaces.",
      genericPhrasesFound: ["professional team", "high quality"],
      visualHints: {
        aboveFoldCtaLikely: false,
        heroHeadingEarly: true,
        formAboveFoldLikely: false,
        trustTokenAboveFold: false,
        buttonCount: 1,
        linkCount: 12,
      },
    }),
  },
  {
    id: "generic-services-page",
    label: "Generic service page",
    expectedScoreRange: [0.3, 4.0],
    mustFlag: ["differentiation", "trust"],
    scraped: buildScraped({
      url: "https://generic-service.test",
      title: "Professional Team | Quality Service",
      description:
        "We provide quality service with affordable prices and customer satisfaction.",
      headings: {
        h1: ["Professional Team You Can Trust"],
        h2: ["Affordable Prices", "Best Solutions for Everyone"],
      },
      content:
        "We care about customer satisfaction and provide quality service with affordable prices. " +
        "Our professional team delivers best solutions for every customer.",
      ctas: ["contact us"],
      genericPhrasesFound: [
        "quality service",
        "affordable prices",
        "we care",
        "customer satisfaction",
        "professional team",
      ],
      visualHints: {
        aboveFoldCtaLikely: false,
        heroHeadingEarly: true,
        formAboveFoldLikely: false,
        trustTokenAboveFold: false,
        buttonCount: 1,
        linkCount: 6,
      },
    }),
  },
  {
    id: "construction-keyword-stuffed-contact",
    label: "Construction site with SEO-stuffed headline and soft CTA",
    expectedScoreRange: [4.8, 6.3],
    expectedVisualDesignRange: [3.0, 4.5],
    mustFlag: [],
    mustPenalty: ["Keyword-Stuffed Headline", "Mismatched CTA Goal"],
    scraped: buildScraped({
      url: "https://constructioncompany-pretoria.co.za/",
      title: "Construction Company Pretoria: Hire Pretoria Building Contractors",
      description:
        "Construction Company Pretoria provides residential, commercial, and industrial building services in Pretoria, Centurion, and Tshwane.",
      headings: {
        h1: [
          "Construction Company Pretoria: Complete Residential, Commercial, and Industrial Building Services by Top Pretoria Building Contractors in Pretoria, East, North, Centurion & Tshwane",
        ],
        h2: [
          "Building Contractors Pretoria",
          "Residential Construction Pretoria",
          "Commercial Construction Services",
          "Contact Construction Company Pretoria",
        ],
      },
      content:
        "Construction Company Pretoria offers building contractors, renovations, paving, roofing, and construction services across Pretoria and Centurion. " +
        "The page repeats construction and Pretoria terms heavily and asks visitors to contact the company instead of pushing one clear quote request. " +
        "The company mentions years of experience, a workmanship guarantee, and 5-star service claims. " +
        "Email info@constructioncompany-pretoria.co.za or WhatsApp 060 551 9245 for building work.",
      ctas: ["contact", "contact us"],
      trustSignals: ["years of experience", "guarantee", "5-star"],
      contactSignals: [
        "Email: info@constructioncompany-pretoria.co.za",
        "Phone: 060 551 9245",
      ],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: true,
        trustTokenAboveFold: false,
        buttonCount: 2,
        linkCount: 32,
      },
      visualAudit: {
        available: true,
        sampledAt: "2026-08-31T12:07:51.570Z",
        summary: {
          ctaProminence: 69,
          readability: 87,
          hierarchy: 90,
          consistency: 80,
          motionDistraction: 21,
        },
        findings: [
          "Visual conversion signals are directionally solid across desktop and mobile.",
        ],
        evidence: [
          "Visual score summary -> CTA prominence 69/100, readability 87/100, hierarchy 90/100, consistency 80/100, motion distraction 21/100.",
        ],
      },
    }),
  },
  {
    id: "dated-construction-landscaping-services",
    label: "Dated construction and landscaping service page",
    expectedScoreRange: [5.0, 5.8],
    expectedVisualDesignRange: [2.6, 3.2],
    mustFlag: [],
    mustPenalty: [
      "Mismatched CTA Goal",
      "Weak Visual CTA",
      "Low Visual Readability",
      "Distracting Motion",
      "Visible Copy Quality Gap",
    ],
    scraped: buildScraped({
      url: "https://elchomgroup.co.za/services/",
      title: "Elchom Group | Premier Construction & Landscaping Services in Gauteng",
      description:
        "Elchom Group provides construction, demolition, landscaping, paving, irrigation, and plant hire services in Gauteng.",
      headings: {
        h1: ["Pleased to be of Service"],
        h2: [
          "Pleased to be of Service",
          "Comprehensive Construction Services",
          "Comprehensive Landscaping Services",
          "Contact Us Today",
        ],
      },
      content:
        "Elchom Group has provided construction and landscaping services since 2015. The services page offers construction services, building services, demolition, rubble removal, site clearing, rock breaking, blasting, paving, landscaping, irrigation, instant lawns, tree felling, garden maintenance, plant hire and tipper trucker services in Gauteng and Johannesburg. The page asks visitors to call us but does not show project proof, client results, or strong quote-led next steps. The service copy includes phrasing like achieve the your landscaping goals and repeats quality service.",
      contentLength: 1800,
      ctas: ["call us", "contact us"],
      trustSignals: ["since"],
      contactSignals: ["Email: info@elchomgroup.co.za", "Phone: 083 555 0101"],
      genericPhrasesFound: [],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: false,
        formAboveFoldLikely: false,
        trustTokenAboveFold: false,
        buttonCount: 1,
        linkCount: 42,
      },
      visualAudit: {
        available: true,
        sampledAt: "2026-08-31T12:25:00.000Z",
        summary: {
          ctaProminence: 19,
          readability: 0,
          hierarchy: 76,
          consistency: 81,
          motionDistraction: 69,
        },
        findings: [
          "Primary CTA is visually weak across sampled desktop and mobile views.",
          "Text readability is poor against its backgrounds.",
        ],
        evidence: [
          "Visual score summary -> CTA prominence 19/100, readability 0/100, hierarchy 76/100, consistency 81/100, motion distraction 69/100.",
        ],
      },
      crawl: {
        strategy: "multi_page",
        pageCount: 4,
        visitedUrls: [
          "https://elchomgroup.co.za/",
          "https://elchomgroup.co.za/services/",
          "https://elchomgroup.co.za/about/",
          "https://elchomgroup.co.za/contact/",
        ],
        failedUrls: [],
        pages: [
          {
            url: "https://elchomgroup.co.za/",
            role: "home",
            title: "Elchom Group | Premier Construction & Landscaping Services in Gauteng",
            primaryHeading: "Welcome to Elchom Group",
            contentSnippet: "Welcome to Elchom Group construction and landscaping services in Gauteng.",
            contentLength: 900,
            headingCount: 4,
          },
          {
            url: "https://elchomgroup.co.za/services/",
            role: "services",
            title: "Elchom Group | Services",
            primaryHeading: "Comprehensive Construction Services",
            contentSnippet: "Construction, demolition, rubble removal, landscaping and paving services.",
            contentLength: 1600,
            headingCount: 7,
          },
        ],
      },
      siteFacts: {
        companyName: "Elchom Group",
        services: [
          { value: "Construction", sourceUrl: "https://elchomgroup.co.za/services/", sourceRole: "services" },
          { value: "Landscaping", sourceUrl: "https://elchomgroup.co.za/services/", sourceRole: "services" },
          { value: "Paving", sourceUrl: "https://elchomgroup.co.za/services/", sourceRole: "services" },
        ],
        locations: [
          { value: "Gauteng", sourceUrl: "https://elchomgroup.co.za/services/", sourceRole: "services" },
          { value: "Johannesburg", sourceUrl: "https://elchomgroup.co.za/contact/", sourceRole: "contact" },
        ],
        contacts: [
          { value: "Email: info@elchomgroup.co.za", sourceUrl: "https://elchomgroup.co.za/contact/", sourceRole: "contact" },
          { value: "Phone: 083 555 0101", sourceUrl: "https://elchomgroup.co.za/contact/", sourceRole: "contact" },
        ],
        ctas: [
          { value: "call us", sourceUrl: "https://elchomgroup.co.za/services/", sourceRole: "services" },
          { value: "contact us", sourceUrl: "https://elchomgroup.co.za/contact/", sourceRole: "contact" },
        ],
        trustSignals: [
          { value: "since", sourceUrl: "https://elchomgroup.co.za/", sourceRole: "home" },
        ],
        pagesReviewed: [
          { value: "Home: Welcome to Elchom Group", sourceUrl: "https://elchomgroup.co.za/", sourceRole: "home" },
          { value: "Services: Comprehensive Construction Services", sourceUrl: "https://elchomgroup.co.za/services/", sourceRole: "services" },
          { value: "Contact: Contact Us Today", sourceUrl: "https://elchomgroup.co.za/contact/", sourceRole: "contact" },
        ],
        copyIssues: [
          { value: 'Grammar issue: "achieve the your"', sourceUrl: "https://elchomgroup.co.za/services/", sourceRole: "services" },
          { value: 'Copy issue: "tipper trucker"', sourceUrl: "https://elchomgroup.co.za/services/", sourceRole: "services" },
        ],
      },
    }),
  },
  {
    id: "blog-heavy-no-offer",
    label: "Blog-heavy site with no clear offer",
    expectedScoreRange: [0.3, 4.5],
    mustFlag: ["CTA"],
    scraped: buildScraped({
      url: "https://blog-only.test",
      title: "Thoughts on Growth Marketing",
      description:
        "A blog sharing ideas and experiments in digital marketing.",
      headings: {
        h1: ["Growth Marketing Insights"],
        h2: ["Latest Posts", "Case Notes", "Archive"],
      },
      content:
        "This blog shares weekly thoughts on positioning, copywriting, and acquisition. " +
        "We cover examples from SaaS, ecommerce, and local businesses.",
      trustSignals: ["case studies"],
      visualHints: {
        aboveFoldCtaLikely: false,
        heroHeadingEarly: true,
        formAboveFoldLikely: false,
        trustTokenAboveFold: false,
        buttonCount: 0,
        linkCount: 35,
      },
    }),
  },
  {
    id: "agency-no-proof",
    label: "Agency page with claims but no proof",
    expectedScoreRange: [1.8, 5.5],
    mustFlag: ["trust", "differentiation"],
    scraped: buildScraped({
      url: "https://agency-no-proof.test",
      title: "ScaleFast Agency | Performance Marketing",
      description: "We help brands scale with paid media and creative strategy.",
      headings: {
        h1: ["Scale Faster with Better Ads"],
        h2: ["Services", "Our Approach", "Get in Touch"],
      },
      content:
        "ScaleFast Agency helps ecommerce brands improve advertising performance. " +
        "Our team delivers tailored solutions and high quality service to growing companies.",
      ctas: ["get in touch"],
      genericPhrasesFound: ["tailored solutions", "high quality"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: false,
        trustTokenAboveFold: false,
        buttonCount: 2,
        linkCount: 10,
      },
    }),
  },
  {
    id: "directory-page",
    label: "Directory style page with weak conversion",
    expectedScoreRange: [0, 3.8],
    mustFlag: ["CTA", "differentiation"],
    scraped: buildScraped({
      url: "https://directory.test",
      title: "Best Contractors in Cape Town",
      description:
        "Find and compare trusted local contractors in one place.",
      headings: {
        h1: ["Contractor Directory"],
        h2: ["Top Listings", "Categories", "Latest Reviews"],
      },
      content:
        "Browse listings for electricians, plumbers, and builders. Compare ratings and reviews. " +
        "Use filters to find the right contractor for your project.",
      trustSignals: ["reviews"],
      visualHints: {
        aboveFoldCtaLikely: false,
        heroHeadingEarly: true,
        formAboveFoldLikely: false,
        trustTokenAboveFold: true,
        buttonCount: 1,
        linkCount: 60,
      },
    }),
  },
  {
    id: "consultant-clear-offer-weak-proof",
    label: "Consultant with clear offer, weak proof",
    expectedScoreRange: [4.0, 6.8],
    mustFlag: ["trust"],
    scraped: buildScraped({
      url: "https://consultant.test",
      title: "RevenueOps Consultant | Fix Your Pipeline in 30 Days",
      description:
        "I help B2B teams repair broken funnel stages and close more deals.",
      headings: {
        h1: ["Fix Your B2B Pipeline in 30 Days"],
        h2: ["What I Do", "Who I Help", "Book a Strategy Call"],
      },
      content:
        "I work with B2B founders and sales leaders to identify bottlenecks and increase close rate. " +
        "Get a full pipeline audit and action plan in one week.",
      ctas: ["book now", "schedule a call"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: true,
        trustTokenAboveFold: false,
        buttonCount: 3,
        linkCount: 14,
      },
    }),
  },
  {
    id: "ecommerce-basic",
    label: "Basic ecommerce homepage",
    expectedScoreRange: [3.0, 6.9],
    mustFlag: ["trust"],
    scraped: buildScraped({
      url: "https://store-basic.test",
      title: "UrbanPeak Apparel | Performance Streetwear",
      description:
        "Shop premium performance streetwear for men and women.",
      headings: {
        h1: ["Performance Streetwear That Moves With You"],
        h2: ["New Arrivals", "Best Sellers", "Shop Now"],
      },
      content:
        "Discover lightweight joggers, training tees, and weatherproof outerwear. " +
        "Shop online and get nationwide delivery. Limited stock on top sellers.",
      ctas: ["shop now", "buy now"],
      trustSignals: ["reviews"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: false,
        trustTokenAboveFold: true,
        buttonCount: 5,
        linkCount: 45,
      },
    }),
  },
  {
    id: "solar-product-store",
    label: "Solar ecommerce catalogue with product categories",
    expectedScoreRange: [4.0, 7.2],
    mustFlag: ["differentiation"],
    scraped: buildScraped({
      url: "https://solar-store.test",
      title: "Solar Solutions and Products for Residential & Commercial",
      description:
        "Shop solar inverters, solar panels, batteries, solar system kits, and accessories online.",
      headings: {
        h1: ["Login to my account"],
        h2: ["Product Categories", "Popular Brands"],
      },
      content:
        "All Prices Include VAT. Currency ZAR USD GBP. Login / Signup. 0 Cart. Shop our products. " +
        "Products by Brand. Solar Inverters by Type. Solar Panels. Batteries. Victron Energy. " +
        "Solar Accessories. Solar Panel Mounting Systems. Solar System Kits. Specials. Clearance. " +
        "Delivery nation wide. Quality Trusted Products. Full in country OEM support. EFT or Secure on-line payments.",
      ctas: ["shop our products", "contact us", "call us"],
      trustSignals: [
        "quality trusted products",
        "full in country OEM support",
        "secure payments",
      ],
      contactSignals: ["Call us +27 10 500 1019", "sales@example.test"],
      siteFacts: {
        companyName: "Solar Store",
        services: [{ value: "Solar" }],
        productCategories: [
          { value: "Solar inverters" },
          { value: "Solar panels" },
          { value: "Batteries" },
          { value: "Solar system kits" },
          { value: "Solar accessories" },
        ],
        locations: [{ value: "South Africa" }],
        contacts: [{ value: "sales@example.test" }],
        ctas: [{ value: "shop our products" }, { value: "contact us" }],
        trustSignals: [
          { value: "quality trusted products" },
          { value: "full in country OEM support" },
          { value: "secure payments" },
        ],
        pagesReviewed: [
          { value: "Home: Login to my account" },
          { value: "Services: Solar Connector MC4 Crimping Tool" },
          { value: "Services: Battery Disconnect Mersen 2P-160A" },
        ],
        copyIssues: [],
      },
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: false,
        formAboveFoldLikely: false,
        trustTokenAboveFold: true,
        buttonCount: 6,
        linkCount: 80,
      },
    }),
  },
  {
    id: "saas-no-pricing",
    label: "SaaS with good copy but weak buying confidence",
    expectedScoreRange: [4.5, 7.0],
    mustFlag: ["trust"],
    scraped: buildScraped({
      url: "https://saas-nopricing.test",
      title: "ShipFlow | Delivery Coordination for Ecommerce Teams",
      description:
        "Coordinate shipments and customer updates from one dashboard.",
      headings: {
        h1: ["Reduce Delivery Delays by 23% in 45 Days"],
        h2: ["How It Works", "Integrations", "Start Free Trial"],
      },
      content:
        "ShipFlow gives operations teams a single command center for fulfillment and delivery tracking. " +
        "Automate carrier updates, reduce support tickets, and protect customer experience.",
      ctas: ["start free trial", "book now"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: true,
        trustTokenAboveFold: false,
        buttonCount: 4,
        linkCount: 24,
      },
    }),
  },
  {
    id: "legal-firm-no-cta",
    label: "Legal firm with trust cues but weak CTA",
    expectedScoreRange: [4.2, 6.8],
    mustFlag: ["CTA"],
    scraped: buildScraped({
      url: "https://legal.test",
      title: "Brightline Legal | Commercial Contract Attorneys",
      description:
        "Commercial legal counsel for scaling companies.",
      headings: {
        h1: ["Commercial Contracts for Fast-Growing Teams"],
        h2: ["Practice Areas", "Client Results", "About the Firm"],
      },
      content:
        "Since 2012, Brightline Legal has advised 600+ businesses on contract strategy and negotiation. " +
        "Case studies and testimonials available. Contact: hello@brightlinelegal.test",
      trustSignals: ["case studies", "testimonials", "clients", "since"],
      contactSignals: ["Email: hello@brightlinelegal.test"],
      visualHints: {
        aboveFoldCtaLikely: false,
        heroHeadingEarly: true,
        formAboveFoldLikely: false,
        trustTokenAboveFold: true,
        buttonCount: 1,
        linkCount: 20,
      },
    }),
  },
  {
    id: "clinic-strong-trust-weak-diff",
    label: "Clinic page with trust but generic positioning",
    expectedScoreRange: [4.4, 6.9],
    mustFlag: ["differentiation"],
    scraped: buildScraped({
      url: "https://clinic.test",
      title: "Hillside Dental Clinic | Family Dentistry",
      description:
        "Comprehensive family dentistry with modern equipment and caring staff.",
      headings: {
        h1: ["Family Dental Care You Can Trust"],
        h2: ["Our Services", "Patient Reviews", "Book Appointment"],
      },
      content:
        "We provide high quality dental care for all ages. " +
        "Rated 4.9/5 from 410 reviews. Call now: +1 (212) 555-0178. " +
        "Our professional team focuses on customer satisfaction.",
      ctas: ["book now", "call now"],
      trustSignals: ["reviews", "trusted by"],
      contactSignals: ["Phone: +1 (212) 555-0178"],
      genericPhrasesFound: ["high quality", "professional team", "customer satisfaction"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: true,
        trustTokenAboveFold: true,
        buttonCount: 4,
        linkCount: 18,
      },
    }),
  },
  {
    id: "course-landing-overhype",
    label: "Course landing page with hype copy",
    expectedScoreRange: [2.4, 6.4],
    mustFlag: ["trust", "differentiation"],
    scraped: buildScraped({
      url: "https://course-hype.test",
      title: "Scale to 6 Figures Fast | Ultimate Marketing Bootcamp",
      description:
        "Learn the best solutions and proven methods to grow quickly.",
      headings: {
        h1: ["Build a 6-Figure Business in 30 Days"],
        h2: ["What You Get", "Student Wins", "Join Now"],
      },
      content:
        "This program gives you everything you need to win. " +
        "Get high quality templates, affordable prices, and professional coaching.",
      ctas: ["sign up", "start now"],
      genericPhrasesFound: ["best solutions", "high quality", "affordable prices"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: true,
        trustTokenAboveFold: false,
        buttonCount: 6,
        linkCount: 11,
      },
    }),
  },
  {
    id: "industrial-b2b-cluttered",
    label: "Industrial B2B page with clutter",
    expectedScoreRange: [3.0, 6.5],
    mustFlag: ["CTA"],
    scraped: buildScraped({
      url: "https://industrial.test",
      title: "MecroTech Systems | Manufacturing Automation",
      description:
        "Automation systems and controls for industrial manufacturing lines.",
      headings: {
        h1: ["Industrial Automation for High-Throughput Plants"],
        h2: ["Solutions", "Industries", "Documentation", "Downloads", "News"],
      },
      content:
        "MecroTech provides PLC integration, SCADA solutions, and control panel engineering. " +
        "Trusted by operators across food, mining, and packaging sectors since 2008. " +
        "Browse documentation and technical resources.",
      trustSignals: ["trusted by", "since"],
      visualHints: {
        aboveFoldCtaLikely: false,
        heroHeadingEarly: true,
        formAboveFoldLikely: false,
        trustTokenAboveFold: true,
        buttonCount: 1,
        linkCount: 52,
      },
    }),
  },
  {
    id: "startup-good-headline-weak-contact",
    label: "Startup page with good headline but weak contact path",
    expectedScoreRange: [4.5, 7.0],
    mustFlag: ["trust"],
    scraped: buildScraped({
      url: "https://startup-weak-contact.test",
      title: "FlowMap | Cut Onboarding Time by 40%",
      description:
        "Interactive onboarding checklists and team workflows for SaaS companies.",
      headings: {
        h1: ["Cut Customer Onboarding Time by 40%"],
        h2: ["How FlowMap Works", "Customer Stories", "Start Trial"],
      },
      content:
        "FlowMap helps customer success teams automate onboarding milestones and stakeholder updates. " +
        "Used by fast-growing SaaS teams to reduce churn in the first 90 days.",
      ctas: ["start free trial", "sign up"],
      trustSignals: ["case studies"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: true,
        trustTokenAboveFold: false,
        buttonCount: 4,
        linkCount: 22,
      },
    }),
  },
  {
    id: "proof-rich-saas",
    label: "Proof-heavy SaaS homepage",
    expectedScoreRange: [7.2, 10],
    mustFlag: [],
    scraped: buildScraped({
      url: "https://proof-saas.test",
      title: "AcmeCRM | Close Deals Faster with AI Follow-Ups",
      description:
        "Trusted by 1200+ B2B teams. Book more meetings with automated follow-up playbooks.",
      headings: {
        h1: ["Close 27% More Deals in 60 Days with AcmeCRM"],
        h2: [
          "Trusted by 1200+ teams",
          "Case studies from real sales teams",
          "Book a live demo",
        ],
      },
      content:
        "Trusted by 1200+ teams. Rated 4.8/5 from 380 reviews. " +
        "See case studies and customer testimonials. " +
        "Book now for a free consultation. Call now at +1 (202) 555-0147 or email growth@acmecrm.test. " +
        "Since 2018, our platform helps sales teams automate follow-up and recover lost pipeline.",
      ctas: ["book now", "free consultation", "call now", "sign up"],
      trustSignals: ["trusted by", "reviews", "case studies", "testimonials", "since"],
      contactSignals: ["Email: growth@acmecrm.test", "Phone: +1 (202) 555-0147"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: true,
        trustTokenAboveFold: true,
        buttonCount: 8,
        linkCount: 30,
      },
    }),
  },
  {
    id: "strong-local-service",
    label: "Strong local service business",
    expectedScoreRange: [6.8, 9.4],
    mustFlag: [],
    scraped: buildScraped({
      url: "https://local-strong.test",
      title: "Peak Plumbing | Emergency Plumbing in 60 Minutes",
      description:
        "24/7 emergency plumbers. 2,300+ five-star reviews. Call now for same-day service.",
      headings: {
        h1: ["Emergency Plumbing in 60 Minutes or Less"],
        h2: ["Rated 4.9 by 2,300+ Homeowners", "Book a Technician", "Service Areas"],
      },
      content:
        "Peak Plumbing has served homeowners since 2011. " +
        "Rated 4.9/5 from 2,300+ reviews. Request a quote or call now: +1 (602) 555-0192. " +
        "Licensed, insured, and backed by a workmanship guarantee.",
      ctas: ["call now", "request a quote", "book now"],
      trustSignals: ["reviews", "trusted by", "since", "guarantee"],
      contactSignals: ["Phone: +1 (602) 555-0192"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: true,
        trustTokenAboveFold: true,
        buttonCount: 7,
        linkCount: 24,
      },
    }),
  },
  {
    id: "ecommerce-strong-proof",
    label: "Ecommerce with strong proof and urgency",
    expectedScoreRange: [6.9, 9.5],
    mustFlag: [],
    scraped: buildScraped({
      url: "https://ecom-strong.test",
      title: "VoltGear | Performance Running Shoes",
      description:
        "4.8/5 from 9,400 runners. Free shipping and 30-day returns.",
      headings: {
        h1: ["Run Faster in the New Volt X1"],
        h2: ["4.8/5 from 9,400 Reviews", "Shop Men", "Shop Women"],
      },
      content:
        "Buy now and get free shipping today. " +
        "Trusted by 9,400 runners and featured in independent reviews. " +
        "Contact support: help@voltgear.test.",
      ctas: ["buy now", "shop now", "start now"],
      trustSignals: ["reviews", "trusted by", "guarantee"],
      contactSignals: ["Email: help@voltgear.test"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: false,
        trustTokenAboveFold: true,
        buttonCount: 9,
        linkCount: 52,
      },
    }),
  },
  {
    id: "fintech-strong",
    label: "Fintech product page with confidence signals",
    expectedScoreRange: [7.0, 9.6],
    mustFlag: [],
    scraped: buildScraped({
      url: "https://fintech-strong.test",
      title: "LedgerPilot | Close Monthly Books 3x Faster",
      description:
        "Trusted by 4,100 finance teams. SOC2 compliant. Book a demo.",
      headings: {
        h1: ["Close Monthly Books 3x Faster"],
        h2: ["Trusted by 4,100 Finance Teams", "Case Studies", "Book a Demo"],
      },
      content:
        "LedgerPilot automates reconciliations and variance reporting for controllers and CFO teams. " +
        "See customer case studies with measurable outcomes. " +
        "Request a quote or book now. Contact: sales@ledgerpilot.test.",
      ctas: ["book now", "request a quote", "get quote"],
      trustSignals: ["trusted by", "case studies", "reviews"],
      contactSignals: ["Email: sales@ledgerpilot.test"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: true,
        trustTokenAboveFold: true,
        buttonCount: 6,
        linkCount: 31,
      },
    }),
  },
  {
    id: "healthcare-private-practice-strong",
    label: "Private practice with clear conversion path",
    expectedScoreRange: [6.6, 9.3],
    mustFlag: [],
    scraped: buildScraped({
      url: "https://practice-strong.test",
      title: "Riverstone Physiotherapy | Recover Faster with Expert Care",
      description:
        "Book now for personalized rehab plans. Trusted by athletes and families since 2010.",
      headings: {
        h1: ["Recover Faster with Personalized Physiotherapy"],
        h2: ["Book Appointment", "Patient Stories", "Insurance Accepted"],
      },
      content:
        "Call now at +1 (303) 555-0129 or request a quote online. " +
        "Over 1,100 five-star reviews. Trusted by local sports clubs since 2010.",
      ctas: ["book now", "call now", "request a quote"],
      trustSignals: ["reviews", "trusted by", "since"],
      contactSignals: ["Phone: +1 (303) 555-0129"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: true,
        trustTokenAboveFold: true,
        buttonCount: 5,
        linkCount: 20,
      },
    }),
  },
  {
    id: "logistics-b2b-strong",
    label: "B2B logistics with clear offer and proof",
    expectedScoreRange: [6.8, 9.4],
    mustFlag: [],
    scraped: buildScraped({
      url: "https://logistics-strong.test",
      title: "FreightAxis | Reduce Shipment Delays by 31%",
      description:
        "Shipment visibility platform trusted by 800+ operations teams.",
      headings: {
        h1: ["Reduce Shipment Delays by 31% in 90 Days"],
        h2: ["Trusted by Leading 3PL Teams", "Book a Demo", "Customer Results"],
      },
      content:
        "FreightAxis gives operations teams real-time visibility and exception workflows. " +
        "Case studies show 31% fewer delays and 22% lower expedite spend. " +
        "Book now or contact: demo@freightaxis.test.",
      ctas: ["book now", "start now", "get quote"],
      trustSignals: ["trusted by", "case studies", "reviews"],
      contactSignals: ["Email: demo@freightaxis.test"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: true,
        trustTokenAboveFold: true,
        buttonCount: 6,
        linkCount: 27,
      },
    }),
  },
  {
    id: "saas-docs-high-clarity-low-cta",
    label: "Developer docs style page",
    expectedScoreRange: [0, 4.8],
    mustFlag: ["CTA"],
    scraped: buildScraped({
      url: "https://docs-style.test",
      title: "Acme API Documentation",
      description: "Developer documentation for Acme API endpoints and SDKs.",
      headings: {
        h1: ["Acme API Docs"],
        h2: ["Authentication", "Rate Limits", "Examples", "SDKs"],
      },
      content:
        "Use Acme API to automate customer data workflows. " +
        "Read endpoint references, examples, and error handling guides.",
      trustSignals: ["trusted by"],
      visualHints: {
        aboveFoldCtaLikely: false,
        heroHeadingEarly: true,
        formAboveFoldLikely: false,
        trustTokenAboveFold: false,
        buttonCount: 0,
        linkCount: 68,
      },
    }),
  },
  {
    id: "high-traffic-media-page",
    label: "Media/news style page",
    expectedScoreRange: [0, 4.5],
    mustFlag: ["CTA", "differentiation"],
    scraped: buildScraped({
      url: "https://media-page.test",
      title: "DailyWire News",
      description:
        "Breaking stories, interviews, and opinion from around the world.",
      headings: {
        h1: ["Top Stories Today"],
        h2: ["Politics", "Business", "Culture", "Technology"],
      },
      content:
        "Read the latest headlines and analysis. " +
        "Watch interviews and explore trending topics from the editorial team.",
      ctas: ["sign up"],
      visualHints: {
        aboveFoldCtaLikely: false,
        heroHeadingEarly: true,
        formAboveFoldLikely: false,
        trustTokenAboveFold: false,
        buttonCount: 1,
        linkCount: 95,
      },
    }),
  },
  {
    id: "nonprofit-donation-page",
    label: "Nonprofit donation page",
    expectedScoreRange: [5.0, 7.8],
    mustFlag: ["differentiation"],
    scraped: buildScraped({
      url: "https://nonprofit.test",
      title: "GiveWater | Clean Water for Rural Communities",
      description:
        "Donate now to fund clean water infrastructure projects.",
      headings: {
        h1: ["Help Fund Clean Water Projects This Month"],
        h2: ["Where Your Donation Goes", "Impact Reports", "Donate Now"],
      },
      content:
        "Since 2016, GiveWater has completed 180 projects across rural communities. " +
        "Read our impact reports and donor testimonials. Donate now or contact team@givewater.test.",
      ctas: ["donate now", "start now"],
      trustSignals: ["case studies", "testimonials", "since"],
      contactSignals: ["Email: team@givewater.test"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: true,
        trustTokenAboveFold: true,
        buttonCount: 4,
        linkCount: 28,
      },
    }),
  },
  {
    id: "franchise-site-heavy-nav",
    label: "Franchise site with heavy navigation and mixed signals",
    expectedScoreRange: [4.0, 7.0],
    mustFlag: [],
    scraped: buildScraped({
      url: "https://franchise.test",
      title: "SunBite Cafes | Franchise Opportunities",
      description:
        "Join a growing cafe franchise with proven systems and support.",
      headings: {
        h1: ["Own a SunBite Cafe Franchise"],
        h2: ["Investment Overview", "Training & Support", "Apply Now"],
      },
      content:
        "SunBite has opened 140+ locations since 2014. " +
        "Request a quote to receive the franchise prospectus. " +
        "Trusted by entrepreneurs nationwide.",
      ctas: ["apply now", "request a quote"],
      trustSignals: ["trusted by", "since"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: false,
        trustTokenAboveFold: true,
        buttonCount: 3,
        linkCount: 70,
      },
    }),
  },
  {
    id: "seo-landing-strong-copy-weak-proof",
    label: "SEO agency landing page strong copy weak proof",
    expectedScoreRange: [4.5, 7.1],
    mustFlag: ["trust"],
    scraped: buildScraped({
      url: "https://seo-landing.test",
      title: "RankForge | Double Organic Leads in 6 Months",
      description:
        "SEO campaigns focused on pipeline growth for B2B SaaS.",
      headings: {
        h1: ["Double Organic Leads in 6 Months"],
        h2: ["Our Process", "Industries We Serve", "Book Strategy Call"],
      },
      content:
        "RankForge builds SEO strategies for B2B SaaS teams that need qualified pipeline. " +
        "Book now for a strategy call and growth roadmap.",
      ctas: ["book now", "schedule a call"],
      visualHints: {
        aboveFoldCtaLikely: true,
        heroHeadingEarly: true,
        formAboveFoldLikely: true,
        trustTokenAboveFold: false,
        buttonCount: 3,
        linkCount: 17,
      },
    }),
  },
];
