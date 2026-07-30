import { z } from "zod";

const secureUrl = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:", "must use https://");

const postgresUrl = z
  .string()
  .min(1)
  .refine(
    (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
    "must be a PostgreSQL connection URL",
  );

const runtimeEnvSchema = z.object({
  DATABASE_URL: postgresUrl,
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email(),
  INTERNAL_JOB_SECRET: z.string().min(32).optional(),
  CRON_SECRET: z.string().min(32).optional(),
  REPORT_SHARE_BASE_URL: z.string().url().optional(),
});

const deploymentEnvSchema = runtimeEnvSchema
  .extend({
    DIRECT_DATABASE_URL: postgresUrl,
    NEXTAUTH_URL: secureUrl,
    REPORT_SHARE_BASE_URL: secureUrl.optional(),
    INTERNAL_JOB_SECRET: z.string().min(32),
    CRON_SECRET: z.string().min(32),
    BLOB_READ_WRITE_TOKEN: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    REPORT_LLM_MODEL: z.string().min(1),
  })
  .superRefine((value, context) => {
    if (value.INTERNAL_JOB_SECRET === value.CRON_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["CRON_SECRET"],
        message: "must be different from INTERNAL_JOB_SECRET",
      });
    }
  });

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;
export type DeploymentEnv = z.infer<typeof deploymentEnvSchema>;
type EnvSource = Record<string, string | undefined>;

function runtimeValues(source: EnvSource) {
  return {
    DATABASE_URL: source.DATABASE_URL,
    NEXTAUTH_SECRET: source.NEXTAUTH_SECRET,
    NEXTAUTH_URL: source.NEXTAUTH_URL,
    RESEND_API_KEY: source.RESEND_API_KEY,
    EMAIL_FROM: source.EMAIL_FROM,
    INTERNAL_JOB_SECRET: source.INTERNAL_JOB_SECRET,
    CRON_SECRET: source.CRON_SECRET,
    REPORT_SHARE_BASE_URL: source.REPORT_SHARE_BASE_URL,
  };
}

export function parseRuntimeEnv(source: EnvSource): RuntimeEnv {
  return runtimeEnvSchema.parse(runtimeValues(source));
}

export function validateDeploymentEnv(source: EnvSource): DeploymentEnv {
  return deploymentEnvSchema.parse({
    ...runtimeValues(source),
    DIRECT_DATABASE_URL: source.DIRECT_DATABASE_URL,
    BLOB_READ_WRITE_TOKEN: source.BLOB_READ_WRITE_TOKEN,
    OPENAI_API_KEY: source.OPENAI_API_KEY,
    REPORT_LLM_MODEL: source.REPORT_LLM_MODEL,
  });
}

let cachedEnv: RuntimeEnv | null = null;

export function getEnv() {
  if (cachedEnv) return cachedEnv;
  cachedEnv = parseRuntimeEnv(process.env);
  return cachedEnv;
}
