import { db } from "@/lib/db";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";

export type AdminUserStats = {
  usersTotal: number;
  usersParticipants: number;
  usersAdmins: number;
  usersInArchivedTenants: number;
  usersInSoloTenants: number;
};

export async function getAdminUserStats(): Promise<AdminUserStats> {
  try {
    const [usersTotal, usersParticipants, usersAdmins, usersInArchivedTenants, usersInSoloTenants] =
      await Promise.all([
        db.user.count(),
        db.user.count({
          where: {
            role: {
              in: ["EMPLOYEE", "LEADER"],
            },
          },
        }),
        db.user.count({ where: { role: "ADMIN" } }),
        db.user.count({
          where: {
            tenant: {
              isArchived: true,
            },
          },
        }),
        db.user.count({
          where: {
            tenant: {
              type: "SOLO",
            },
          },
        }),
      ]);

    return {
      usersTotal,
      usersParticipants,
      usersAdmins,
      usersInArchivedTenants,
      usersInSoloTenants,
    };
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;

    const [usersTotal, usersParticipants, usersAdmins] = await Promise.all([
      db.user.count(),
      db.user.count({
        where: {
          role: {
            in: ["EMPLOYEE", "LEADER"],
          },
        },
      }),
      db.user.count({ where: { role: "ADMIN" } }),
    ]);

    return {
      usersTotal,
      usersParticipants,
      usersAdmins,
      usersInArchivedTenants: 0,
      usersInSoloTenants: 0,
    };
  }
}
