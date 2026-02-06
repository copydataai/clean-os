import { Text, Button, Section, Row, Column } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./components/layout";

interface ConfirmationLinkEmailProps {
  firstName?: string;
  service?: string;
  frequency?: string;
  confirmUrl: string;
}

export default function ConfirmationLinkEmail({
  firstName = "there",
  service,
  frequency,
  confirmUrl,
}: ConfirmationLinkEmailProps) {
  return (
    <EmailLayout preview={`${firstName}, your quote is ready — confirm your booking`}>
      <Text style={heading}>Your Quote Has Been Approved</Text>
      <Text style={paragraph}>
        Hi {firstName}, great news! We&apos;ve reviewed your request
        {service ? ` for ${service}` : ""} and your quote is ready.
      </Text>

      {(service || frequency) && (
        <Section style={detailsBox}>
          {service && (
            <Row style={detailRow}>
              <Column style={detailLabel}>Service</Column>
              <Column style={detailValue}>{service}</Column>
            </Row>
          )}
          {frequency && (
            <Row style={detailRow}>
              <Column style={detailLabel}>Frequency</Column>
              <Column style={detailValue}>{frequency}</Column>
            </Row>
          )}
        </Section>
      )}

      <Text style={paragraph}>
        To finalize your booking, we need a few more details about your home
        (access instructions, floor types, pets, etc.). Please click below to
        complete the confirmation form:
      </Text>

      <Section style={ctaSection}>
        <Button href={confirmUrl} style={ctaButton}>
          Confirm Your Booking
        </Button>
      </Section>

      <Text style={smallText}>
        This link is unique to your booking. If you have any questions, reply to
        this email and we&apos;ll be happy to help.
      </Text>
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
  width: "100px",
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

const smallText = {
  fontSize: "12px",
  color: "#9ca3af",
  margin: "16px 0 0",
};
