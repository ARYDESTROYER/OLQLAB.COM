import { describe, expect, it } from "vitest";
import {
  assertAdminRoleChangeAllowed,
  assertRoleAllowedInOrganisation,
  isAuthenticationIdentityActive,
  isLiveIdentityActive,
  validateUnenrollDelivery,
} from "@/lib/identity-policy";

describe("identity invariants", () => {
  it("blocks creating Solo admins, self-demotion, and last-admin demotion", () => {
    expect(() =>
      assertRoleAllowedInOrganisation({
        role: "ADMIN",
        organisationType: "SOLO",
        isArchived: false,
      }),
    ).toThrow(/Organisation/);
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

  it("keeps every active persisted identity authenticatable, including Solo admins", () => {
    const roles = ["ADMIN", "EMPLOYEE", "LEADER"] as const;
    const organisationTypes = ["ORGANIZATION", "SOLO"] as const;

    for (const role of roles) {
      for (const organisationType of organisationTypes) {
        const identity = { role, organisationType, isArchived: false };
        expect(isAuthenticationIdentityActive(identity)).toBe(true);
        expect(isLiveIdentityActive(identity)).toBe(true);
        expect(
          isAuthenticationIdentityActive({ ...identity, isArchived: true }),
        ).toBe(false);
        expect(isLiveIdentityActive({ ...identity, isArchived: true })).toBe(false);
      }
    }
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
