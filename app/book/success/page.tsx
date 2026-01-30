"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function BookSuccessPage() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking_id");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] p-8">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-medium text-[#1A1A1A]">Card Saved Successfully!</h1>
        
        <p className="mt-4 text-lg text-[#666666]">
          Thank you for booking with us. Your payment method has been securely saved.
        </p>

        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="font-medium text-[#1A1A1A]">What happens next?</h2>
          <ul className="mt-4 space-y-3 text-left text-sm text-[#666666]">
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1A1A1A] text-xs text-white">1</span>
              <span>Our team will confirm your cleaning appointment</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1A1A1A] text-xs text-white">2</span>
              <span>We&apos;ll send you a reminder before your scheduled cleaning</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1A1A1A] text-xs text-white">3</span>
              <span>After the job is completed, we&apos;ll charge your saved card automatically</span>
            </li>
          </ul>
        </div>

        {bookingId && (
          <p className="mt-4 text-xs text-[#999999]">
            Booking reference: {bookingId}
          </p>
        )}

        <Link
          href="/"
          className="mt-8 inline-block rounded-full bg-[#1A1A1A] px-8 py-3 text-sm font-medium text-white hover:bg-[#333333]"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
