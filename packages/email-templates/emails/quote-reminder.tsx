import {
  Text,
  Button,
  Section,
  Row,
  Column,
  Hr,
} from "@react-email/components";
import * as React from "react";
import EmailLayout from "./components/layout";

type ReminderStage = "r1_24h" | "r2_72h" | "r3_pre_expiry" | "manual";

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
  if (stage === "manual") {
    return "Here is your quote again in case you need it before confirming.";
  }
  if (stage === "r3_pre_expiry") {
    return "Final reminder: your quote expires soon.";
  }
  if (stage === "r2_72h") {
    return "Just checking in — your quote is still waiting for confirmation.";
  }
  return "Your quote is ready whenever you're ready to confirm.";
}

function isUrgent(stage: ReminderStage): boolean {
  return stage === "r3_pre_expiry";
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
  const urgent = isUrgent(reminderStage);

  return (
    <EmailLayout
      preview={`Reminder for JoluAI Quote #${quoteNumber}`}
    >
      {/* ── Urgency pill (pre-expiry only) ── */}
      {urgent && (
        <Section style={pillSection}>
          <Text style={urgentPill}>EXPIRING SOON</Text>
        </Section>
      )}

      <Text style={heading}>
        {urgent ? "Your Quote Expires Soon" : "Reminder: Your JoluAI Quote"}
      </Text>
      <Text style={paragraph}>
        Hi {firstName}, {reminderCopy(reminderStage)}
      </Text>

      {/* ── Quote summary ── */}
      <Section style={urgent ? detailsBoxUrgent : detailsBox}>
        <Row style={detailRow}>
          <Column style={detailLabel}>Quote</Column>
          <Column style={detailValue}>#{quoteNumber}</Column>
        </Row>
        <Hr style={divider} />
        {serviceLabel && (
          <>
            <Row style={detailRow}>
              <Column style={detailLabel}>Service</Column>
              <Column style={detailValue}>{serviceLabel}</Column>
            </Row>
            <Hr style={divider} />
          </>
        )}
        <Row style={detailRow}>
          <Column style={detailLabel}>Total</Column>
          <Column style={detailValue}>
            {formatCurrency(totalCents, currency)}
          </Column>
        </Row>
        <Hr style={divider} />
        <Row style={detailRow}>
          <Column style={detailLabel}>Valid until</Column>
          <Column style={urgent ? detailValueUrgent : detailValue}>
            {formatDate(validUntilTimestamp)}
          </Column>
        </Row>
      </Section>

      <Section style={ctaSection}>
        <Button href={confirmUrl} style={ctaButton}>
          Confirm Your Booking &rarr;
        </Button>
      </Section>

      {downloadUrl && (
        <Text style={downloadText}>
          Need to review it again?{" "}
          <a href={downloadUrl} style={linkStyle}>
            Open your quote PDF
          </a>
        </Text>
      )}
    </EmailLayout>
  );
}

const fontHeading =
  '"Fraunces", Georgia, "Times New Roman", serif';

const pillSection: React.CSSProperties = {
  textAlign: "center",
  margin: "0 0 20px",
};

const urgentPill: React.CSSProperties = {
  display: "inline-block",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#A8461C",
  backgroundColor: "#FEF3ED",
  border: "1px solid #F5C9B0",
  borderRadius: "20px",
  padding: "6px 18px",
  margin: "0 auto",
};

const heading: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 600,
  color: "#1A2F23",
  margin: "0 0 12px",
  letterSpacing: "-0.02em",
  fontFamily: fontHeading,
};

const paragraph: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#3D5347",
  margin: "0 0 22px",
};

/* ── Details ── */
const detailsBox: React.CSSProperties = {
  backgroundColor: "#FAF7F2",
  borderRadius: "10px",
  padding: "16px 20px 8px",
  margin: "0 0 24px",
  border: "1px solid #EDE8DF",
};

const detailsBoxUrgent: React.CSSProperties = {
  ...detailsBox,
  borderLeft: "3px solid #C9581F",
};

const detailRow: React.CSSProperties = {
  marginBottom: "0",
};

const detailLabel: React.CSSProperties = {
  fontSize: "13px",
  color: "#7A8E80",
  width: "110px",
  paddingTop: "8px",
  paddingBottom: "8px",
};

const detailValue: React.CSSProperties = {
  fontSize: "13px",
  color: "#1A2F23",
  fontWeight: 600,
  paddingTop: "8px",
  paddingBottom: "8px",
};

const detailValueUrgent: React.CSSProperties = {
  ...detailValue,
  color: "#A8461C",
};

const divider: React.CSSProperties = {
  borderColor: "#E8E2D8",
  borderWidth: "1px 0 0",
  borderStyle: "solid",
  margin: "0",
};

/* ── CTA ── */
const ctaSection: React.CSSProperties = {
  textAlign: "center",
  margin: "24px 0",
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#1A3C34",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  padding: "14px 44px",
  borderRadius: "8px",
  textDecoration: "none",
  letterSpacing: "0.01em",
};

const downloadText: React.CSSProperties = {
  fontSize: "13px",
  color: "#5E7A6B",
  textAlign: "center",
  margin: "0",
};

const linkStyle: React.CSSProperties = {
  color: "#1A3C34",
  fontWeight: 600,
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};
