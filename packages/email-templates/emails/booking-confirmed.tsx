import { Text, Button, Section, Row, Column } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./components/layout";

interface BookingConfirmedEmailProps {
  firstName?: string;
  service?: string;
  frequency?: string;
  address?: string;
  accessMethod?: string[];
  pets?: string[];
  bookingLink: string;
}

export default function BookingConfirmedEmail({
  firstName = "there",
  service,
  frequency,
  address,
  accessMethod,
  pets,
  bookingLink,
}: BookingConfirmedEmailProps) {
  return (
    <EmailLayout preview={`${firstName}, your booking is confirmed — one last step`}>
      <Text style={heading}>Booking Confirmed</Text>
      <Text style={paragraph}>
        Hi {firstName}, your booking details have been confirmed. We&apos;re
        almost ready to get you scheduled!
      </Text>

      <Section style={detailsBox}>
        <Text style={detailsHeading}>Booking summary</Text>
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
        {address && (
          <Row style={detailRow}>
            <Column style={detailLabel}>Address</Column>
            <Column style={detailValue}>{address}</Column>
          </Row>
        )}
        {accessMethod && accessMethod.length > 0 && (
          <Row style={detailRow}>
            <Column style={detailLabel}>Access</Column>
            <Column style={detailValue}>{accessMethod.join(", ")}</Column>
          </Row>
        )}
        {pets && pets.length > 0 && (
          <Row style={detailRow}>
            <Column style={detailLabel}>Pets</Column>
            <Column style={detailValue}>{pets.join(", ")}</Column>
          </Row>
        )}
      </Section>

      <Text style={paragraph}>
        <strong>Last step:</strong> Please save a payment method so we can
        charge you after each cleaning. Your card will not be charged until after
        the service is completed.
      </Text>

      <Section style={ctaSection}>
        <Button href={bookingLink} style={ctaButton}>
          Save Payment Method
        </Button>
      </Section>

      <Text style={smallText}>
        Your card information is stored securely by Stripe. You will only be
        charged after your cleaning is completed.
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
