import { redirect } from "next/navigation";
import { getLiveSession } from "@/lib/api-auth";
import PublicHeader from "@/components/navigation/PublicHeader";
import { EditorialFooter } from "@/components/marketing/Editorial";
import { normalizeSignInEmailPrefill } from "@/lib/signin-prefill";
import SignInForm from "./SignInForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const check = await getLiveSession();
  if (check) {
    redirect("/dashboard");
  }
  const params = await searchParams;
  const initialEmail = normalizeSignInEmailPrefill(params.email);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#EFE8DA] text-[#101114]">
      <a className="skip-link" href="#signin-content">
        Skip to content
      </a>
      <PublicHeader />
      <main id="signin-content" className="scroll-mt-24 flex-1" tabIndex={-1}>
        <SignInForm initialEmail={initialEmail} />
      </main>
      <EditorialFooter />
    </div>
  );
}
