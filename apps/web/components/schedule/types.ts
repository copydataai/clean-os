"use client";

import type { Id } from "@clean-os/convex/data-model";

export type DispatchPriority = "low" | "normal" | "high" | "urgent";
export type DispatchPriorityFilter = "all" | DispatchPriority;
export type DispatchAssignmentFilter = "all" | "assigned" | "unassigned";

export type DispatchFiltersState = {
  status?: string;
  cleanerId?: Id<"cleaners">;
  assignmentState: DispatchAssignmentFilter;
  priority: DispatchPriorityFilter;
};

export type DispatchCleanerSummary = {
  _id: Id<"cleaners">;
  name: string;
  assignmentCount: number;
};

export type DispatchLocation = {
  street?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  geocodeStatus: string;
  geocodedAt?: number;
  provider?: string;
  source: "snapshot" | "customer_or_quote" | "none";
  addressLine: string;
};

export type DispatchBooking = {
  _id: Id<"bookings">;
  status: string;
  email: string;
  customerName?: string | null;
  serviceType?: string | null;
  amount?: number | null;
  serviceDate?: string | null;
  serviceWindowStart?: string | null;
  serviceWindowEnd?: string | null;
  estimatedDurationMinutes?: number | null;
  dispatchPriority: DispatchPriority;
  dispatchOrder?: number | null;
  createdAt: number;
  location: DispatchLocation;
  assignments: {
    total: number;
    assigned: number;
    cleaners: Array<{
      cleanerId: Id<"cleaners">;
      role: string;
      status: string;
      name: string;
    }>;
  };
  badges: string[];
};

export type DispatchTotals = {
  total: number;
  assigned: number;
  unassigned: number;
  missingLocation: number;
};

export type DispatchDayPayload = {
  date: string;
  totals: DispatchTotals;
  bookings: DispatchBooking[];
  cleaners: DispatchCleanerSummary[];
};
