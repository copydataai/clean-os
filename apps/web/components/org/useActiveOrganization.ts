"use client";

import { useContext } from "react";
import { ActiveOrganizationContext } from "./ActiveOrganizationProvider";

export function useActiveOrganization() {
  const context = useContext(ActiveOrganizationContext);
  if (!context) {
    throw new Error("useActiveOrganization must be used within ActiveOrganizationProvider.");
  }
  return context;
}
