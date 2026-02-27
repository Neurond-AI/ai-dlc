"use client";

import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";

interface FormErrors {
  name?: string;
  form?: string;
}

export function ProfileForm() {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Keep name in sync if user changes
  useEffect(() => {
    if (user?.name !== undefined) {
      setName(user.name);
      setIsDirty(false);
    }
  }, [user?.name]);

  const handleNameChange = (value: string) => {
    setName(value);
    setIsDirty(value.trim() !== (user?.name ?? "").trim());
    if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
  };

  const validate = (): boolean => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setErrors({ name: "Name cannot be empty" });
      return false;
    }
    if (trimmed.length > 100) {
      setErrors({ name: "Name must be 100 characters or fewer" });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    setErrors({});

    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      const body = await res.json().catch(() => ({})) as { user?: { id: string; name: string; email: string; image?: string | null }; error?: string };

      if (!res.ok) {
        setErrors({ form: body.error ?? "Failed to update profile. Please try again." });
        return;
      }

      if (body.user && user) {
        setUser({ ...user, name: body.user.name });
      }
      setIsDirty(false);
      toast.success("Profile updated");
    } catch {
      setErrors({ form: "Failed to update profile. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="profile-form">
      {/* Display Name */}
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Display Name</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          onBlur={validate}
          placeholder="Your display name"
          maxLength={100}
          disabled={isSaving}
          aria-describedby={errors.name ? "profile-name-error" : undefined}
          data-testid="profile-name-input"
        />
        {errors.name && (
          <p
            id="profile-name-error"
            role="alert"
            className="text-xs text-destructive"
            aria-live="polite"
            data-testid="profile-name-error"
          >
            {errors.name}
          </p>
        )}
      </div>

      {/* Email (read-only) */}
      <div className="space-y-1.5">
        <Label htmlFor="profile-email">Email</Label>
        <div className="relative">
          <Input
            id="profile-email"
            value={user?.email ?? ""}
            disabled
            readOnly
            aria-disabled="true"
            className="pr-8 text-muted-foreground"
            data-testid="profile-email-input"
          />
          <Lock className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground">
          Your email cannot be changed.
        </p>
      </div>

      {/* Server error */}
      {errors.form && (
        <p
          role="alert"
          className="text-sm text-destructive"
          aria-live="polite"
          data-testid="profile-form-error"
        >
          {errors.form}
        </p>
      )}

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={!isDirty || isSaving}
        data-testid="profile-save-btn"
      >
        {isSaving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}
