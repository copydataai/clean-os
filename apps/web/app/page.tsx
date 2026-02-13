"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

const features = [
  {
    stat: "2 min",
    label: "Request to booking",
    desc: "AI intake pipeline",
  },
  {
    stat: "-31%",
    label: "Fewer no-shows",
    desc: "Smart reminders",
  },
  {
    stat: "92%",
    label: "Team utilization",
    desc: "Route optimization",
  },
];

const signals = [
  "4 jobs awaiting assignment",
  "7 returning customers this week",
  "2 quote requests need follow-up",
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* --- ambient background --- */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-8 h-[420px] w-[420px] rounded-full bg-primary/15 blur-[100px]" />
        <div className="absolute -right-24 top-28 h-[360px] w-[360px] rounded-full bg-accent/30 blur-[90px]" />
        <div className="absolute bottom-0 left-1/2 h-[280px] w-[600px] -translate-x-1/2 rounded-full bg-primary/8 blur-[120px]" />
        {/* subtle dot grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <main className="page-width relative z-10 px-6 pb-14 pt-8 sm:pt-10 lg:pt-14">
        {/* ——— header ——— */}
        <header className="mb-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-[13px] font-bold tracking-tight text-primary-foreground">
              J
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-foreground">
                JoluAI
              </p>
              <p className="text-[11px] text-muted-foreground">
                AI-powered operations
              </p>
            </div>
          </div>
          <Authenticated>
            <UserButton afterSignOutUrl="/" />
          </Authenticated>
        </header>

        {/* ——— hero ——— */}
        <section className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-8">
          <div className="space-y-8">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Built for residential cleaning teams
            </p>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-[2.5rem] font-semibold leading-[1.12] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
                One place for scheduling, requests, cleaners&nbsp;&&nbsp;revenue.
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                JoluAI gives your team a single workflow from intake to assigned
                jobs and payment follow-up — so you move faster with fewer gaps.
              </p>
            </div>

            {/* cta */}
            <div className="flex flex-wrap items-center gap-3">
              <Unauthenticated>
                <SignInButton>
                  <button className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    Sign In to Dashboard
                  </button>
                </SignInButton>
              </Unauthenticated>

              <Authenticated>
                <Link
                  href="/dashboard"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Open Dashboard
                </Link>
              </Authenticated>
            </div>

            {/* stats row */}
            <div className="grid gap-3 sm:grid-cols-3">
              {features.map((f) => (
                <div key={f.label} className="surface-card p-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {f.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {f.stat}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ——— aside ——— */}
          <aside className="surface-card p-6 sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Today at a glance
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              Operations Snapshot
            </h2>

            <div className="mt-6 space-y-3">
              {signals.map((item) => (
                <div
                  key={item}
                  className="surface-soft flex items-start gap-3 p-3"
                >
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  <p className="text-sm text-foreground">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-border bg-muted/45 p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Support
              </p>
              <a
                href="mailto:support@joluai.com"
                className="mt-1 block text-sm font-medium text-foreground hover:text-primary"
              >
                support@joluai.com
              </a>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
