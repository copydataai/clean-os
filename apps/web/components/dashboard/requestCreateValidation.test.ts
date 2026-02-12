import { describe, expect, it } from "vitest";
import { parseCommaSeparated, validateRequestCreateInput } from "./requestCreateValidation";

describe("requestCreateValidation", () => {
  it("validates required fields for new mode", () => {
    const errors = validateRequestCreateInput({
      mode: "new",
      contact: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
      },
      quote: {
        service: "",
        serviceType: "",
        squareFootage: "0",
        address: "",
        postalCode: "",
        city: "",
        state: "",
      },
    });

    expect(errors).toContain("First name is required.");
    expect(errors).toContain("Last name is required.");
    expect(errors).toContain("Email is required.");
    expect(errors).toContain("Phone is required.");
    expect(errors).toContain("Service is required.");
    expect(errors).toContain("Service type is required.");
    expect(errors).toContain("Address is required.");
    expect(errors).toContain("Postal code is required.");
    expect(errors).toContain("City is required.");
    expect(errors).toContain("State is required.");
    expect(errors).toContain("Square footage must be a positive number.");
  });

  it("requires an existing quote selection in existing mode", () => {
    const errors = validateRequestCreateInput({
      mode: "existing",
      existingQuoteRequestId: "",
      contact: {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phone: "5551234567",
      },
      quote: {
        service: "Cleaning",
        serviceType: "Deep",
        squareFootage: "1200",
        address: "123 Main",
        postalCode: "94107",
        city: "San Francisco",
        state: "CA",
      },
    });

    expect(errors).toContain("Select an existing quote.");
  });

  it("only validates quote selection in existing mode", () => {
    const errors = validateRequestCreateInput({
      mode: "existing",
      existingQuoteRequestId: "quote_123",
      contact: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
      },
      quote: {
        service: "",
        serviceType: "",
        squareFootage: "",
        address: "",
        postalCode: "",
        city: "",
        state: "",
      },
    });

    expect(errors).toEqual([]);
  });

  it("parses comma separated values", () => {
    expect(parseCommaSeparated("pets, alarm code , gate")).toEqual([
      "pets",
      "alarm code",
      "gate",
    ]);
    expect(parseCommaSeparated(" ,  ")).toBeUndefined();
    expect(parseCommaSeparated(undefined)).toBeUndefined();
  });
});
