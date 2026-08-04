import { describe, expect, it } from "vitest";
import { validateAuthSignInSettings } from "@/lib/admin-auth-settings";

const validSettings = {
  magicLinkExpiryMinutes: 30,
  emailSubjectTemplate: "Your OLQ Lab sign-in link",
  emailTextTemplate: "Continue here: {{magicLinkUrl}}",
  emailHtmlTemplate: '<p><a href="{{magicLinkUrl}}">Continue</a></p>',
};

describe("admin sign-in email settings", () => {
  it("requires the magic link in both rendered message bodies", () => {
    expect(validateAuthSignInSettings(validSettings)).toMatchObject({ ok: true });

    expect(
      validateAuthSignInSettings({
        ...validSettings,
        emailHtmlTemplate: "<p>Continue to OLQ Lab.</p>",
      }),
    ).toMatchObject({
      ok: false,
      error: {
        formErrors: [
          "Both the text and HTML email templates must include {{magicLinkUrl}}.",
        ],
      },
    });

    expect(
      validateAuthSignInSettings({
        ...validSettings,
        emailTextTemplate: "Continue to OLQ Lab.",
      }),
    ).toMatchObject({ ok: false });
  });
});
