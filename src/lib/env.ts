import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email(),
  INTERNAL_JOB_SECRET: z.string().min(1).optional(),
  REPORT_SHARE_BASE_URL: z.string().url().optional(),
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (cachedEnv) return cachedEnv;
  cachedEnv = envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    INTERNAL_JOB_SECRET: process.env.INTERNAL_JOB_SECRET,
    REPORT_SHARE_BASE_URL: process.env.REPORT_SHARE_BASE_URL,
  });
  return cachedEnv;
}
