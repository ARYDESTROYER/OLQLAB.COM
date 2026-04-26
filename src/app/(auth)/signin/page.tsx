import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import PublicHeader from "@/components/navigation/PublicHeader";
import { EditorialFooter } from "@/components/marketing/Editorial";
import SignInForm from "./SignInForm";

export default async function SignInPage() {
  const session = await getServerAuthSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-[#EFE8DA] text-[#101114]">
      <PublicHeader />
      <div className="flex-1">
        <SignInForm />
      </div>
      <EditorialFooter />
    </main>
  );
}
