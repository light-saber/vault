import { describe, expect, it } from "vitest";
import { dayHeading, relativeDate } from "./dates";

const NOW = new Date("2026-06-11T12:00:00").getTime();

describe("relativeDate", () => {
  it("formats recent times compactly", () => {
    expect(relativeDate(NOW - 30_000, NOW)).toBe("now");
    expect(relativeDate(NOW - 5 * 60_000, NOW)).toBe("5m");
    expect(relativeDate(NOW - 3 * 3_600_000, NOW)).toBe("3h");
  });
  it("returns empty for missing timestamps", () => {
    expect(relativeDate(0, NOW)).toBe("");
  });
});

describe("dayHeading", () => {
  it("labels today and yesterday", () => {
    expect(dayHeading(NOW, NOW)).toBe("Today");
    expect(dayHeading(NOW - 24 * 3_600_000, NOW)).toBe("Yesterday");
  });
});
