"use node";

import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

type QuotePdfData = {
  quoteNumber: number;
  sentAt?: number;
  profile: {
    displayName: string;
    legalName: string;
    phone: string;
    email: string;
    website: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    brandColor?: string;
    tagline?: string;
  };
  recipient: {
    name?: string;
    email?: string;
    address?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  lineItem: {
    serviceLabel: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
    subtotalCents: number;
    taxName: string;
    taxRateBps: number;
    taxAmountCents: number;
    totalCents: number;
    currency: string;
  };
  inclusions: {
    title: string;
    intro: string;
    includedItems: string[];
    whyItWorksItems: string[];
    outro: string;
  };
  terms: {
    quoteValidity: string;
    serviceLimitations: string;
    access: string;
    cancellations: string;
    nonSolicitation: string;
    acceptance: string;
  };
};

function formatCurrency(cents: number, currency: string): string {
  const normalized = currency.toUpperCase();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalized,
  }).format(cents / 100);
}

function formatDate(timestamp?: number): string {
  if (!timestamp) {
    return new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  }

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    color: "#111827",
    fontFamily: "Helvetica",
  },
  section: {
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 9,
    color: "#4B5563",
  },
  infoLabel: {
    fontSize: 9,
    color: "#6B7280",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  infoText: {
    fontSize: 10,
    marginBottom: 2,
  },
  tableHeader: {
    backgroundColor: "#266F9A",
    color: "#FFFFFF",
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginTop: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  cService: { width: "22%" },
  cDescription: { width: "43%" },
  cQty: { width: "8%", textAlign: "right" },
  cUnit: { width: "13%", textAlign: "right" },
  cTotal: { width: "14%", textAlign: "right" },
  totalsBox: {
    marginTop: 6,
    width: "45%",
    alignSelf: "flex-end",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  termsTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 6,
    lineHeight: 1.45,
  },
  bullet: {
    marginBottom: 4,
    lineHeight: 1.4,
  },
  footer: {
    marginTop: 10,
    fontSize: 9,
    color: "#4B5563",
    textAlign: "center",
  },
});

function QuotePdfDocument({ data }: { data: QuotePdfData }) {
  const taxRatePct = data.lineItem.taxRateBps / 100;
  const fullRecipientName = data.recipient.name?.trim();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Company header ── */}
        <View style={[styles.section, { marginBottom: 16 }]}>
          <Text style={{ fontSize: 14, fontWeight: 700, color: data.profile.brandColor || "#111827" }}>
            {data.profile.displayName}
          </Text>
          {data.profile.tagline ? (
            <Text style={{ fontSize: 8, color: "#6B7280", marginTop: 2 }}>{data.profile.tagline}</Text>
          ) : null}
        </View>

        <View style={[styles.row, styles.section]}>
          <View style={{ width: "58%" }}>
            <Text style={styles.infoLabel}>Recipient</Text>
            <Text style={styles.infoText}>{fullRecipientName || "Customer"}</Text>
            {data.recipient.address ? <Text style={styles.infoText}>{data.recipient.address}</Text> : null}
            {data.recipient.addressLine2 ? (
              <Text style={styles.infoText}>{data.recipient.addressLine2}</Text>
            ) : null}
            <Text style={styles.infoText}>
              {[data.recipient.city, data.recipient.state, data.recipient.postalCode]
                .filter(Boolean)
                .join(", ")}
            </Text>
          </View>
          <View style={{ width: "42%", alignItems: "flex-end" }}>
            <Text style={styles.title}>Quote #{data.quoteNumber}</Text>
            <Text style={styles.subtitle}>Sent on {formatDate(data.sentAt)}</Text>
            <Text style={[styles.subtitle, { marginTop: 8 }]}>
              Total {formatCurrency(data.lineItem.totalCents, data.lineItem.currency)}
            </Text>
          </View>
        </View>

        <View style={[styles.tableHeader, data.profile.brandColor ? { backgroundColor: data.profile.brandColor } : {}]}>
          <Text style={styles.cService}>Product/Service</Text>
          <Text style={styles.cDescription}>Description</Text>
          <Text style={styles.cQty}>Qty.</Text>
          <Text style={styles.cUnit}>Unit Price</Text>
          <Text style={styles.cTotal}>Total</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.cService}>{data.lineItem.serviceLabel}</Text>
          <Text style={styles.cDescription}>{data.lineItem.description}</Text>
          <Text style={styles.cQty}>{data.lineItem.quantity}</Text>
          <Text style={styles.cUnit}>
            {formatCurrency(data.lineItem.unitPriceCents, data.lineItem.currency)}
          </Text>
          <Text style={styles.cTotal}>
            {formatCurrency(data.lineItem.subtotalCents, data.lineItem.currency)}
          </Text>
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text>Subtotal</Text>
            <Text>{formatCurrency(data.lineItem.subtotalCents, data.lineItem.currency)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>
              {data.lineItem.taxName} ({taxRatePct.toFixed(1)}%)
            </Text>
            <Text>{formatCurrency(data.lineItem.taxAmountCents, data.lineItem.currency)}</Text>
          </View>
          <View style={[styles.totalsRow, { borderBottomWidth: 0 }]}>
            <Text style={{ fontWeight: 700 }}>Total</Text>
            <Text style={{ fontWeight: 700 }}>
              {formatCurrency(data.lineItem.totalCents, data.lineItem.currency)}
            </Text>
          </View>
        </View>

        <View style={[styles.section, { marginTop: 10 }]}>
          <Text style={styles.termsTitle}>{data.inclusions.title}</Text>
          <Text style={styles.paragraph}>{data.inclusions.intro}</Text>
          <Text style={[styles.paragraph, { fontWeight: 700 }]}>Here's what's included:</Text>
          {data.inclusions.includedItems.map((item) => (
            <Text key={item} style={styles.bullet}>
              - {item}
            </Text>
          ))}
          <Text style={[styles.paragraph, { fontWeight: 700, marginTop: 4 }]}>Why it works:</Text>
          {data.inclusions.whyItWorksItems.map((item) => (
            <Text key={item} style={styles.bullet}>
              - {item}
            </Text>
          ))}
          <Text style={styles.paragraph}>{data.inclusions.outro}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.termsTitle}>Disclaimer & Terms of Service</Text>
          <Text style={styles.paragraph}>{data.terms.quoteValidity}</Text>
          <Text style={styles.paragraph}>{data.terms.serviceLimitations}</Text>
          <Text style={styles.paragraph}>{data.terms.access}</Text>
          <Text style={styles.paragraph}>{data.terms.cancellations}</Text>
          <Text style={styles.paragraph}>{data.terms.nonSolicitation}</Text>
          <Text style={styles.paragraph}>{data.terms.acceptance}</Text>
        </View>

        <Text style={styles.footer}>
          {data.profile.addressLine1}
          {data.profile.addressLine2 ? ` | ${data.profile.addressLine2}` : ""}
          {` | ${data.profile.city}, ${data.profile.state} ${data.profile.postalCode}`}
          {"\n"}
          {data.profile.phone} | {data.profile.email} | {data.profile.website}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderQuotePdfBuffer(data: QuotePdfData): Promise<Buffer> {
  return await renderToBuffer(<QuotePdfDocument data={data} />);
}

