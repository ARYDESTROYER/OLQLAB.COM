import { cache } from "react";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { isLiveIdentityActive } from "@/lib/identity-policy";

export const getLiveSession = cache(async () => {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return null;

  const liveUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      tenantId: true,
      tenant: {
        select: {
          type: true,
          isArchived: true,
        },
      },
    },
  });

  if (
    !liveUser ||
    !isLiveIdentityActive({
      role: liveUser.role,
      organisationType: liveUser.tenant.type,
      isArchived: liveUser.tenant.isArchived,
    })
  ) {
    return null;
  }

  session.user.email = liveUser.email;
  session.user.firstName = liveUser.firstName;
  session.user.lastName = liveUser.lastName;
  session.user.role = liveUser.role;
  session.user.tenantId = liveUser.tenantId;

  return { session, liveUser };
});

export async function requireSession() {
  const check = await getLiveSession();
  if (!check) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return check;
}

export async function requireAdmin() {
  const check = await requireSession();
  if ("error" in check) return check;
  if (check.liveUser.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return check;
}

export async function requireLeaderOrAdmin() {
  const check = await requireSession();
  if ("error" in check) return check;
  if (check.liveUser.role !== "LEADER" && check.liveUser.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return check;
}

export async function getLiveAdminSession() {
  return getLivePrivilegedSession(["ADMIN"]);
}

export async function getLiveLeaderOrAdminSession() {
  return getLivePrivilegedSession(["LEADER", "ADMIN"]);
}

async function getLivePrivilegedSession(
  allowedRoles: Array<"ADMIN" | "LEADER">,
) {
  const check = await getLiveSession();
  if (!check) return null;
  return allowedRoles.includes(check.liveUser.role as "ADMIN" | "LEADER")
    ? check
    : null;
}
