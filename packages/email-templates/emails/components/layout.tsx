import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export default function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head>
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&display=swap');`}
        </style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* ── Brand mark ── */}
          <Section style={brandSection}>
            <Text style={brandMark}>JOLU&thinsp;AI</Text>
            <Hr style={brandRule} />
          </Section>

          {/* ── Content card ── */}
          <Section style={card}>{children}</Section>

          {/* ── Footer ── */}
          <Text style={footer}>
            JoluAI &middot; AI-powered operations
          </Text>
          <Text style={footerSub}>
            Questions? Reach us at jose@joluai.com
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

const brandMark: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.22em",
  color: "#1A3C34",
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
  borderTop: "3px solid #1A3C34",
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
