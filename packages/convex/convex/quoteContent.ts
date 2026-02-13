type InclusionSnapshot = {
  title: string;
  intro: string;
  includedItems: string[];
  whyItWorksItems: string[];
  outro: string;
};

type TermsSnapshot = {
  quoteValidity: string;
  serviceLimitations: string;
  access: string;
  cancellations: string;
  nonSolicitation: string;
  acceptance: string;
};

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  weeklycleaning:
    "Regular cleaning service on a weekly basis, maintaining cleanliness with dusting, vacuuming, and mopping of all rooms.",
  biweeklycleaning:
    "Bi-weekly routine cleaning to maintain your home's cleanliness, including standard cleaning of bathrooms, kitchen, bedrooms, and living areas. The service also covers monthly rotating tasks such as dusting ceiling fans, blinds, baseboards, and the exterior of kitchen cabinets. We include up to three bed linen changes and trash removal.",
  monthlycleaning:
    "Routine cleaning service every month focusing on maintaining cleanliness with a deeper clean than routine visits.",
  moveoutcleaning:
    "Move-Out Clean designed for houses and apartments, we know what property managers look for. We clean every detail to help you avoid fees and get your full deposit back.",
  moveincleaning:
    "Move-In Clean to make your new home feel truly yours. We deep clean and disinfect every space so you can unpack with peace of mind.",
  deepcleaning:
    "Comprehensive cleaning service including dusting, vacuuming, mopping, bathroom and kitchen deep clean, focusing on removing built-up grime and dirt.",
};

const DEFAULT_INCLUSIONS: InclusionSnapshot = {
  title: "Welcome to worry-free living.",
  intro:
    "With our bi-weekly service, you're not just getting a clean home, you're gaining peace of mind and more time for what matters.",
  includedItems: [
    "Full cleaning of your bathrooms, kitchen, bedrooms, and living areas",
    "Dusting all main surfaces and rotating monthly: baseboards, ceiling fans, blinds, and kitchen cabinet exteriors",
    "Bed-making with fresh linens (up to 3 beds)",
    "Trash emptied and bins wiped",
    "Floors vacuumed and mopped",
    "Your same cleaning technician every time, someone who knows your home and preferences",
  ],
  whyItWorksItems: [
    "Your home stays clean without you having to think about it",
    "No guessing who's coming, your cleaner becomes part of your routine",
    "You don't need to deep clean again, this keeps things fresh and under control",
    "We handle the small details so you can focus on your life",
  ],
  outro:
    "Tell us your preferences or any areas that need extra attention, and we'll take care of it.",
};

const DEFAULT_TERMS: TermsSnapshot = {
  quoteValidity:
    "This quote is valid for 30 days. Final pricing may be adjusted if the condition of the home requires significantly more time or work beyond the scope of work. Any adjustment will be discussed and approved by you before proceeding.",
  serviceLimitations:
    "We do not move furniture, clean walls, do laundry, wash dishes, or handle biohazard materials.",
  access:
    "If access instructions are unclear or we are unable to enter the property, a trip fee may apply.",
  cancellations:
    "Cancellations or rescheduling requests must be made at least 48 hours before the scheduled service. Cancellations made with less than 48 hours' notice will be charged 50% of the service value.",
  nonSolicitation:
    "You agree not to directly or indirectly solicit any JoluAI employee to provide cleaning services outside of their employment with JoluAI during or after their engagement with us. If solicitation occurs, this agreement will terminate immediately, and you agree to pay $10,000 as liquidated damages. This amount represents a reasonable estimate of the harm caused and is not a penalty.",
  acceptance: "By accepting this quote, you agree to these terms of service.",
};

function normalize(value?: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .trim();
}

export function getServiceLabel(serviceType?: string | null): string {
  if (!serviceType) {
    return "Cleaning Service";
  }
  return serviceType;
}

export function getServiceDescription(serviceType?: string | null): string {
  const normalized = normalize(serviceType);
  if (SERVICE_DESCRIPTIONS[normalized]) {
    return SERVICE_DESCRIPTIONS[normalized];
  }
  return (
    "Professional cleaning service tailored to your home and preferences. Final scope is confirmed before service."
  );
}

export function getInclusionsSnapshot(): InclusionSnapshot {
  return { ...DEFAULT_INCLUSIONS };
}

export function getTermsSnapshot(): TermsSnapshot {
  return { ...DEFAULT_TERMS };
}

