import { describe, expect, it } from "vitest";
import {
  buildTallyFieldMaps,
  parseFlowValuesFromMapping,
  toStringArray,
} from "../lib/tallyRuntime";

describe("tally runtime mapping helpers", () => {
  it("resolves mapped values by questionId first, then key", () => {
    const fields = [
      {
        id: "q1",
        key: "question_q1_first_name",
        label: "First Name",
        value: "Alex",
      },
      {
        id: "q2",
        key: "email",
        label: "Email",
        value: "alex@example.com",
      },
    ];

    const maps = buildTallyFieldMaps(fields);
    const parsed = parseFlowValuesFromMapping(maps, {
      firstName: { questionId: "q1", key: "ignored" },
      email: { key: "email" },
    });

    expect(parsed.firstName).toBe("Alex");
    expect(parsed.email).toBe("alex@example.com");
  });

  it("normalizes arrays and option ids", () => {
    const fields = [
      {
        id: "q3",
        key: "pets",
        value: ["option_1", "option_2"],
        options: [
          { id: "option_1", text: "Dog" },
          { id: "option_2", text: "Cat" },
        ],
      },
    ];

    const maps = buildTallyFieldMaps(fields);
    const parsed = parseFlowValuesFromMapping(maps, {
      pets: { questionId: "q3" },
    });

    expect(toStringArray(parsed.pets)).toEqual(["Dog", "Cat"]);
  });

  it("handles comma-delimited strings for array targets", () => {
    expect(toStringArray("A, B, C")).toEqual(["A", "B", "C"]);
  });
});
