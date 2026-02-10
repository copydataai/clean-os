import { v } from "convex/values";

export type TallyFieldRef = {
  questionId?: string;
  key?: string;
  label?: string;
};

export type TallyFlowMappings = Record<string, TallyFieldRef | undefined>;

export type TallyMappings = {
  quoteRequest?: TallyFlowMappings;
  bookingConfirmation?: TallyFlowMappings;
};

export const QUOTE_REQUEST_TARGETS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "service",
  "serviceType",
  "frequency",
  "squareFootage",
  "address",
  "addressLine2",
  "postalCode",
  "city",
  "state",
  "additionalNotes",
  "utm_source",
  "utm_campaign",
  "gad_campaignid",
  "gclid",
  "status",
] as const;

export const QUOTE_REQUEST_REQUIRED_TARGETS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "service",
  "serviceType",
  "squareFootage",
  "address",
  "postalCode",
  "city",
  "state",
] as const;

export const BOOKING_CONFIRMATION_TARGETS = [
  "contactDetails",
  "phoneNumber",
  "email",
  "accessMethod",
  "accessInstructions",
  "parkingInstructions",
  "floorTypes",
  "finishedBasement",
  "delicateSurfaces",
  "attentionAreas",
  "pets",
  "homeDuringCleanings",
  "scheduleAdjustmentWindows",
  "timingShiftOk",
  "additionalNotes",
] as const;

export const BOOKING_CONFIRMATION_REQUIRED_TARGETS = [
  "contactDetails",
  "phoneNumber",
  "email",
] as const;

export const tallyFieldRefValidator = v.object({
  questionId: v.optional(v.string()),
  key: v.optional(v.string()),
  label: v.optional(v.string()),
});

export const tallyFlowMappingsValidator = v.record(v.string(), tallyFieldRefValidator);

export const tallyMappingsValidator = v.object({
  quoteRequest: v.optional(tallyFlowMappingsValidator),
  bookingConfirmation: v.optional(tallyFlowMappingsValidator),
});

export function hasMappedRef(ref: TallyFieldRef | undefined | null): boolean {
  if (!ref) {
    return false;
  }
  return Boolean(ref.questionId || ref.key || ref.label);
}

export function hasRequiredMappings(
  flow: TallyFlowMappings | undefined,
  requiredTargets: readonly string[],
): boolean {
  if (!flow) {
    return false;
  }

  return requiredTargets.every((target) => hasMappedRef(flow[target]));
}

function normalizeToken(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

export type TallyQuestionShape = {
  id?: string;
  key?: string;
  title?: string;
  label?: string;
  text?: string;
};

export function suggestMappingForTargets(
  questions: TallyQuestionShape[],
  targetSynonyms: Record<string, string[]>,
): TallyFlowMappings {
  const mapped: TallyFlowMappings = {};
  const questionCatalog = questions.map((question) => {
    const label =
      question.label ??
      question.title ??
      question.text ??
      question.key ??
      question.id ??
      "";
    const normalized = normalizeToken(label);
    const keyNormalized = normalizeToken(question.key ?? "");
    return {
      id: question.id,
      key: question.key,
      label,
      normalized,
      keyNormalized,
    };
  });

  for (const [target, synonyms] of Object.entries(targetSynonyms)) {
    const normalizedSynonyms = synonyms.map(normalizeToken).filter(Boolean);
    const exact = questionCatalog.find((question) =>
      normalizedSynonyms.some(
        (candidate) =>
          candidate === question.normalized ||
          candidate === question.keyNormalized,
      ),
    );

    const partial =
      exact ??
      questionCatalog.find((question) =>
        normalizedSynonyms.some(
          (candidate) =>
            question.normalized.includes(candidate) ||
            question.keyNormalized.includes(candidate) ||
            candidate.includes(question.normalized) ||
            candidate.includes(question.keyNormalized),
        ),
      );

    if (partial) {
      mapped[target] = {
        questionId: partial.id,
        key: partial.key,
        label: partial.label,
      };
    }
  }

  return mapped;
}
