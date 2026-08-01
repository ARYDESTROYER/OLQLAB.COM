export type AccountRole = "ADMIN" | "EMPLOYEE" | "LEADER";
export type OrganisationType = "ORGANIZATION" | "SOLO";

export class IdentityPolicyError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "IdentityPolicyError";
    this.code = code;
    this.status = status;
  }
}

export function assertRoleAllowedInOrganisation(input: {
  role: AccountRole;
  organisationType: OrganisationType;
  isArchived: boolean;
}) {
  if (input.isArchived) {
    throw new IdentityPolicyError(
      "ORGANISATION_ARCHIVED",
      "Organisation is archived. Restore it before changing accounts.",
    );
  }

  if (input.role === "ADMIN" && input.organisationType !== "ORGANIZATION") {
    throw new IdentityPolicyError(
      "ADMIN_REQUIRES_ORGANISATION",
      "Admin accounts must belong to an Organisation.",
    );
  }
}

export function assertAdminRoleChangeAllowed(input: {
  actorId: string;
  targetId: string;
  currentRole: AccountRole;
  nextRole: AccountRole;
  activeAdminCount: number;
}) {
  if (input.currentRole !== "ADMIN" || input.nextRole === "ADMIN") return;

  if (input.actorId === input.targetId) {
    throw new IdentityPolicyError(
      "SELF_ADMIN_DEMOTION",
      "You cannot remove your own admin role.",
      409,
    );
  }

  if (input.activeAdminCount <= 1) {
    throw new IdentityPolicyError(
      "LAST_ADMIN_DEMOTION",
      "The last active admin cannot be demoted.",
      409,
    );
  }
}

export function validateUnenrollDelivery(input: {
  reportMode: "KEEP_APP_ACCESS" | "LINK_ONLY" | "REVOKE";
  notifyByEmail: boolean;
  linkTtlHours?: number | null;
}) {
  if (input.reportMode === "LINK_ONLY" && !input.notifyByEmail) {
    throw new IdentityPolicyError(
      "LINK_ONLY_REQUIRES_EMAIL",
      "Link-only report access requires email delivery so the participant receives a usable link.",
    );
  }

  if (
    input.reportMode === "LINK_ONLY" &&
    input.linkTtlHours !== undefined &&
    input.linkTtlHours !== null &&
    (!Number.isInteger(input.linkTtlHours) || input.linkTtlHours < 1 || input.linkTtlHours > 720)
  ) {
    throw new IdentityPolicyError(
      "INVALID_LINK_TTL",
      "Link expiry must be a whole number of hours between 1 and 720.",
    );
  }
}

export function isAuthenticationIdentityActive(input: {
  role: AccountRole;
  organisationType: OrganisationType;
  isArchived: boolean;
}) {
  // Role/organisation compatibility is a write-time invariant enforced by
  // assertRoleAllowedInOrganisation(). Authentication remains compatible with
  // already-persisted identities, including legacy Solo administrators.
  return !input.isArchived;
}

export function isLiveIdentityActive(input: {
  role: AccountRole;
  organisationType: OrganisationType;
  isArchived: boolean;
}) {
  return isAuthenticationIdentityActive(input);
}
