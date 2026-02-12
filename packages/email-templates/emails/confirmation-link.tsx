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
    <EmailLayout
      preview={`${firstName}, your quote is ready — confirm your booking`}
    >
      {/* ── Status pill ── */}
      <Section style={pillSection}>
        <Text style={statusPill}>APPROVED</Text>
      </Section>

      <Text style={heading}>Your Quote Has Been Approved</Text>
      <Text style={paragraph}>
        Hi {firstName}, great news! We&apos;ve reviewed your request
        {service ? ` for ${service}` : ""} and your quote is ready.
      </Text>

      {(service || frequency) && (
        <Section style={detailsBox}>
          {service && (
            <>
              <Row style={detailRow}>
                <Column style={detailLabel}>Service</Column>
                <Column style={detailValue}>{service}</Column>
              </Row>
              {frequency && <Hr style={divider} />}
            </>
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
          Confirm Your Booking &rarr;
        </Button>
      </Section>

      <Text style={smallText}>
        This link is unique to your booking. If you have any questions, reply to
        this email and we&apos;ll be happy to help.
      </Text>
    </EmailLayout>
  );
}

const fontHeading =
  '"Fraunces", Georgia, "Times New Roman", serif';

const pillSection: React.CSSProperties = {
  textAlign: "center",
  margin: "0 0 20px",
};

const statusPill: React.CSSProperties = {
  display: "inline-block",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#2D6A4F",
  backgroundColor: "#EDF5F0",
  border: "1px solid #B8D4C4",
  borderRadius: "20px",
  padding: "6px 18px",
  margin: "0 auto",
};

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
  margin: "0 0 18px",
};

const detailsBox: React.CSSProperties = {
  backgroundColor: "#FAF7F2",
  borderRadius: "10px",
  padding: "16px 20px",
  margin: "0 0 22px",
  border: "1px solid #EDE8DF",
};

const detailRow: React.CSSProperties = {
  marginBottom: "0",
};

const detailLabel: React.CSSProperties = {
  fontSize: "13px",
  color: "#7A8E80",
  width: "100px",
  paddingTop: "6px",
  paddingBottom: "6px",
};

const detailValue: React.CSSProperties = {
  fontSize: "13px",
  color: "#1A2F23",
  fontWeight: 600,
  paddingTop: "6px",
  paddingBottom: "6px",
};

const divider: React.CSSProperties = {
  borderColor: "#E8E2D8",
  borderWidth: "1px 0 0",
  borderStyle: "solid",
  margin: "0",
};

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

const smallText: React.CSSProperties = {
  fontSize: "12px",
  color: "#94A39A",
  margin: "8px 0 0",
};
