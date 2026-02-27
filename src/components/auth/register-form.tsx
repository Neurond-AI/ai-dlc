"use client";

import React, { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type FieldErrors = Partial<Record<keyof RegisterInput | "form", string>>;

type PasswordStrength = "empty" | "weak" | "fair" | "strong";

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return "empty";
  if (password.length < 8) return "weak";
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  if (hasUpper && hasLower && hasDigit) return "strong";
  return "fair";
}

const strengthConfig: Record<
  Exclude<PasswordStrength, "empty">,
  { label: string; width: string; color: string }
> = {
  weak: { label: "Weak", width: "w-1/3", color: "bg-destructive" },
  fair: { label: "Fair", width: "w-2/3", color: "bg-amber-500" },
  strong: { label: "Strong", width: "w-full", color: "bg-green-500" },
};

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordStrength = getPasswordStrength(password);

  function validateField(field: keyof RegisterInput, value: string) {
    const data = { name, email, password, confirmPassword, [field]: value };
    const result = registerSchema.safeParse(data);
    if (!result.success) {
      const fieldError = result.error.flatten().fieldErrors[field]?.[0];
      const formError = result.error.flatten().formErrors?.[0];
      const refinedError =
        field === "confirmPassword" ? formError : fieldError;
      setErrors((prev) => ({ ...prev, [field]: refinedError ?? fieldError ?? undefined }));
    } else {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = registerSchema.safeParse({ name, email, password, confirmPassword });
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const formErrors = result.error.flatten().formErrors;
      setErrors({
        name: fieldErrors.name?.[0],
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0] ?? formErrors?.[0],
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await authClient.signUp.email(
        { name, email, password, callbackURL: "/board" },
        {
          onSuccess: () => {
            window.location.href = "/board";
          },
          onError: (ctx) => {
            const msg =
              ctx.error.status === 422 || ctx.error.message?.toLowerCase().includes("exists")
                ? "Email already registered"
                : "Something went wrong. Please try again.";
            setErrors({ form: msg });
          },
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Sign up to start using AutoCoder</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {errors.form && (
            <Alert variant="destructive" data-testid="register-form-error">
              <AlertDescription>{errors.form}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => validateField("name", name)}
              error={!!errors.name}
              disabled={isSubmitting}
              placeholder="Your name"
              data-testid="register-name-input"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="reg-email">Email</Label>
            <Input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => validateField("email", email)}
              error={!!errors.email}
              disabled={isSubmitting}
              placeholder="you@example.com"
              data-testid="register-email-input"
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="reg-password">Password</Label>
            <Input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => validateField("password", password)}
              error={!!errors.password}
              disabled={isSubmitting}
              placeholder="••••••••"
              data-testid="register-password-input"
            />
            {/* Password strength indicator */}
            {password && (
              <div className="space-y-1" data-testid="password-strength-indicator">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      passwordStrength !== "empty" &&
                        strengthConfig[passwordStrength].width,
                      passwordStrength !== "empty" &&
                        strengthConfig[passwordStrength].color
                    )}
                  />
                </div>
                {passwordStrength !== "empty" && (
                  <p className="text-xs text-muted-foreground">
                    {strengthConfig[passwordStrength].label}
                  </p>
                )}
              </div>
            )}
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => validateField("confirmPassword", confirmPassword)}
              error={!!errors.confirmPassword}
              disabled={isSubmitting}
              placeholder="••••••••"
              data-testid="register-confirm-password-input"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            loading={isSubmitting}
            disabled={isSubmitting}
            data-testid="register-submit-button"
          >
            Create account
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
              data-testid="register-login-link"
            >
              Log in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
