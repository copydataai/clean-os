import { Text, Section, Row, Column } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./components/layout";

interface PaymentSavedEmailProps {
  firstName?: string;
  service?: string;
  cardBrand?: string;
  cardLast4?: string;
  bookingRef?: string;
}

export default function PaymentSavedEmail({
  firstName = "there",
  service,
  cardBrand,
  cardLast4,
  bookingRef,
}: PaymentSavedEmailProps) {
  const cardDisplay =
    cardBrand && cardLast4
      ? `${cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1)} ending in ${cardLast4}`
      : undefined;

  return (
    <EmailLayout preview={`${firstName}, you're all set — payment method saved`}>
      <Section style={checkSection}>
        <Text style={checkmark}>&#10003;</Text>
      </Section>

      <Text style={heading}>You&apos;re All Set!</Text>
      <Text style={paragraph}>
        Hi {firstName}, your payment method has been saved successfully. Your
        booking is now fully set up and ready to go.
      </Text>

      <Section style={detailsBox}>
        <Text style={detailsHeading}>Booking details</Text>
        {service && (
          <Row style={detailRow}>
            <Column style={detailLabel}>Service</Column>
            <Column style={detailValue}>{service}</Column>
          </Row>
        )}
        {cardDisplay && (
          <Row style={detailRow}>
            <Column style={detailLabel}>Card</Column>
            <Column style={detailValue}>{cardDisplay}</Column>
          </Row>
        )}
        {bookingRef && (
          <Row style={detailRow}>
            <Column style={detailLabel}>Reference</Column>
            <Column style={detailValue}>{bookingRef}</Column>
          </Row>
        )}
        <Row style={detailRow}>
          <Column style={detailLabel}>Payment</Column>
          <Column style={detailValue}>Charged after service</Column>
        </Row>
      </Section>

      <Text style={paragraph}>
        <strong>What happens next?</strong>
      </Text>
      <Text style={listItem}>1. Our team will confirm your cleaning schedule</Text>
      <Text style={listItem}>2. You&apos;ll receive a reminder before each visit</Text>
      <Text style={listItem}>3. Your card is charged only after the service</Text>

      <Text style={smallText}>
        Questions? Just reply to this email. We&apos;re happy to help.
      </Text>
    </EmailLayout>
  );
}

const checkSection = {
  textAlign: "center" as const,
  margin: "0 0 16px",
};

const checkmark = {
  display: "inline-block" as const,
  width: "48px",
  height: "48px",
  lineHeight: "48px",
  borderRadius: "50%",
  backgroundColor: "#d1fae5",
  color: "#059669",
  fontSize: "24px",
  fontWeight: "700" as const,
  textAlign: "center" as const,
  margin: "0 auto",
};

const heading = {
  fontSize: "20px",
  fontWeight: "600" as const,
  color: "#111827",
  textAlign: "center" as const,
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

const listItem = {
  fontSize: "13px",
  lineHeight: "22px",
  color: "#6b7280",
  margin: "0",
  paddingLeft: "8px",
};

const smallText = {
  fontSize: "12px",
  color: "#9ca3af",
  margin: "24px 0 0",
};
