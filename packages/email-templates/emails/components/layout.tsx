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
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={logo}>Clean OS</Text>
          <Section style={content}>{children}</Section>
          <Hr style={hr} />
          <Text style={footer}>
            Clean OS &mdash; Professional cleaning services
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f9fafb",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "560px",
};

const logo = {
  fontSize: "24px",
  fontWeight: "700" as const,
  color: "#111827",
  textAlign: "center" as const,
  margin: "0 0 32px",
};

const content = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  padding: "32px 24px",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "32px 0 16px",
};

const footer = {
  fontSize: "12px",
  color: "#9ca3af",
  textAlign: "center" as const,
};
