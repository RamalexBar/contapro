import { describe, expect, it } from "vitest";
import { normalizeToE164 } from "./normalize-phone";

describe("normalizeToE164", () => {
  it("prepends the default country code to a 10-digit Colombian mobile number", () => {
    expect(normalizeToE164("3001234567")).toBe("573001234567");
  });

  it("strips spaces, dashes and parentheses before normalizing", () => {
    expect(normalizeToE164("(300) 123-4567")).toBe("573001234567");
  });

  it("leaves a number that already includes the country code untouched", () => {
    expect(normalizeToE164("573001234567")).toBe("573001234567");
  });

  it("respects a custom default country code", () => {
    expect(normalizeToE164("3001234567", "1")).toBe("13001234567");
  });
});
