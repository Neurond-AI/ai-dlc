import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log In - AutoCoder",
  description: "Log in to your AutoCoder account",
};

export default function LoginPage() {
  return (
    <div data-testid="login-page">
      <LoginForm />
    </div>
  );
}
