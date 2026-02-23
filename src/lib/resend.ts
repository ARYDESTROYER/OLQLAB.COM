import { Resend } from "resend";
import { getEnv } from "@/lib/env";

let client: Resend | null = null;

export function getResend() {
  if (client) return client;
  client = new Resend(getEnv().RESEND_API_KEY);
  return client;
}
