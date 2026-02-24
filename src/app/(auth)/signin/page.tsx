import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import SignInForm from "./SignInForm";

export default async function SignInPage() {
  const session = await getServerAuthSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  return <SignInForm />;
}
