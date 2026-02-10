import type { TallyFieldRef, TallyFlowMappings } from "./tallyMappings";

export type TallyFieldMaps = {
  byQuestionId: Record<string, any>;
  byKey: Record<string, any>;
  byLabel: Record<string, any>;
};

function normalizeToken(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

export function deriveIdFromFieldKey(key: any): string | undefined {
  if (typeof key !== "string") {
    return undefined;
  }
  if (!key.startsWith("question_")) {
    return undefined;
  }
  const withoutPrefix = key.slice("question_".length);
  const [shortId] = withoutPrefix.split("_");
  return shortId && shortId.length > 0 ? shortId : undefined;
}

export function normalizeFieldValue(field: any): any {
  const raw = field?.value === null ? undefined : field?.value;
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      return undefined;
    }
    if (Array.isArray(field?.options)) {
      const optionById = new Map(
        field.options
          .filter((option: any) => option?.id !== undefined)
          .map((option: any) => [String(option.id), option.text]),
      );
      const mapped = raw.map((entry) => optionById.get(String(entry)) ?? String(entry));
      return mapped.length === 1 ? mapped[0] : mapped;
    }
    return raw.length === 1 ? raw[0] : raw;
  }
  return raw;
}

export function buildTallyFieldMaps(fields: any[]): TallyFieldMaps {
  const byQuestionId: Record<string, any> = {};
  const byKey: Record<string, any> = {};
  const byLabel: Record<string, any> = {};

  for (const field of fields) {
    const value = normalizeFieldValue(field);
    const id = field?.id ?? field?.questionId ?? field?.fieldId;
    const derivedId = deriveIdFromFieldKey(field?.key);

    if (id && byQuestionId[id] === undefined) {
      byQuestionId[id] = value;
    }
    if (!id && derivedId && byQuestionId[derivedId] === undefined) {
      byQuestionId[derivedId] = value;
    }

    if (field?.key && byKey[field.key] === undefined) {
      byKey[field.key] = value;
    }

    const label = field?.label ?? field?.title ?? field?.name;
    if (typeof label === "string") {
      const normalized = normalizeToken(label);
      if (normalized.length > 0 && byLabel[normalized] === undefined) {
        byLabel[normalized] = value;
      }
    }
  }

  return { byQuestionId, byKey, byLabel };
}

export function resolveMappedFieldValue(
  maps: TallyFieldMaps,
  ref?: TallyFieldRef,
): any {
  if (!ref) {
    return undefined;
  }

  if (ref.questionId && maps.byQuestionId[ref.questionId] !== undefined) {
    return maps.byQuestionId[ref.questionId];
  }

  if (ref.key && maps.byKey[ref.key] !== undefined) {
    return maps.byKey[ref.key];
  }

  if (ref.label) {
    const normalized = normalizeToken(ref.label);
    if (maps.byLabel[normalized] !== undefined) {
      return maps.byLabel[normalized];
    }
  }

  return undefined;
}

export function parseFlowValuesFromMapping(
  maps: TallyFieldMaps,
  flowMappings: TallyFlowMappings | undefined,
): Record<string, any> {
  if (!flowMappings) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(flowMappings).map(([target, ref]) => [
      target,
      resolveMappedFieldValue(maps, ref),
    ]),
  );
}

export function toStringArray(value: any): string[] | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  if (typeof value === "object") {
    const flattened = Object.values(value).flatMap((entry) =>
      Array.isArray(entry) ? entry : [entry],
    );
    return flattened
      .map((entry) => String(entry))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return [String(value)];
}

export function readHiddenField(fields: any[], key: string): string | undefined {
  const derivedKey = deriveIdFromFieldKey(key);
  for (const field of fields) {
    if (
      field?.key === key ||
      field?.id === key ||
      field?.label === key ||
      field?.name === key ||
      (derivedKey &&
        (field?.id === derivedKey ||
          field?.questionId === derivedKey ||
          field?.fieldId === derivedKey))
    ) {
      return field.value;
    }
  }
  return undefined;
}
