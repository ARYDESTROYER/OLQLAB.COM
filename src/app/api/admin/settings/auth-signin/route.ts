import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { recordAuditLog } from "@/lib/audit-log";
import {
  getAllowedMagicLinkExpiryOptions,
  getAuthSignInSettings,
  getDefaultAuthSignInSettings,
  saveAuthSignInSettings,
  signInEmailTemplateVariables,
  validateAuthSignInSettings,
} from "@/lib/admin-auth-settings";

function buildReadonlyPayload(settings: Awaited<ReturnType<typeof getAuthSignInSettings>>) {
  return {
    settings,
    defaults: getDefaultAuthSignInSettings(),
    options: {
      magicLinkExpiryMinutes: getAllowedMagicLinkExpiryOptions(),
      templateVariables: [...signInEmailTemplateVariables],
    },
    storage: {
      writable: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      reason: process.env.BLOB_READ_WRITE_TOKEN
        ? null
        : "BLOB_READ_WRITE_TOKEN is not configured. Settings are currently read-only defaults.",
    },
  };
}

export async function GET() {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const settings = await getAuthSignInSettings();
  return NextResponse.json(buildReadonlyPayload(settings));
}

export async function PATCH(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const body = await req.json().catch(() => null);
  const validated = validateAuthSignInSettings(body);
  if (!validated.ok) {
    return NextResponse.json(
      {
        error: "Invalid settings payload.",
        details: validated.error,
      },
      { status: 400 },
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Settings storage is not configured. Add BLOB_READ_WRITE_TOKEN to update sign-in settings.",
      },
      { status: 503 },
    );
  }

  const previous = await getAuthSignInSettings();
  const saved = await saveAuthSignInSettings(validated.value);
  await recordAuditLog({
    tenantId: check.session.user.tenantId,
    actorId: check.session.user.id,
    action: "auth.signin_settings.updated",
    metadata: {
      previousExpiryMinutes: previous.magicLinkExpiryMinutes,
      expiryMinutes: saved.magicLinkExpiryMinutes,
      subjectChanged: previous.emailSubjectTemplate !== saved.emailSubjectTemplate,
      textTemplateChanged: previous.emailTextTemplate !== saved.emailTextTemplate,
      htmlTemplateChanged: previous.emailHtmlTemplate !== saved.emailHtmlTemplate,
    },
  });
  return NextResponse.json({
    ok: true,
    ...buildReadonlyPayload(saved),
  });
}
