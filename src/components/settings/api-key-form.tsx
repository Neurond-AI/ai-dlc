"use client";

import React, { useState, useEffect } from "react";
import { Eye, EyeOff, Check, X, Key } from "lucide-react";
import { toast } from "sonner";
import { apiKeySchema } from "@/lib/validators/auth";
import {
  hasApiKey,
  getStoredApiKey,
  saveApiKey,
  removeApiKey,
} from "@/lib/crypto";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

function maskApiKey(key: string): string {
  if (key.length <= 11) return key.slice(0, 7) + "...";
  return key.slice(0, 7) + "..." + key.slice(-4);
}

export function ApiKeyForm() {
  const { user } = useAuthStore();

  const [keyInput, setKeyInput] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const keyExists = hasApiKey();
    setHasKey(keyExists);
    if (keyExists && user?.id) {
      getStoredApiKey(user.id).then((key) => {
        if (key) setMaskedKey(maskApiKey(key));
      });
    }
  }, [user?.id]);

  function handleStartEdit() {
    setKeyInput("");
    setError(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setKeyInput("");
    setError(null);
    setIsEditing(false);
  }

  async function handleSave() {
    setError(null);
    const result = apiKeySchema.safeParse(keyInput);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? "Invalid API key");
      return;
    }

    if (!user?.id) {
      setError("You must be logged in to save an API key");
      return;
    }

    setIsSaving(true);
    try {
      await saveApiKey(keyInput, user.id);
      setMaskedKey(maskApiKey(keyInput));
      setHasKey(true);
      setIsEditing(false);
      setKeyInput("");
      toast.success("API key saved successfully");
    } catch {
      setError("Failed to save API key. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleRemove() {
    removeApiKey();
    setHasKey(false);
    setMaskedKey("");
    setKeyInput("");
    setIsEditing(false);
    toast.success("API key removed");
  }

  return (
    <div className="space-y-4" data-testid="api-key-form">
      <div>
        <Label className="text-base font-medium">Anthropic API Key</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Required to run AI pipelines. Your key is encrypted and stored
          locally in your browser.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Status indicator */}
      <div
        className="flex items-center gap-2 text-sm"
        data-testid="api-key-status"
      >
        {hasKey ? (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-green-600">API key configured</span>
          </>
        ) : (
          <>
            <X className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">No API key configured</span>
          </>
        )}
      </div>

      {/* Masked display when key exists and not editing */}
      {hasKey && !isEditing && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <code
            className="flex-1 text-sm font-mono"
            data-testid="api-key-masked-display"
          >
            {maskedKey}
          </code>
        </div>
      )}

      {/* Input when editing */}
      {isEditing && (
        <div className="space-y-2">
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-ant-..."
              error={!!error}
              disabled={isSaving}
              className="pr-10"
              data-testid="api-key-input"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Key must start with{" "}
            <code className="font-mono">sk-ant-</code>
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {!hasKey && !isEditing && (
          <Button
            onClick={handleStartEdit}
            variant="outline"
            data-testid="api-key-update-button"
          >
            Add API Key
          </Button>
        )}

        {hasKey && !isEditing && (
          <>
            <Button
              onClick={handleStartEdit}
              variant="outline"
              data-testid="api-key-update-button"
            >
              Update
            </Button>
            <Button
              onClick={handleRemove}
              variant="outline"
              className="text-destructive hover:text-destructive"
              data-testid="api-key-remove-button"
            >
              Remove
            </Button>
          </>
        )}

        {isEditing && (
          <>
            <Button
              onClick={handleSave}
              loading={isSaving}
              disabled={isSaving}
              data-testid="api-key-save-button"
            >
              Save
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              disabled={isSaving}
              data-testid="api-key-cancel-button"
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
