import { Text, Section, Row, Column } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./components/layout";

interface QuoteReceivedEmailProps {
  firstName?: string;
  service?: string;
  serviceType?: string;
  frequency?: string;
  squareFootage?: number;
  address?: string;
  city?: string;
  state?: string;
}

export default function QuoteReceivedEmail({
  firstName = "there",
  service,
  serviceType,
  frequency,
  squareFootage,
  address,
  city,
  state,
}: QuoteReceivedEmailProps) {
  const locationLine = [address, city, state].filter(Boolean).join(", ");

  return (
    <EmailLayout preview={`Hi ${firstName}, we received your quote request`}>
      <Text style={heading}>Quote Request Received</Text>
      <Text style={paragraph}>
        Hi {firstName}, thank you for reaching out! We&apos;ve received your
        cleaning quote request and our team will review it shortly.
      </Text>

      <Section style={detailsBox}>
        <Text style={detailsHeading}>Your request details</Text>
        {service && <DetailRow label="Service" value={service} />}
        {serviceType && <DetailRow label="Type" value={serviceType} />}
        {frequency && <DetailRow label="Frequency" value={frequency} />}
        {squareFootage && (
          <DetailRow label="Sq. ft." value={`${squareFootage.toLocaleString()}`} />
        )}
        {locationLine && <DetailRow label="Location" value={locationLine} />}
      </Section>

      <Text style={paragraph}>
        We&apos;ll get back to you with a quote within 24 hours. If you have
        questions in the meantime, just reply to this email.
      </Text>

      <Text style={nextSteps}>
        <strong>What happens next?</strong>
        <br />
        1. Our team reviews your request
        <br />
        2. We send you a personalized quote
        <br />
        3. You confirm your booking details
      </Text>
    </EmailLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={detailRow}>
      <Column style={detailLabel}>{label}</Column>
      <Column style={detailValue}>{value}</Column>
    </Row>
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

const detailsHeading = {
  fontSize: "12px",
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  color: "#6b7280",
  margin: "0 0 12px",
};

const detailRow = {
  marginBottom: "8px",
};

const detailLabel = {
  fontSize: "13px",
  color: "#6b7280",
  width: "100px",
};

const detailValue = {
  fontSize: "13px",
  color: "#111827",
  fontWeight: "500" as const,
};

const nextSteps = {
  fontSize: "13px",
  lineHeight: "22px",
  color: "#6b7280",
  backgroundColor: "#f9fafb",
  borderRadius: "6px",
  padding: "16px",
  margin: "16px 0 0",
};
