import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
import QuoteProfileSettingsForm from "@/components/settings/QuoteProfileSettingsForm";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function SettingsProfilePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Business Profile"
        subtitle="Company identity, address, and default quote configuration."
      >
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard/settings">
            <Button variant="outline" size="sm">
              Back to Settings
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-5" />
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
