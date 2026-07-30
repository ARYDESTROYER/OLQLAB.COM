import { describe, expect, it } from "vitest";
import { authOptions } from "@/lib/auth";

describe("custom NextAuth email provider", () => {
  it("uses the structural Resend provider without a nodemailer runtime provider", () => {
    const provider = authOptions.providers[0];
    expect(typeof provider).toBe("object");
    expect(provider).toMatchObject({ id: "email", type: "email", name: "Email" });
    expect(String(provider)).not.toContain("nodemailer");
  });
});
