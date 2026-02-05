"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-12 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-20 top-36 h-72 w-72 rounded-full bg-accent/45 blur-3xl" />
      </div>

      <main className="page-width relative z-10 px-6 pb-10 pt-8 sm:pt-10 lg:pt-14">
        <header className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
              CO
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Clean OS</p>
              <p className="text-xs text-muted-foreground">Operations command center</p>
            </div>
          </div>
          <Authenticated>
            <UserButton afterSignOutUrl="/" />
          </Authenticated>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-7">
            <p className="inline-flex items-center rounded-full border border-border bg-card/85 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Built for residential cleaning teams
            </p>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl">
                Run scheduling, requests, cleaners, and revenue from one place.
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Clean OS gives you a single workflow from intake to assigned jobs and payment follow-up, so your team can move faster with fewer gaps.
              </p>
            </div>

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

              <Link
                href="/book"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Test Booking Flow
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="surface-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Request to booking</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">2 min</p>
              </div>
              <div className="surface-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Fewer no-shows</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">-31%</p>
              </div>
              <div className="surface-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Team utilization</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">92%</p>
              </div>
            </div>
          </div>

          <aside className="surface-card p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Today at a glance
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-foreground">Operations Snapshot</h2>

            <div className="mt-6 space-y-3">
              {["4 jobs awaiting assignment", "7 returning customers this week", "2 quote requests need follow-up"].map(
                (item) => (
                  <div key={item} className="surface-soft flex items-start gap-3 p-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <p className="text-sm text-foreground">{item}</p>
                  </div>
                )
              )}
            </div>

            <div className="mt-6 rounded-xl border border-border bg-muted/45 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Support</p>
              <a
                href="mailto:support@cleanos.com"
                className="mt-1 block text-sm font-medium text-foreground hover:text-primary"
              >
                support@cleanos.com
              </a>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
