import { describe, expect, it } from "vitest";
import { parseRuntimeEnv, validateDeploymentEnv } from "@/lib/env";

const runtimeEnv = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/olqlab",
  NEXTAUTH_SECRET: "a-secure-test-secret-with-32-characters",
  NEXTAUTH_URL: "http://localhost:3000",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "noreply@example.com",
};

describe("environment validation", () => {
  it("requires an explicit public auth URL at runtime", () => {
    expect(() => parseRuntimeEnv({ ...runtimeEnv, NEXTAUTH_URL: undefined })).toThrow();
    expect(parseRuntimeEnv(runtimeEnv).NEXTAUTH_URL).toBe("http://localhost:3000");
  });

  it("requires complete HTTPS production configuration", () => {
    const deploymentEnv = {
      ...runtimeEnv,
      DIRECT_DATABASE_URL: "postgresql://user:password@localhost:5432/olqlab",
      NEXTAUTH_URL: "https://www.olqlab.com",
      REPORT_SHARE_BASE_URL: "https://www.olqlab.com",
      INTERNAL_JOB_SECRET: "internal-job-secret-with-32-characters",
      CRON_SECRET: "cron-secret-that-is-at-least-32-characters",
      BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_test",
      OPENAI_API_KEY: "sk-test",
      REPORT_LLM_MODEL: "test-model",
    };

    expect(validateDeploymentEnv(deploymentEnv).NEXTAUTH_URL).toBe("https://www.olqlab.com");
    expect(() => validateDeploymentEnv({ ...deploymentEnv, NEXTAUTH_URL: "http://olqlab.com" })).toThrow(
      "must use https://",
    );
    expect(
      () =>
        validateDeploymentEnv({
          ...deploymentEnv,
          CRON_SECRET: deploymentEnv.INTERNAL_JOB_SECRET,
        }),
    ).toThrow("must be different from INTERNAL_JOB_SECRET");
  });
});
