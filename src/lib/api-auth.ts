import { getServerAuthSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function requireSession() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}

export async function requireAdmin() {
  const check = await requireSession();
  if ("error" in check) return check;
  if (check.session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return check;
}
