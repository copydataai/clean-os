import {
  Text,
  Section,
  Row,
  Column,
  Hr,
} from "@react-email/components";
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
    <EmailLayout
      preview={`${firstName}, you're all set — payment method saved`}
    >
      {/* ── Success badge ── */}
      <Section style={badgeSection}>
        <Text style={badgeCircle}>&#10003;</Text>
      </Section>

      <Text style={heading}>You&apos;re All Set!</Text>
      <Text style={paragraph}>
        Hi {firstName}, your payment method has been saved successfully. Your
        booking is now fully set up and ready to go.
      </Text>

      {/* ── Booking details ── */}
      <Section style={detailsBox}>
        <Text style={detailsHeading}>Booking details</Text>
        {service && (
          <>
            <Row style={detailRow}>
              <Column style={detailLabel}>Service</Column>
              <Column style={detailValue}>{service}</Column>
            </Row>
            <Hr style={divider} />
          </>
        )}
        {cardDisplay && (
          <>
            <Row style={detailRow}>
              <Column style={detailLabel}>Card</Column>
              <Column style={detailValue}>{cardDisplay}</Column>
            </Row>
            <Hr style={divider} />
          </>
        )}
        {bookingRef && (
          <>
            <Row style={detailRow}>
              <Column style={detailLabel}>Reference</Column>
              <Column style={detailValue}>{bookingRef}</Column>
            </Row>
            <Hr style={divider} />
          </>
        )}
        <Row style={detailRow}>
          <Column style={detailLabel}>Payment</Column>
          <Column style={detailValue}>Charged after service</Column>
        </Row>
      </Section>

      {/* ── Next steps ── */}
      <Section style={stepsBox}>
        <Text style={stepsHeading}>What happens next</Text>
        <Row style={stepRow}>
          <Column style={stepNumCol}>
            <Text style={stepNum}>1</Text>
          </Column>
          <Column>
            <Text style={stepText}>
              Our team will confirm your cleaning schedule
            </Text>
          </Column>
        </Row>
        <Row style={stepRow}>
          <Column style={stepNumCol}>
            <Text style={stepNum}>2</Text>
          </Column>
          <Column>
            <Text style={stepText}>
              You&apos;ll receive a reminder before each visit
            </Text>
          </Column>
        </Row>
        <Row style={stepRow}>
          <Column style={stepNumCol}>
            <Text style={stepNum}>3</Text>
          </Column>
          <Column>
            <Text style={stepText}>
              Your card is charged only after the service
            </Text>
          </Column>
        </Row>
      </Section>
    </EmailLayout>
  );
}

const fontHeading =
  '"Fraunces", Georgia, "Times New Roman", serif';

/* ── Badge ── */
const badgeSection: React.CSSProperties = {
  textAlign: "center",
  margin: "0 0 20px",
};

const badgeCircle: React.CSSProperties = {
  display: "inline-block",
  width: "52px",
  height: "52px",
  lineHeight: "52px",
  borderRadius: "50%",
  backgroundColor: "#EDF5F0",
  border: "2px solid #B8D4C4",
  color: "#2D6A4F",
  fontSize: "24px",
  fontWeight: 700,
  textAlign: "center",
  margin: "0 auto",
};

/* ── Typography ── */
const heading: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 600,
  color: "#1A2F23",
  textAlign: "center",
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

/* ── Details card ── */
const detailsBox: React.CSSProperties = {
  backgroundColor: "#FAF7F2",
  borderRadius: "10px",
  padding: "20px 20px 12px",
  margin: "0 0 24px",
  border: "1px solid #EDE8DF",
};

const detailsHeading: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "#7A8E80",
  margin: "0 0 14px",
};

const detailRow: React.CSSProperties = {
  marginBottom: "0",
};

const detailLabel: React.CSSProperties = {
  fontSize: "13px",
  color: "#7A8E80",
  width: "100px",
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

/* ── Steps ── */
const stepsBox: React.CSSProperties = {
  backgroundColor: "#FAF7F2",
  borderRadius: "10px",
  padding: "20px",
  margin: "0",
  borderLeft: "3px solid #B8963E",
};

const stepsHeading: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "#B8963E",
  margin: "0 0 16px",
};

const stepRow: React.CSSProperties = {
  marginBottom: "10px",
};

const stepNumCol: React.CSSProperties = {
  width: "28px",
  verticalAlign: "top",
};

const stepNum: React.CSSProperties = {
  display: "inline-block",
  width: "20px",
  height: "20px",
  lineHeight: "20px",
  borderRadius: "50%",
  backgroundColor: "#B8963E",
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: 700,
  textAlign: "center",
  margin: "0",
};

const stepText: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#5E7A6B",
  margin: "0",
};
