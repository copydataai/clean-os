import {
  Text,
  Section,
  Row,
  Column,
  Hr,
} from "@react-email/components";
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
    <EmailLayout
      preview={`Hi ${firstName}, we received your quote request`}
    >
      {/* ── Status pill ── */}
      <Section style={pillSection}>
        <Text style={statusPill}>RECEIVED</Text>
      </Section>

      <Text style={heading}>Quote Request Received</Text>
      <Text style={paragraph}>
        Hi {firstName}, thank you for reaching out! We&apos;ve received your
        cleaning quote request and our team will review it shortly.
      </Text>

      {/* ── Request details ── */}
      <Section style={detailsBox}>
        <Text style={detailsHeading}>Your request details</Text>
        {(() => {
          const fields: { label: string; value: string }[] = [];
          if (service) fields.push({ label: "Service", value: service });
          if (serviceType) fields.push({ label: "Type", value: serviceType });
          if (frequency) fields.push({ label: "Frequency", value: frequency });
          if (squareFootage != null) fields.push({ label: "Sq. ft.", value: squareFootage.toLocaleString() });
          if (locationLine) fields.push({ label: "Location", value: locationLine });
          return fields.map((field, i) => (
            <React.Fragment key={field.label}>
              <DetailRow label={field.label} value={field.value} />
              {i < fields.length - 1 && <Hr style={divider} />}
            </React.Fragment>
          ));
        })()}
      </Section>

      <Text style={paragraph}>
        We&apos;ll get back to you with a quote within 24 hours. If you have
        questions in the meantime, just reply to this email.
      </Text>

      {/* ── Timeline ── */}
      <Section style={timelineBox}>
        <Text style={timelineHeading}>What happens next</Text>
        <Row style={timelineStep}>
          <Column style={dotCol}>
            <Text style={dotFilled}>&bull;</Text>
          </Column>
          <Column>
            <Text style={timelineText}>
              <strong style={{ color: "#1A2F23" }}>
                Request received
              </strong>{" "}
              &mdash; you are here
            </Text>
          </Column>
        </Row>
        <Row style={timelineStep}>
          <Column style={dotCol}>
            <Text style={dotEmpty}>&bull;</Text>
          </Column>
          <Column>
            <Text style={timelineText}>
              We send you a personalized quote
            </Text>
          </Column>
        </Row>
        <Row style={timelineStep}>
          <Column style={dotCol}>
            <Text style={dotEmpty}>&bull;</Text>
          </Column>
          <Column>
            <Text style={timelineText}>
              You confirm your booking details
            </Text>
          </Column>
        </Row>
      </Section>
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
  color: "#B8963E",
  backgroundColor: "#FBF5E8",
  border: "1px solid #E8D9B8",
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

/* ── Timeline ── */
const timelineBox: React.CSSProperties = {
  backgroundColor: "#FAF7F2",
  borderRadius: "10px",
  padding: "20px",
  margin: "0",
  borderLeft: "3px solid #1A3C34",
};

const timelineHeading: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "#2D6A4F",
  margin: "0 0 16px",
};

const timelineStep: React.CSSProperties = {
  marginBottom: "8px",
};

const dotCol: React.CSSProperties = {
  width: "20px",
  verticalAlign: "top",
};

const dotFilled: React.CSSProperties = {
  fontSize: "18px",
  lineHeight: "20px",
  color: "#2D6A4F",
  margin: "0",
  fontWeight: 700,
};

const dotEmpty: React.CSSProperties = {
  fontSize: "18px",
  lineHeight: "20px",
  color: "#C5BCAD",
  margin: "0",
};

const timelineText: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#5E7A6B",
  margin: "0",
};
