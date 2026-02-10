import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
import QuoteProfileSettingsForm from "@/components/settings/QuoteProfileSettingsForm";
import { Button } from "@/components/ui/button";

export default function SettingsProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Profile"
        subtitle="Manage business identity and default quote settings."
      >
        <div className="flex items-center gap-2">
          <Link href="/dashboard/settings">
            <Button variant="outline" size="sm">
              Back to Settings
            </Button>
          </Link>
          <Link href="/dashboard/quotes/pricing">
            <Button variant="outline" size="sm">
              Pricing Rules
            </Button>
          </Link>
        </div>
      </PageHeader>

      <QuoteProfileSettingsForm />
    </div>
  );
}
