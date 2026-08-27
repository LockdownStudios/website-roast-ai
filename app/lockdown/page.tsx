import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lockdown Studios | AI Avatars, Websites, Apps and 3D Experiences",
  description:
    "Lockdown Studios creates AI avatars, websites, apps and 3D experiences for businesses ready to look modern and move fast.",
};

const navItems = [
  { label: "Home", href: "#home" },
  { label: "AI Avatars", href: "#avatars" },
  { label: "Projects", href: "#projects" },
  { label: "Services", href: "#services" },
  { label: "Learning", href: "#learning" },
  { label: "Contact", href: "#contact" },
];

const proofPoints = [
  {
    value: "4",
    label: "Delivery tracks",
    detail: "AI avatars, websites, apps and 3D experiences under one studio.",
  },
  {
    value: "1",
    label: "End-to-end team",
    detail: "Strategy, creative direction, build and deployment stay connected.",
  },
  {
    value: "24h",
    label: "First response target",
    detail: "Fast qualification so serious projects do not sit in an inbox.",
  },
];

const services = [
  {
    title: "AI Avatars",
    text: "Custom digital presenters, training characters and brand-facing AI talent built for modern content flows.",
  },
  {
    title: "Websites",
    text: "Conversion-focused websites with clear offers, strong calls to action and a visual system that feels current.",
  },
  {
    title: "Apps",
    text: "Lean product interfaces, internal tools and interactive experiences that turn ideas into usable software.",
  },
  {
    title: "3D Experiences",
    text: "Immersive product moments, worlds and interactive scenes for brands that need more than static pages.",
  },
];

const projectSignals = [
  "Avatar-led product demos",
  "High-converting campaign pages",
  "Interactive 3D brand worlds",
];

const processSteps = [
  {
    title: "Map the outcome",
    text: "We define the audience, conversion action and launch constraint before production starts.",
  },
  {
    title: "Build the asset",
    text: "Creative, AI, web and 3D work move through one production path so the experience feels joined up.",
  },
  {
    title: "Deploy and improve",
    text: "The final page or product is shipped with clear next steps, review points and room to evolve.",
  },
];

const comparisons = [
  {
    title: "Typical creative vendor",
    items: ["Pretty output", "Unclear next action", "Separated design and build"],
  },
  {
    title: "Lockdown Studios",
    items: [
      "Campaign assets built around action",
      "One Contact Us path from hero to footer",
      "AI, web, app and 3D production connected",
    ],
  },
];

const faqs = [
  {
    question: "What kind of businesses is this for?",
    answer:
      "Teams that need modern digital assets for launches, campaigns, training, demos or brand experiences.",
  },
  {
    question: "Do we need a finished brief?",
    answer:
      "No. Bring the goal and current assets. The first conversation turns that into a practical build path.",
  },
  {
    question: "What happens after we contact you?",
    answer:
      "You get a focused reply, a short discovery path and a recommendation on the best starting point.",
  },
];

function ContactButton({
  className = "",
  small = false,
}: {
  className?: string;
  small?: boolean;
}) {
  return (
    <a
      className={[
        "inline-flex min-h-12 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-300 px-6 font-black text-slate-950 transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-200/45",
        small ? "text-sm" : "text-base",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      href="#contact"
    >
      Contact Us
    </a>
  );
}

export default function Home() {
  return (
    <main className="lockdown-page min-h-screen bg-[#020711] text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:font-bold focus:text-slate-950"
      >
        Skip to content
      </a>

      <header
        className="sticky top-0 z-40 border-b border-white/10 bg-[#020711]"
        id="home"
      >
        <nav
          aria-label="Primary navigation"
          className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8"
        >
          <a
            href="#home"
            className="text-xl font-black text-white focus:outline-none focus:ring-4 focus:ring-cyan-200/45"
            aria-label="Lockdown Studios home"
          >
            Lockdown Studios
          </a>
          <div className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                className="text-sm font-semibold text-blue-100/78 transition hover:text-cyan-200 focus:outline-none focus:ring-4 focus:ring-cyan-200/45"
                href={item.href}
              >
                {item.label}
              </a>
            ))}
          </div>
          <ContactButton small className="hidden sm:inline-flex" />
        </nav>
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 pb-4 sm:px-8 lg:hidden">
          {navItems.map((item) => (
            <a
              key={item.href}
              className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-blue-100/85 focus:outline-none focus:ring-4 focus:ring-cyan-200/45"
              href={item.href}
            >
              {item.label}
            </a>
          ))}
        </div>
      </header>

      <section className="relative isolate overflow-hidden">
        <div className="star-field absolute inset-0" aria-hidden="true" />
        <div className="absolute inset-0 bg-[#020711]/90" />

        <div
          id="main-content"
          className="relative mx-auto grid min-h-[calc(100vh-78px)] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_0.86fr] lg:py-24"
        >
          <div>
            <p className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
              <span className="h-px w-10 bg-cyan-300" />
              AI-powered creative studio
              <span className="h-px w-10 bg-cyan-300" />
            </p>
            <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[1.02] text-slate-100 sm:text-6xl lg:text-7xl">
              Build Worlds. Deploy Intelligence.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-blue-100/82 sm:text-xl">
              Lockdown Studios creates AI avatars, websites, apps and 3D
              experiences for businesses ready to look modern and move fast.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ContactButton className="w-full sm:w-auto" />
              <a
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-blue-200/45 px-6 font-bold text-blue-50 transition hover:border-cyan-200 hover:text-cyan-100 focus:outline-none focus:ring-4 focus:ring-cyan-200/45 sm:w-auto"
                href="#projects"
              >
                View Project Proof
              </a>
            </div>
            <p className="mt-3 text-sm font-medium text-blue-100/72">
              No pressure. Fast response within 1 business day.
            </p>

            <div
              className="mt-10 grid gap-3 sm:grid-cols-3"
              aria-label="Credibility signals"
            >
              {proofPoints.map((point) => (
                <article
                  key={point.label}
                  className="rounded-lg border border-cyan-200/22 bg-cyan-200/7 p-4"
                >
                  <p className="text-3xl font-black text-cyan-200">{point.value}</p>
                  <p className="mt-1 text-sm font-black uppercase tracking-[0.12em] text-white">
                    {point.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-blue-100/76">
                    {point.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="relative hidden min-h-[520px] lg:block" aria-hidden="true">
            <div className="absolute right-0 top-8 h-72 w-72 rounded-full border border-cyan-200/30" />
            <div className="absolute right-16 top-24 h-52 w-52 rounded-full border border-blue-200/20" />
            <div className="absolute right-10 top-44 w-[28rem] rounded-lg border border-white/14 bg-[#04111d] p-4 shadow-2xl shadow-black/50">
              <div className="grid h-44 grid-cols-4 grid-rows-3 gap-px rounded border border-cyan-200/18 bg-[#071522] p-3">
                {Array.from({ length: 12 }).map((_, index) => (
                  <div
                    className="rounded bg-cyan-200/10"
                    key={`hero-grid-${index}`}
                  />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="h-20 rounded bg-cyan-200/18" />
                <div className="h-20 rounded bg-blue-200/14" />
                <div className="h-20 rounded bg-white/10" />
              </div>
            </div>
            <div className="absolute bottom-12 left-8 w-72 rounded-lg border border-cyan-200/24 bg-[#04111d]/90 p-5 shadow-xl shadow-cyan-950/40">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                Project signal
              </p>
              <p className="mt-3 text-2xl font-black text-white">
                Creative assets that lead to action.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className="border-y border-white/10 bg-[#06111d] px-5 py-8 sm:px-8"
        aria-labelledby="proof-heading"
      >
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
              Proof before pitch
            </p>
            <h2 id="proof-heading" className="mt-2 text-3xl font-black text-white">
              Trust belongs directly under the hero.
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {projectSignals.map((signal) => (
              <div
                key={signal}
                className="rounded-lg border border-white/12 bg-white/6 p-4 text-sm font-bold text-blue-50"
              >
                {signal}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="bg-[#020711] px-5 py-16 sm:px-8 lg:py-24"
        id="services"
        aria-labelledby="services-heading"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
              Services
            </p>
            <h2 id="services-heading" className="mt-3 text-4xl font-black text-white sm:text-5xl">
              Outcomes first. Features second.
            </h2>
            <p className="mt-4 text-lg leading-8 text-blue-100/76">
              The offer stays the same, but each service now explains what a
              buyer can actually use it for.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {services.map((service) => (
              <article
                className="rounded-lg border border-white/12 bg-white/[0.045] p-6"
                id={service.title === "AI Avatars" ? "avatars" : undefined}
                key={service.title}
              >
                <h3 className="text-2xl font-black text-white">{service.title}</h3>
                <p className="mt-3 leading-7 text-blue-100/76">{service.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="bg-[#071522] px-5 py-16 sm:px-8 lg:py-24"
        id="projects"
        aria-labelledby="projects-heading"
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
              Projects
            </p>
            <h2 id="projects-heading" className="mt-3 text-4xl font-black text-white sm:text-5xl">
              Show the receipts before asking for trust.
            </h2>
            <p className="mt-4 text-lg leading-8 text-blue-100/76">
              Selected work should make the result obvious before visitors ask
              for a call. Use proof screenshots, outcomes and launch context to
              make each project easier to trust.
            </p>
            <ContactButton className="mt-7" />
          </div>

          <div className="grid gap-4">
            {[
              ["AI Avatar Launch", "Demo content, training clips and sales assets."],
              ["Website Build", "Sharper offer, clearer CTA and mobile-first contact path."],
              ["3D Campaign World", "Interactive environment for attention-heavy launches."],
            ].map(([title, text]) => (
              <article
                className="grid gap-4 rounded-lg border border-cyan-200/18 bg-[#04111d] p-4 sm:grid-cols-[10rem_1fr]"
                key={title}
              >
                <div className="min-h-32 rounded border border-cyan-200/14 bg-cyan-200/10" />
                <div>
                  <h3 className="text-xl font-black text-white">{title}</h3>
                  <p className="mt-2 leading-7 text-blue-100/76">{text}</p>
                  <p className="mt-4 text-sm font-bold text-cyan-200">
                    Proof focus: outcome, timeline and conversion lift.
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="bg-[#020711] px-5 py-16 sm:px-8 lg:py-24"
        aria-labelledby="process-heading"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
              Process
            </p>
            <h2 id="process-heading" className="mt-3 text-4xl font-black text-white sm:text-5xl">
              A simple path from idea to launch.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {processSteps.map((step, index) => (
              <article
                className="rounded-lg border border-white/12 bg-white/[0.045] p-6"
                key={step.title}
              >
                <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">
                  Step {index + 1}
                </p>
                <h3 className="mt-3 text-2xl font-black text-white">{step.title}</h3>
                <p className="mt-3 leading-7 text-blue-100/76">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="bg-[#071522] px-5 py-16 sm:px-8 lg:py-24"
        aria-labelledby="difference-heading"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
              Why Lockdown Studios
            </p>
            <h2 id="difference-heading" className="mt-3 text-4xl font-black text-white sm:text-5xl">
              Built for brands that need assets with a job to do.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {comparisons.map((column) => (
              <article
                className="rounded-lg border border-white/12 bg-white/[0.045] p-6"
                key={column.title}
              >
                <h3 className="text-2xl font-black text-white">{column.title}</h3>
                <ul className="mt-5 space-y-3">
                  {column.items.map((item) => (
                    <li className="flex gap-3 text-blue-100/80" key={item}>
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cyan-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="bg-[#020711] px-5 py-16 sm:px-8 lg:py-24"
        id="learning"
        aria-labelledby="learning-heading"
      >
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
              Learning
            </p>
            <h2 id="learning-heading" className="mt-3 text-4xl font-black text-white sm:text-5xl">
              Learn what to build before you build it.
            </h2>
          </div>
          <div className="rounded-lg border border-white/12 bg-white/[0.045] p-6">
            <p className="text-lg leading-8 text-blue-100/80">
              Use this area for guides, behind-the-scenes builds and practical
              AI education. It supports trust by showing how the studio thinks,
              not just what it sells.
            </p>
          </div>
        </div>
      </section>

      <section
        className="bg-[#071522] px-5 py-16 sm:px-8 lg:py-24"
        aria-labelledby="faq-heading"
      >
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
            Questions
          </p>
          <h2 id="faq-heading" className="mt-3 text-4xl font-black text-white sm:text-5xl">
            Reassurance before the final click.
          </h2>
          <div className="mt-8 divide-y divide-white/10 rounded-lg border border-white/12 bg-white/[0.045]">
            {faqs.map((faq) => (
              <details className="group p-5" key={faq.question}>
                <summary className="cursor-pointer list-none text-lg font-black text-white focus:outline-none focus:ring-4 focus:ring-cyan-200/45">
                  {faq.question}
                </summary>
                <p className="mt-3 leading-7 text-blue-100/76">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section
        className="bg-[#020711] px-5 py-16 sm:px-8 lg:py-24"
        id="contact"
        aria-labelledby="contact-heading"
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
              Contact
            </p>
            <h2 id="contact-heading" className="mt-3 text-4xl font-black text-white sm:text-5xl">
              Contact Us
            </h2>
            <p className="mt-4 text-lg leading-8 text-blue-100/76">
              Tell us what you want to launch. We will help choose the right
              starting point across AI avatars, websites, apps or 3D experiences.
            </p>
            <p className="mt-4 text-sm font-bold text-cyan-200">
              No pressure. 20-minute intro call. Fast response within 1 business day.
            </p>
          </div>

          <form
            aria-label="Contact Lockdown Studios"
            className="rounded-lg border border-cyan-200/20 bg-[#04111d] p-5 sm:p-6"
            action="mailto:hello@lockdownstudios.com"
            method="post"
            encType="text/plain"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold text-blue-100">Name</span>
                <input
                  className="mt-2 min-h-12 w-full rounded-lg border border-white/14 bg-white/8 px-4 text-white outline-none focus:border-cyan-200 focus:ring-4 focus:ring-cyan-200/20"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-blue-100">Email</span>
                <input
                  className="mt-2 min-h-12 w-full rounded-lg border border-white/14 bg-white/8 px-4 text-white outline-none focus:border-cyan-200 focus:ring-4 focus:ring-cyan-200/20"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-bold text-blue-100">What do you want to build?</span>
              <textarea
                className="mt-2 min-h-32 w-full rounded-lg border border-white/14 bg-white/8 px-4 py-3 text-white outline-none focus:border-cyan-200 focus:ring-4 focus:ring-cyan-200/20"
                name="message"
                required
              />
            </label>
            <button
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-cyan-200 bg-cyan-300 px-6 font-black text-slate-950 transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-200/45 sm:w-auto"
              type="submit"
            >
              Contact Us
            </button>
          </form>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#020711] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-blue-100/70 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-black text-white">Lockdown Studios</p>
          <p>AI avatars, websites, apps and 3D experiences.</p>
          <a
            className="font-bold text-cyan-200 focus:outline-none focus:ring-4 focus:ring-cyan-200/45"
            href="#contact"
          >
            Contact Us
          </a>
        </div>
      </footer>
    </main>
  );
}
