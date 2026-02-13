import {
  Text,
  Button,
  Section,
  Row,
  Column,
  Hr,
} from "@react-email/components";
import * as React from "react";
import EmailLayout, { type EmailBrandConfig } from "./components/layout";

interface QuoteReadyEmailProps {
  firstName?: string;
  quoteNumber: number;
  totalCents: number;
  currency?: string;
  validUntilTimestamp: number;
  confirmUrl: string;
  downloadUrl?: string;
  serviceLabel?: string;
  brand?: EmailBrandConfig;
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

export default function QuoteReadyEmail({
  firstName = "there",
  quoteNumber,
  totalCents,
  currency = "usd",
  validUntilTimestamp,
  confirmUrl,
  downloadUrl,
  serviceLabel,
  brand,
}: QuoteReadyEmailProps) {
  const brandName = brand?.displayName || "JoluAI";
  const bc = brand?.brandColor || "#1A3C34";

  return (
    <EmailLayout preview={`Your ${brandName} Quote #${quoteNumber}`} brand={brand}>
      <Text style={{ ...heading, color: bc }}>Your {brandName} Quote</Text>
      <Text style={paragraph}>
        Hi {firstName}, thank you for reaching out to {brandName}. Your quote is
        ready.
      </Text>

      {/* ── Price highlight ── */}
      <Section style={{ ...priceCard, backgroundColor: bc }}>
        <Text style={priceLabel}>Quoted total</Text>
        <Text style={priceAmount}>
          {formatCurrency(totalCents, currency)}
        </Text>
        {serviceLabel && <Text style={priceService}>{serviceLabel}</Text>}
      </Section>

      {/* ── Details ── */}
      <Section style={detailsBox}>
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
          <Column style={detailLabel}>Valid until</Column>
          <Column style={detailValue}>
            {formatDate(validUntilTimestamp)}
          </Column>
        </Row>
      </Section>

      <Text style={paragraph}>
        To continue, please confirm your booking details using the button below.
      </Text>

      <Section style={ctaSection}>
        <Button href={confirmUrl} style={{ ...ctaButton, backgroundColor: bc }}>
          Confirm Your Booking &rarr;
        </Button>
      </Section>

      {downloadUrl && (
        <Text style={downloadText}>
          You can also{" "}
          <a href={downloadUrl} style={{ ...linkStyle, color: bc }}>
            download your quote as PDF
          </a>
          .
        </Text>
      )}

      <Text style={smallText}>
        {(() => {
          const validDays = Math.max(0, Math.ceil((validUntilTimestamp - Date.now()) / (1000 * 60 * 60 * 24)));
          return `This quote is valid for ${validDays} day${validDays !== 1 ? "s" : ""}.`;
        })()}{" "}
        If you have any questions, reply to this email.
      </Text>
    </EmailLayout>
  );
}

const fontHeading =
  '"Fraunces", Georgia, "Times New Roman", serif';

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

/* ── Price card ── */
const priceCard: React.CSSProperties = {
  backgroundColor: "#1A3C34",
  borderRadius: "10px",
  padding: "24px 20px",
  margin: "0 0 24px",
  textAlign: "center",
};

const priceLabel: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#95B4A0",
  margin: "0 0 6px",
};

const priceAmount: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: 700,
  color: "#FFFFFF",
  margin: "0",
  letterSpacing: "-0.02em",
  fontFamily: fontHeading,
};

const priceService: React.CSSProperties = {
  fontSize: "13px",
  color: "#95B4A0",
  margin: "6px 0 0",
};

/* ── Details ── */
const detailsBox: React.CSSProperties = {
  backgroundColor: "#FAF7F2",
  borderRadius: "10px",
  padding: "16px 20px 8px",
  margin: "0 0 24px",
  border: "1px solid #EDE8DF",
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
  margin: "0 0 16px",
};

const linkStyle: React.CSSProperties = {
  color: "#1A3C34",
  fontWeight: 600,
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};

const smallText: React.CSSProperties = {
  fontSize: "12px",
  color: "#6B7F72",
  margin: "8px 0 0",
};
