import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";

const settingsSections = [
  {
    title: "Business Profile",
    description: "Company identity, contact details, and quote defaults.",
    href: "/dashboard/settings/profile",
    cta: "Open profile",
  },
  {
    title: "Quote Pricing Rules",
    description: "Service, frequency, and square-foot pricing logic.",
    href: "/dashboard/quotes/pricing",
    cta: "Open pricing",
  },
  {
    title: "Payments",
    description: "Organization-level Stripe credentials and webhook health.",
    href: "/dashboard/payments",
    cta: "Open payments",
  },
];

const recommendedNext = [
  "Organization timezone, locale, and date/number formatting defaults.",
  "Notification preferences for quote/bookings events (email and in-app).",
  "Role-based access and permission controls for admins vs operators.",
  "Audit log for critical settings changes with actor and timestamp.",
  "Data export and retention controls for compliance and governance.",
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Configure business-wide defaults, controls, and integrations."
      >
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            Back to Overview
          </Button>
        </Link>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        {settingsSections.map((section) => (
          <div key={section.href} className="surface-card flex flex-col gap-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
            </div>
            <Link href={section.href} className="mt-auto">
              <Button variant="outline" size="sm">
                {section.cta}
              </Button>
            </Link>
          </div>
        ))}
      </div>

      <div className="surface-card p-6">
        <h2 className="text-base font-semibold text-foreground">Recommended Next Settings</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {recommendedNext.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
