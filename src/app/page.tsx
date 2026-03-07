export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-[family-name:var(--font-geist-sans)]">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-emerald-500">
              <rect width="28" height="28" rx="6" fill="currentColor" fillOpacity="0.15" />
              <path
                d="M8 14l4 4 8-8"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            CodeSentri
          </a>
          <div className="hidden items-center gap-8 text-sm text-gray-400 sm:flex">
            <a href="#how-it-works" className="transition-colors hover:text-gray-100">How It Works</a>
            <a href="#features" className="transition-colors hover:text-gray-100">Features</a>
            <a href="#pricing" className="transition-colors hover:text-gray-100">Pricing</a>
            <a
              href="#pricing"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            >
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-44 sm:pb-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-emerald-500/5 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900 px-4 py-1.5 text-sm text-gray-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Now reviewing PRs in real time
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl sm:leading-tight">
            AI Code Reviews That
            <br />
            <span className="text-emerald-500">Actually Catch Bugs</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400 sm:text-xl sm:leading-relaxed">
            CodeSentri reviews every pull request with the precision of a senior engineer.
            Catch security vulnerabilities, logic errors, and performance issues before they
            hit production.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#pricing"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-emerald-600 px-8 text-base font-semibold text-white transition-colors hover:bg-emerald-500 sm:w-auto"
            >
              Install GitHub App
            </a>
            <a
              href="#how-it-works"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-gray-700 px-8 text-base font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-white sm:w-auto"
            >
              View Demo
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-t border-gray-800/50 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-500">How It Works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Up and running in minutes</h2>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Install",
                description: "Install the GitHub App in 30 seconds. One click, no config files, no YAML.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                ),
              },
              {
                step: "02",
                title: "Open a PR",
                description: "Push code and open a pull request as usual. Nothing changes about your workflow.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="18" r="3" />
                    <circle cx="6" cy="6" r="3" />
                    <path d="M6 9v6a3 3 0 0 0 3 3h3" />
                  </svg>
                ),
              },
              {
                step: "03",
                title: "Get Reviewed",
                description: "CodeSentri posts detailed inline review comments within minutes. Fix and merge with confidence.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="group relative rounded-xl border border-gray-800 bg-gray-900 p-8 transition-colors hover:border-gray-700">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  {item.icon}
                </div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-500">Step {item.step}</p>
                <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-gray-800/50 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-500">Features</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Everything you need, nothing you don&apos;t</h2>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                emoji: "\u{1F534}",
                title: "Bug Detection",
                description: "Catches logic errors, race conditions, null pointer risks, and other bugs that slip past human review.",
              },
              {
                emoji: "\u{1F512}",
                title: "Security Scanning",
                description: "OWASP top 10, hardcoded secrets, injection vulnerabilities. Security issues caught before they ship.",
              },
              {
                emoji: "\u26A1",
                title: "Performance Analysis",
                description: "N+1 queries, unnecessary allocations, blocking operations. Keep your app fast by default.",
              },
              {
                emoji: "\u{1F4DD}",
                title: "Inline Comments",
                description: "Review comments posted directly on the PR, line by line. Just like a human reviewer.",
              },
              {
                emoji: "\u{1F3AF}",
                title: "Low Noise",
                description: "Only flags real issues, not style preferences. No false positive spam cluttering your PRs.",
              },
              {
                emoji: "\u{1F50C}",
                title: "Zero Config",
                description: "Install and forget. Works with any language, any framework. No config files to maintain.",
              },
            ].map((feature) => (
              <div key={feature.title} className="rounded-xl border border-gray-800 bg-gray-900 p-6 transition-colors hover:border-gray-700">
                <div className="mb-3 text-2xl">{feature.emoji}</div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example Review */}
      <section className="border-t border-gray-800/50 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-500">See It In Action</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Real issues, caught automatically</h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-400">
              Here&apos;s what a CodeSentri review comment looks like on your pull request.
            </p>
          </div>
          <div className="mt-12 overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
            {/* Comment header */}
            <div className="flex items-center gap-3 border-b border-gray-800 px-6 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-500">
                CS
              </div>
              <div>
                <span className="font-semibold">CodeSentri</span>
                <span className="ml-2 rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-500">bot</span>
              </div>
              <span className="ml-auto text-xs text-gray-500">just now</span>
            </div>
            {/* Comment body */}
            <div className="px-6 py-5">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-400">
                <span>{"\u{1F534}"}</span> CRITICAL
              </div>
              <p className="mb-4 text-sm leading-relaxed text-gray-300">
                <strong>SQL injection vulnerability</strong> &mdash; user input is interpolated directly into the query string without parameterization.
                An attacker could craft a malicious <code className="rounded bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-300">userId</code> value to execute arbitrary SQL.
              </p>
              <p className="mb-3 text-xs font-mono text-gray-500">src/api/users.ts:42</p>
              <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-950 font-mono text-sm">
                <div className="flex items-stretch border-b border-gray-800">
                  <span className="flex w-12 shrink-0 items-center justify-center border-r border-gray-800 text-xs text-gray-600">42</span>
                  <div className="flex-1 bg-red-500/5 px-4 py-2 text-red-400">
                    <span className="mr-2 text-red-500">-</span>
                    <span className="text-gray-500">const </span>result <span className="text-gray-500">= await </span>db.query(<span className="text-amber-400">{"`SELECT * FROM users WHERE id = '${userId}'`"}</span>)
                  </div>
                </div>
                <div className="flex items-stretch">
                  <span className="flex w-12 shrink-0 items-center justify-center border-r border-gray-800 text-xs text-gray-600">42</span>
                  <div className="flex-1 bg-emerald-500/5 px-4 py-2 text-emerald-400">
                    <span className="mr-2 text-emerald-500">+</span>
                    <span className="text-gray-500">const </span>result <span className="text-gray-500">= await </span>db.query(<span className="text-amber-400">&apos;SELECT * FROM users WHERE id = $1&apos;</span>, [userId])
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-gray-800/50 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-500">Pricing</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Start free, scale as you grow</h2>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {/* Free */}
            <div className="flex flex-col rounded-xl border border-gray-800 bg-gray-900 p-8">
              <p className="text-sm font-semibold uppercase tracking-widest text-gray-400">Free</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-sm text-gray-500">/mo</span>
              </div>
              <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  5 repositories
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  50 reviews / month
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Public repos only
                </li>
              </ul>
              <a
                href="#"
                className="mt-8 inline-flex h-11 items-center justify-center rounded-lg border border-gray-700 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
              >
                Get Started
              </a>
            </div>

            {/* Pro */}
            <div className="relative flex flex-col rounded-xl border-2 border-emerald-500 bg-gray-900 p-8">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-semibold text-white">
                Recommended
              </div>
              <p className="text-sm font-semibold uppercase tracking-widest text-emerald-500">Pro</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$19</span>
                <span className="text-sm text-gray-500">/seat/mo</span>
              </div>
              <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  25 repositories
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  500 reviews / month
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Private repos
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Priority reviews
                </li>
              </ul>
              <a
                href="#"
                className="mt-8 inline-flex h-11 items-center justify-center rounded-lg bg-emerald-600 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
              >
                Start Free Trial
              </a>
            </div>

            {/* Team */}
            <div className="flex flex-col rounded-xl border border-gray-800 bg-gray-900 p-8">
              <p className="text-sm font-semibold uppercase tracking-widest text-gray-400">Team</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$49</span>
                <span className="text-sm text-gray-500">/seat/mo</span>
              </div>
              <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Unlimited repositories
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Unlimited reviews
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Custom rules
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Priority support &amp; SSO
                </li>
              </ul>
              <a
                href="#"
                className="mt-8 inline-flex h-11 items-center justify-center rounded-lg border border-gray-700 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
            <div>
              <a href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <svg width="24" height="24" viewBox="0 0 28 28" fill="none" className="text-emerald-500">
                  <rect width="28" height="28" rx="6" fill="currentColor" fillOpacity="0.15" />
                  <path
                    d="M8 14l4 4 8-8"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                CodeSentri
              </a>
              <p className="mt-1 text-sm text-gray-500">Built by CrashBytes</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
              <a href="#" className="transition-colors hover:text-gray-100">GitHub</a>
              <a href="#" className="transition-colors hover:text-gray-100">Docs</a>
              <a href="#" className="transition-colors hover:text-gray-100">Privacy</a>
              <a href="#" className="transition-colors hover:text-gray-100">Terms</a>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-800/50 pt-8 text-center text-sm text-gray-600">
            &copy; 2026 CrashBytes. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
