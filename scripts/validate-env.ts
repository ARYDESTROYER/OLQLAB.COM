import { ZodError } from "zod";
import { validateDeploymentEnv } from "../src/lib/env";

try {
  validateDeploymentEnv(process.env);
  console.log("Production environment validation passed.");
} catch (error) {
  if (error instanceof ZodError) {
    console.error("Production environment validation failed:");
    for (const issue of error.issues) {
      console.error(`- ${issue.path.join(".") || "environment"}: ${issue.message}`);
    }
    process.exit(1);
  }
  throw error;
}
