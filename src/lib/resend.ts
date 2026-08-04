import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailRequestOptions,
  type CreateEmailResponse,
  type CreateEmailResponseSuccess,
} from "resend";
import { getEnv } from "@/lib/env";

let client: Resend | null = null;

export function getResend() {
  if (client) return client;
  client = new Resend(getEnv().RESEND_API_KEY);
  return client;
}

export class EmailDeliveryError extends Error {
  readonly providerCode: string;
  readonly statusCode: number | null;

  constructor(input: {
    message: string;
    providerCode: string;
    statusCode: number | null;
  }) {
    super(input.message);
    this.name = "EmailDeliveryError";
    this.providerCode = input.providerCode;
    this.statusCode = input.statusCode;
  }
}

export function assertEmailDelivered(
  result: CreateEmailResponse,
): CreateEmailResponseSuccess {
  if (result.error) {
    throw new EmailDeliveryError({
      message: `Email provider rejected the message: ${result.error.message}`,
      providerCode: result.error.name,
      statusCode: result.error.statusCode,
    });
  }

  if (!result.data?.id) {
    throw new EmailDeliveryError({
      message: "Email provider returned no delivery identifier.",
      providerCode: "missing_delivery_id",
      statusCode: null,
    });
  }

  return result.data;
}

export async function sendEmailOrThrow(
  payload: CreateEmailOptions,
  options?: CreateEmailRequestOptions,
) {
  const result = await getResend().emails.send(payload, options);
  return assertEmailDelivered(result);
}
