import { list, put } from "@vercel/blob";
import { z } from "zod";

const AUTH_SETTINGS_BLOB_PATH = "admin-settings/auth-signin.json";
const CACHE_TTL_MS = 60_000;

const allowedExpiryOptions = [2, 5, 10, 20, 30, 60, 360] as const;

export type MagicLinkExpiryMinutes = (typeof allowedExpiryOptions)[number];

export const signInEmailTemplateVariables = [
  "{{firstName}}",
  "{{lastName}}",
  "{{fullName}}",
  "{{magicLinkUrl}}",
  "{{expiryLabel}}",
] as const;

const settingsSchema = z.object({
  magicLinkExpiryMinutes: z.union([
    z.literal(2),
    z.literal(5),
    z.literal(10),
    z.literal(20),
    z.literal(30),
    z.literal(60),
    z.literal(360),
  ]),
  emailSubjectTemplate: z.string().min(1).max(160),
  emailTextTemplate: z.string().min(1).max(20_000),
  emailHtmlTemplate: z.string().min(1).max(40_000),
});

export type AuthSignInSettings = z.infer<typeof settingsSchema>;

const defaultSettings: AuthSignInSettings = {
  magicLinkExpiryMinutes: 30,
  emailSubjectTemplate: "Your OLQLab sign-in link",
  emailTextTemplate:
    "Hey {{fullName}}, click this secure sign-in link for OLQLab: {{magicLinkUrl}}\\n\\nThis link expires in {{expiryLabel}}.\\n\\nIf you did not request this link, you can safely ignore this email.\\n\\nRegards\\nOLQLab Admin.",
  emailHtmlTemplate:
    "<p>Hey {{fullName}}, <a href=\"{{magicLinkUrl}}\">click this secure sign-in link</a> for OLQLab.</p><p>This link expires in {{expiryLabel}}.</p><p>If you did not request this link, you can safely ignore this email.</p><p>Regards<br />OLQLab Admin.</p>",
};

const supportedTemplateTokens = new Set(signInEmailTemplateVariables);
const supportedTemplateTokenList = Array.from(supportedTemplateTokens);

function isSupportedTemplateToken(token: string): token is (typeof signInEmailTemplateVariables)[number] {
  return supportedTemplateTokenList.includes(token as (typeof signInEmailTemplateVariables)[number]);
}

let settingsCache: { settings: AuthSignInSettings; expiresAt: number } | null = null;

export function getAllowedMagicLinkExpiryOptions() {
  return allowedExpiryOptions;
}

export function getDefaultAuthSignInSettings() {
  return { ...defaultSettings };
}

export function formatMagicLinkExpiryLabel(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "30 minutes";
  if (minutes === 60) return "1 hour";
  if (minutes === 360) return "6 hours";
  return `${minutes} minutes`;
}

function getBlobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || "";
}

function isCacheFresh() {
  return Boolean(settingsCache && settingsCache.expiresAt > Date.now());
}

function touchCache(settings: AuthSignInSettings) {
  settingsCache = {
    settings,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
}

function getCachedOrDefaultSettings() {
  return settingsCache?.settings || getDefaultAuthSignInSettings();
}

function normalizeSettings(input: AuthSignInSettings): AuthSignInSettings {
  return {
    magicLinkExpiryMinutes: input.magicLinkExpiryMinutes,
    emailSubjectTemplate: input.emailSubjectTemplate.trim(),
    emailTextTemplate: input.emailTextTemplate.trim(),
    emailHtmlTemplate: input.emailHtmlTemplate.trim(),
  };
}

async function readSettingsFromBlobStore() {
  const token = getBlobToken();
  if (!token) return null;

  const listing = await list({ prefix: AUTH_SETTINGS_BLOB_PATH, token, limit: 10 });
  const matched = listing.blobs.find((blob) => blob.pathname === AUTH_SETTINGS_BLOB_PATH);
  if (!matched) return null;

  const response = await fetch(matched.url, { cache: "no-store" });
  if (!response.ok) return null;

  const payload = await response.json();
  const parsed = settingsSchema.safeParse(payload);
  if (!parsed.success) return null;
  return normalizeSettings(parsed.data);
}

export async function getAuthSignInSettings(): Promise<AuthSignInSettings> {
  if (isCacheFresh()) return settingsCache!.settings;

  try {
    const fromStore = await readSettingsFromBlobStore();
    if (fromStore) {
      touchCache(fromStore);
      return fromStore;
    }
  } catch (error) {
    console.error("Failed to read auth sign-in settings from Blob store:", error);
  }

  const fallback = getCachedOrDefaultSettings();
  touchCache(fallback);
  return fallback;
}

export function validateAuthSignInSettings(input: unknown) {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.flatten(),
    };
  }

  const normalized = normalizeSettings(parsed.data);

  const discoveredTokens = Array.from(
    new Set(
      [
        normalized.emailSubjectTemplate,
        normalized.emailTextTemplate,
        normalized.emailHtmlTemplate,
      ]
        .join("\n")
        .match(/\{\{\s*[a-zA-Z]+\s*\}\}/g) || [],
    ),
  ).map((token) => token.replaceAll(/\s+/g, ""));

  const unsupportedTokens = discoveredTokens.filter((token) => !isSupportedTemplateToken(token));
  if (unsupportedTokens.length > 0) {
    return {
      ok: false as const,
      error: {
        formErrors: [
          `Unsupported template variables: ${unsupportedTokens.join(", ")}. Use only ${Array.from(supportedTemplateTokens).join(", ")}.`,
        ],
        fieldErrors: {},
      },
    };
  }

  const missingLinkTemplates = [
    ["emailTextTemplate", normalized.emailTextTemplate],
    ["emailHtmlTemplate", normalized.emailHtmlTemplate],
  ].filter(([, template]) => !template.includes("{{magicLinkUrl}}"));

  if (missingLinkTemplates.length > 0) {
    return {
      ok: false as const,
      error: {
        formErrors: [
          "Both the text and HTML email templates must include {{magicLinkUrl}}.",
        ],
        fieldErrors: {},
      },
    };
  }

  return {
    ok: true as const,
    value: normalized,
  };
}

export async function saveAuthSignInSettings(input: AuthSignInSettings) {
  const token = getBlobToken();
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is missing. Configure Blob storage to save admin settings.");
  }

  await put(AUTH_SETTINGS_BLOB_PATH, JSON.stringify(input, null, 2), {
    access: "public",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });

  touchCache(input);
  return input;
}

export function renderSignInEmailTemplate(input: {
  template: string;
  firstName: string;
  lastName: string;
  fullName: string;
  magicLinkUrl: string;
  expiryLabel: string;
}) {
  const replacements: Record<(typeof signInEmailTemplateVariables)[number], string> = {
    "{{firstName}}": input.firstName,
    "{{lastName}}": input.lastName,
    "{{fullName}}": input.fullName,
    "{{magicLinkUrl}}": input.magicLinkUrl,
    "{{expiryLabel}}": input.expiryLabel,
  };

  let rendered = input.template;
  for (const [token, replacement] of Object.entries(replacements) as Array<
    [(typeof signInEmailTemplateVariables)[number], string]
  >) {
    const tokenName = token.slice(2, -2);
    const matcher = new RegExp(`\\{\\{\\s*${tokenName}\\s*\\}\\}`, "g");
    rendered = rendered.replace(matcher, replacement);
  }
  return rendered;
}
