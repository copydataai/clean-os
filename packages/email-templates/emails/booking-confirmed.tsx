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
    <EmailLayout
      preview={`${firstName}, your booking is confirmed — one last step`}
    >
      {/* ── Confirmation badge ── */}
      <Section style={badgeSection}>
        <Text style={badgeCircle}>&#10003;</Text>
      </Section>

      <Text style={heading}>Booking Confirmed</Text>
      <Text style={subheading}>
        Hi {firstName}, everything looks great.
        <br />
        One quick step and we&apos;ll get you on the schedule.
      </Text>

      {/* ── Progress steps ── */}
      <Section style={progressSection}>
        <Row>
          <Column style={progressStep}>
            <Text style={progressDotDone}>&#10003;</Text>
            <Text style={progressLabelDone}>Confirmed</Text>
          </Column>
          <Column style={progressStep}>
            <Text style={progressDotActive}>2</Text>
            <Text style={progressLabelActive}>Payment</Text>
          </Column>
          <Column style={progressStep}>
            <Text style={progressDotPending}>3</Text>
            <Text style={progressLabelPending}>Scheduled</Text>
          </Column>
        </Row>
      </Section>

      {/* ── Summary card ── */}
      <Section style={summaryCard}>
        <Text style={summaryHeading}>Your booking</Text>
        {service && (
          <>
            <Row style={summaryRow}>
              <Column style={summaryLabel}>Service</Column>
              <Column style={summaryValue}>{service}</Column>
            </Row>
            <Hr style={summaryDivider} />
          </>
        )}
        {frequency && (
          <>
            <Row style={summaryRow}>
              <Column style={summaryLabel}>Frequency</Column>
              <Column style={summaryValue}>{frequency}</Column>
            </Row>
            <Hr style={summaryDivider} />
          </>
        )}
        {address && (
          <>
            <Row style={summaryRow}>
              <Column style={summaryLabel}>Address</Column>
              <Column style={summaryValue}>{address}</Column>
            </Row>
            <Hr style={summaryDivider} />
          </>
        )}
        {accessMethod && accessMethod.length > 0 && (
          <>
            <Row style={summaryRow}>
              <Column style={summaryLabel}>Access</Column>
              <Column style={summaryValue}>{accessMethod.join(", ")}</Column>
            </Row>
            <Hr style={summaryDivider} />
          </>
        )}
        {pets && pets.length > 0 && (
          <Row style={summaryRow}>
            <Column style={summaryLabel}>Pets</Column>
            <Column style={summaryValue}>{pets.join(", ")}</Column>
          </Row>
        )}
      </Section>

      {/* ── CTA ── */}
      <Text style={ctaIntro}>
        Save a payment method so we can charge you after each cleaning. Your
        card is <strong>never charged until the service is complete</strong>.
      </Text>

      <Section style={ctaSection}>
        <Button href={bookingLink} style={ctaButton}>
          Save Payment Method &rarr;
        </Button>
      </Section>

      {/* ── Security note ── */}
      <Section style={securityNote}>
        <Row>
          <Column style={securityIconCol}>
            <Text style={securityIcon}>&#128274;</Text>
          </Column>
          <Column>
            <Text style={securityText}>
              Secured by Stripe. Your card details are encrypted and never
              stored on our servers.
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
  margin: "0 0 8px",
  letterSpacing: "-0.02em",
  fontFamily: fontHeading,
};

const subheading: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#5E7A6B",
  textAlign: "center",
  margin: "0 0 28px",
};

/* ── Progress indicator ── */
const progressSection: React.CSSProperties = {
  backgroundColor: "#FAF7F2",
  borderRadius: "10px",
  padding: "18px 8px",
  margin: "0 0 28px",
  border: "1px solid #EDE8DF",
};

const progressStep: React.CSSProperties = {
  textAlign: "center",
  width: "33.33%",
};

const progressDotDone: React.CSSProperties = {
  display: "inline-block",
  width: "28px",
  height: "28px",
  lineHeight: "28px",
  borderRadius: "50%",
  backgroundColor: "#2D6A4F",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 700,
  textAlign: "center",
  margin: "0 auto 4px",
};

const progressDotActive: React.CSSProperties = {
  display: "inline-block",
  width: "28px",
  height: "28px",
  lineHeight: "28px",
  borderRadius: "50%",
  backgroundColor: "#ffffff",
  border: "2px solid #B8963E",
  color: "#B8963E",
  fontSize: "13px",
  fontWeight: 700,
  textAlign: "center",
  margin: "0 auto 4px",
};

const progressDotPending: React.CSSProperties = {
  display: "inline-block",
  width: "28px",
  height: "28px",
  lineHeight: "28px",
  borderRadius: "50%",
  backgroundColor: "#ffffff",
  border: "2px solid #D4CBC0",
  color: "#A09888",
  fontSize: "13px",
  fontWeight: 600,
  textAlign: "center",
  margin: "0 auto 4px",
};

const progressLabelDone: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  color: "#2D6A4F",
  margin: "0",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const progressLabelActive: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  color: "#B8963E",
  margin: "0",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const progressLabelPending: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 500,
  color: "#A09888",
  margin: "0",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

/* ── Summary card ── */
const summaryCard: React.CSSProperties = {
  backgroundColor: "#FAF7F2",
  borderRadius: "10px",
  borderLeft: "3px solid #2D6A4F",
  padding: "20px 20px 12px",
  margin: "0 0 28px",
};

const summaryHeading: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "#2D6A4F",
  margin: "0 0 14px",
};

const summaryRow: React.CSSProperties = {
  marginBottom: "0",
};

const summaryLabel: React.CSSProperties = {
  fontSize: "13px",
  color: "#7A8E80",
  width: "100px",
  paddingTop: "8px",
  paddingBottom: "8px",
};

const summaryValue: React.CSSProperties = {
  fontSize: "13px",
  color: "#1A2F23",
  fontWeight: 600,
  paddingTop: "8px",
  paddingBottom: "8px",
};

const summaryDivider: React.CSSProperties = {
  borderColor: "#E8E2D8",
  borderWidth: "1px 0 0",
  borderStyle: "solid",
  margin: "0",
};

/* ── CTA ── */
const ctaIntro: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#3D5347",
  margin: "0 0 22px",
};

const ctaSection: React.CSSProperties = {
  textAlign: "center",
  margin: "0 0 24px",
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

/* ── Security note ── */
const securityNote: React.CSSProperties = {
  backgroundColor: "#FAF7F2",
  borderRadius: "8px",
  padding: "12px 16px",
  margin: "0",
};

const securityIconCol: React.CSSProperties = {
  width: "32px",
  verticalAlign: "top",
};

const securityIcon: React.CSSProperties = {
  fontSize: "16px",
  margin: "0",
  lineHeight: "20px",
};

const securityText: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#7A8E80",
  margin: "0",
};
