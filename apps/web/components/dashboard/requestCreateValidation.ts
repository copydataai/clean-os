export type RequestCreateMode = "new" | "existing";

export type RequestCreateValidationInput = {
  mode: RequestCreateMode;
  existingQuoteRequestId?: string | null;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  quote: {
    service: string;
    serviceType: string;
    squareFootage: string;
    address: string;
    postalCode: string;
    city: string;
    state: string;
  };
};

function isBlank(value?: string | null): boolean {
  return !value || value.trim().length === 0;
}

export function parseCommaSeparated(value?: string | null): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return parsed.length > 0 ? parsed : undefined;
}

export function validateRequestCreateInput(input: RequestCreateValidationInput): string[] {
  const errors: string[] = [];

  if (input.mode === "existing" && isBlank(input.existingQuoteRequestId)) {
    errors.push("Select an existing quote request.");
  }

  if (isBlank(input.contact.firstName)) {
    errors.push("First name is required.");
  }
  if (isBlank(input.contact.lastName)) {
    errors.push("Last name is required.");
  }
  if (isBlank(input.contact.email)) {
    errors.push("Email is required.");
  }
  if (isBlank(input.contact.phone)) {
    errors.push("Phone is required.");
  }

  if (isBlank(input.quote.service)) {
    errors.push("Service is required.");
  }
  if (isBlank(input.quote.serviceType)) {
    errors.push("Service type is required.");
  }
  if (isBlank(input.quote.address)) {
    errors.push("Address is required.");
  }
  if (isBlank(input.quote.postalCode)) {
    errors.push("Postal code is required.");
  }
  if (isBlank(input.quote.city)) {
    errors.push("City is required.");
  }
  if (isBlank(input.quote.state)) {
    errors.push("State is required.");
  }

  const squareFootage = Number.parseInt(input.quote.squareFootage, 10);
  if (!Number.isFinite(squareFootage) || squareFootage <= 0) {
    errors.push("Square footage must be a positive number.");
  }

  return errors;
}
