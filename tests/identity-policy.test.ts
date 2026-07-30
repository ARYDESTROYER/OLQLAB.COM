import { describe, expect, it } from "vitest";
import {
  assertAdminRoleChangeAllowed,
  assertRoleAllowedInOrganisation,
  isLiveIdentityActive,
  validateUnenrollDelivery,
} from "@/lib/identity-policy";

describe("identity invariants", () => {
  it("blocks solo admins, archived identities, self-demotion, and last-admin demotion", () => {
    expect(() =>
      assertRoleAllowedInOrganisation({
        role: "ADMIN",
        organisationType: "SOLO",
        isArchived: false,
      }),
    ).toThrow(/Organisation/);
    expect(isLiveIdentityActive({ role: "EMPLOYEE", organisationType: "SOLO", isArchived: true })).toBe(false);
    expect(() =>
      assertAdminRoleChangeAllowed({
        actorId: "admin-1",
        targetId: "admin-1",
        currentRole: "ADMIN",
        nextRole: "EMPLOYEE",
        activeAdminCount: 2,
      }),
    ).toThrow(/own admin role/);
    expect(() =>
      assertAdminRoleChangeAllowed({
        actorId: "admin-2",
        targetId: "admin-1",
        currentRole: "ADMIN",
        nextRole: "EMPLOYEE",
        activeAdminCount: 1,
      }),
    ).toThrow(/last active admin/);
  });

  it("requires link-only delivery to have email and a bounded TTL", () => {
    expect(() =>
      validateUnenrollDelivery({
        reportMode: "LINK_ONLY",
        notifyByEmail: false,
        linkTtlHours: 24,
      }),
    ).toThrow(/requires email delivery/);
    expect(() =>
      validateUnenrollDelivery({
        reportMode: "LINK_ONLY",
        notifyByEmail: true,
        linkTtlHours: 721,
      }),
    ).toThrow(/between 1 and 720/);
  });
});
