import { Text, Button, Section, Row, Column } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./components/layout";

type ReminderStage = "r1_24h" | "r2_72h" | "r3_pre_expiry";

interface QuoteReminderEmailProps {
  firstName?: string;
  quoteNumber: number;
  totalCents: number;
  currency?: string;
  validUntilTimestamp: number;
  confirmUrl: string;
  downloadUrl?: string;
  serviceLabel?: string;
  reminderStage: ReminderStage;
}

function formatCurrency(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function reminderCopy(stage: ReminderStage): string {
  if (stage === "r3_pre_expiry") {
    return "Final reminder: your quote expires soon.";
  }
  if (stage === "r2_72h") {
    return "Just checking in — your quote is still waiting for confirmation.";
  }
  return "Your quote is ready whenever you're ready to confirm.";
}

export default function QuoteReminderEmail({
  firstName = "there",
  quoteNumber,
  totalCents,
  currency = "usd",
  validUntilTimestamp,
  confirmUrl,
  downloadUrl,
  serviceLabel,
  reminderStage,
}: QuoteReminderEmailProps) {
  return (
    <EmailLayout preview={`Reminder for Kathy Clean Quote #${quoteNumber}`}>
      <Text style={heading}>Reminder: Your Kathy Clean Quote</Text>
      <Text style={paragraph}>Hi {firstName}, {reminderCopy(reminderStage)}</Text>

      <Section style={detailsBox}>
        <Row style={detailRow}>
          <Column style={detailLabel}>Quote</Column>
          <Column style={detailValue}>#{quoteNumber}</Column>
        </Row>
        {serviceLabel ? (
          <Row style={detailRow}>
            <Column style={detailLabel}>Service</Column>
            <Column style={detailValue}>{serviceLabel}</Column>
          </Row>
        ) : null}
        <Row style={detailRow}>
          <Column style={detailLabel}>Total</Column>
          <Column style={detailValue}>{formatCurrency(totalCents, currency)}</Column>
        </Row>
        <Row style={detailRow}>
          <Column style={detailLabel}>Valid until</Column>
          <Column style={detailValue}>{formatDate(validUntilTimestamp)}</Column>
        </Row>
      </Section>

      <Section style={ctaSection}>
        <Button href={confirmUrl} style={ctaButton}>
          Confirm Your Booking
        </Button>
      </Section>

      {downloadUrl ? (
        <Text style={paragraph}>
          Need to review it again?{" "}
          <a href={downloadUrl} style={linkStyle}>
            Open your quote PDF
          </a>
        </Text>
      ) : null}
    </EmailLayout>
  );
}

const heading = {
  fontSize: "20px",
  fontWeight: "600" as const,
  color: "#111827",
  margin: "0 0 16px",
};

const paragraph = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#374151",
  margin: "0 0 16px",
};

const detailsBox = {
  backgroundColor: "#f9fafb",
  borderRadius: "6px",
  padding: "16px",
  margin: "16px 0",
};

const detailRow = {
  marginBottom: "8px",
};

const detailLabel = {
  fontSize: "13px",
  color: "#6b7280",
  width: "110px",
};

const detailValue = {
  fontSize: "13px",
  color: "#111827",
  fontWeight: "500" as const,
};

const ctaSection = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const ctaButton = {
  backgroundColor: "#111827",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "600" as const,
  padding: "12px 32px",
  borderRadius: "6px",
  textDecoration: "none",
};

const linkStyle = {
  color: "#111827",
};
