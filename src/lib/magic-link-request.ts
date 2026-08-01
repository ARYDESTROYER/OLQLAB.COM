export type MagicLinkSignInResponse = {
  error?: string | null;
  ok?: boolean;
  status?: number;
  url?: string | null;
};

type MagicLinkSignInRequest = (
  provider: "email",
  options: {
    email: string;
    redirect: false;
    callbackUrl: string;
  },
) => Promise<MagicLinkSignInResponse | undefined>;

export function isAcceptedMagicLinkRequest(
  response: MagicLinkSignInResponse | undefined,
) {
  // NextAuth v4 represents email-flow redirects, including provider errors, as
  // an HTTP-200 client result. Keep the outward state generic so a provider
  // outage cannot become an account-enumeration side channel. Operational
  // delivery failures are logged at the server boundary instead.
  return Boolean(response?.ok);
}

export async function requestMagicLink(input: {
  email: string;
  signInRequest: MagicLinkSignInRequest;
}) {
  try {
    const response = await input.signInRequest("email", {
      email: input.email,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    return isAcceptedMagicLinkRequest(response) ? "accepted" : "error";
  } catch {
    return "error";
  }
}
