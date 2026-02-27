"use client";

import React, { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type FieldErrors = Partial<Record<keyof LoginInput | "form", string>>;

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateField(field: keyof LoginInput, value: string) {
    const partial = field === "email" ? { email: value, password } : { email, password: value };
    const result = loginSchema.safeParse(partial);
    if (!result.success) {
      const fieldError = result.error.flatten().fieldErrors[field]?.[0];
      setErrors((prev) => ({ ...prev, [field]: fieldError ?? undefined }));
    } else {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await authClient.signIn.email(
        { email, password, callbackURL: "/board" },
        {
          onSuccess: () => {
            window.location.href = "/board";
          },
          onError: () => {
            setErrors({ form: "Invalid email or password" });
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
        <CardTitle>Log in</CardTitle>
        <CardDescription>Enter your credentials to access AutoCoder</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {errors.form && (
            <Alert variant="destructive" data-testid="login-form-error">
              <AlertDescription>{errors.form}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => validateField("email", email)}
              error={!!errors.email}
              disabled={isSubmitting}
              placeholder="you@example.com"
              data-testid="login-email-input"
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => validateField("password", password)}
              error={!!errors.password}
              disabled={isSubmitting}
              placeholder="••••••••"
              data-testid="login-password-input"
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            loading={isSubmitting}
            disabled={isSubmitting}
            data-testid="login-submit-button"
          >
            Log in
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-primary hover:underline"
              data-testid="login-register-link"
            >
              Register
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
