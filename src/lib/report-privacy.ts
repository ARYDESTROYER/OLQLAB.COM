import { createHash } from "node:crypto";

export function participantReference(userId: string) {
  return `participant-${createHash("sha256")
    .update(`olqlab-report:${userId}`)
    .digest("hex")
    .slice(0, 16)}`;
}
