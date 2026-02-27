import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create Account - AutoCoder",
  description: "Create your AutoCoder account",
};

export default function RegisterPage() {
  return (
    <div data-testid="register-page">
      <RegisterForm />
    </div>
  );
}
