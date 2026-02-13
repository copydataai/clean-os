import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";
import * as React from "react";

export interface EmailBrandConfig {
  displayName?: string;
  logoUrl?: string;
  iconUrl?: string;
  brandColor?: string;
  accentColor?: string;
  tagline?: string;
  email?: string;
}

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
  brand?: EmailBrandConfig;
}

const DEFAULT_BRAND_NAME = "JOLU\u2009AI";
const DEFAULT_BRAND_COLOR = "#1A3C34";
const DEFAULT_TAGLINE = "AI-powered operations";
const DEFAULT_CONTACT_EMAIL = "jose@joluai.com";

export default function EmailLayout({ preview, children, brand }: EmailLayoutProps) {
  const brandName = brand?.displayName || DEFAULT_BRAND_NAME;
  const brandColor = brand?.brandColor || DEFAULT_BRAND_COLOR;
  const accentColor = brand?.accentColor || "#C5BCAD";
  const tagline = brand?.tagline || DEFAULT_TAGLINE;
  const contactEmail = brand?.email || DEFAULT_CONTACT_EMAIL;

  return (
    <Html>
      <Head>
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&display=swap');`}
        </style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ ...body, backgroundColor: brandColor }}>
        <Container style={container}>
          {/* ── Brand mark ── */}
          <Section style={brandSection}>
            {brand?.logoUrl ? (
              <Img
                src={brand.logoUrl}
                alt={brandName}
                width="140"
                height="auto"
                style={{ margin: "0 auto 12px", display: "block" }}
              />
            ) : (
              <Text style={brandMarkStyle}>
                {brandName.toUpperCase()}
              </Text>
            )}
            <Hr style={{ ...brandRule, borderColor: accentColor }} />
          </Section>

          {/* ── Content card ── */}
          <Section style={{ ...card, borderTop: `3px solid ${accentColor}` }}>
            {children}
          </Section>

          {/* ── Footer ── */}
          <Text style={{ ...footer, color: accentColor }}>
            {brandName} &middot; {tagline}
          </Text>
          <Text style={{ ...footerSub, color: accentColor }}>
            Questions? Reach us at {contactEmail}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const fontBody =
  '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

const body: React.CSSProperties = {
  backgroundColor: "#F0ECE4",
  fontFamily: fontBody,
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  margin: "0 auto",
  padding: "48px 20px 40px",
  maxWidth: "560px",
};

const brandSection: React.CSSProperties = {
  textAlign: "center",
  marginBottom: "32px",
};

const brandMarkStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.22em",
  color: "#FFFFFF",
  textTransform: "uppercase",
  margin: "0 0 12px",
  fontFamily: fontBody,
};

const brandRule: React.CSSProperties = {
  borderColor: "#C5BCAD",
  borderWidth: "1px 0 0",
  borderStyle: "solid",
  margin: "0 auto",
  width: "48px",
};

const card: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  borderRadius: "12px",
  padding: "36px 32px 32px",
};

const footer: React.CSSProperties = {
  fontSize: "12px",
  color: "#8E9688",
  textAlign: "center",
  margin: "28px 0 4px",
  fontFamily: fontBody,
};

const footerSub: React.CSSProperties = {
  fontSize: "11px",
  color: "#AAA79E",
  textAlign: "center",
  margin: "0",
  fontFamily: fontBody,
};
