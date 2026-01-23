"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] p-8 font-sans">
      <main className="flex w-full max-w-md flex-col gap-16">
        {/* Minimal Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-full bg-[#1A1A1A]" />
            <span className="text-sm font-medium tracking-tight text-[#1A1A1A]">Clean OS</span>
          </div>
          <Authenticated>
            <UserButton afterSignOutUrl="/" />
          </Authenticated>
        </header>

        {/* Elegant Hero */}
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl font-normal leading-[1.1] tracking-tight text-[#1A1A1A]">
            Run your cleaning<br />
            <span className="font-medium">business better.</span>
          </h1>
          <p className="text-lg leading-relaxed text-[#666666]">
            The operating system built for home service companies. Manage jobs, schedule teams, and grow your cleaning business.
          </p>
        </div>

        {/* Clean CTA */}
        <div className="flex flex-col items-start gap-3">
          <Unauthenticated>
            <SignInButton mode="modal">
              <button className="h-12 rounded-full bg-[#1A1A1A] px-8 text-sm font-medium text-[#FAFAFA] transition-all hover:bg-[#333333] hover:shadow-lg">
                Sign In
              </button>
            </SignInButton>
          </Unauthenticated>

          <Authenticated>
            <Link 
              href="/dashboard"
              className="h-12 flex items-center rounded-full bg-[#1A1A1A] px-8 text-sm font-medium text-[#FAFAFA] transition-all hover:bg-[#333333] hover:shadow-lg"
            >
              Open Dashboard
            </Link>
          </Authenticated>

          <p className="text-sm text-[#888888]">
            14-day free trial • No credit card required
          </p>
        </div>

        {/* Subtle Footer */}
        <footer className="mt-8 flex gap-8 text-xs text-[#999999]">
          <span>v1.0.0</span>
          <a href="#" className="hover:text-[#1A1A1A] transition-colors">Privacy</a>
          <a href="#" className="hover:text-[#1A1A1A] transition-colors">Terms</a>
        </footer>
      </main>
    </div>
  );
}
