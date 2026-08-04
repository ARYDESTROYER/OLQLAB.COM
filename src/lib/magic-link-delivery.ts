import { EmailDeliveryError } from "@/lib/resend";

type DeliveryLogger = (
  message: string,
  metadata: {
    errorName: string;
    providerCode?: string;
    statusCode?: number | null;
  },
) => void;

function describeDeliveryError(error: unknown) {
  if (error instanceof EmailDeliveryError) {
    return {
      errorName: error.name,
      providerCode: error.providerCode,
      statusCode: error.statusCode,
    };
  }

  return {
    errorName: error instanceof Error ? error.name : "UnknownError",
  };
}

export async function attemptMagicLinkDelivery(
  deliver: () => Promise<unknown>,
  log: DeliveryLogger = console.error,
) {
  try {
    await deliver();
    return true;
  } catch (error) {
    // Do not rethrow: eligible-provider-failure and suppressed recipients must
    // retain the same generic outward response. Log only non-PII diagnostics.
    log(
      "Magic-link provider delivery failed after request acceptance.",
      describeDeliveryError(error),
    );
    return false;
  }
}
