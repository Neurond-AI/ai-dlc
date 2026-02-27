"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface RequestChangesFormProps {
  onSubmit: (feedback: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

const MAX_CHARS = 5000;
const MIN_CHARS = 10;

export function RequestChangesForm({
  onSubmit,
  onCancel,
  isSubmitting,
}: RequestChangesFormProps) {
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const trimmedLength = feedback.trim().length;
  const isValid = trimmedLength >= MIN_CHARS;
  const charCount = feedback.length;

  const handleBlur = () => {
    setTouched(true);
    if (trimmedLength > 0 && trimmedLength < MIN_CHARS) {
      setError(`Feedback must be at least ${MIN_CHARS} characters`);
    } else {
      setError(null);
    }
  };

  const handleChange = (value: string) => {
    setFeedback(value);
    if (touched && value.trim().length >= MIN_CHARS) {
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setError(null);
    await onSubmit(feedback.trim());
  };

  return (
    <div className="space-y-3 rounded-lg border p-3" data-testid="request-changes-form">
      <Label htmlFor="feedback-textarea" className="text-sm font-medium">
        Describe what needs to change:
      </Label>

      <Textarea
        id="feedback-textarea"
        placeholder="Describe what needs to change... (minimum 10 characters)"
        value={feedback}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        maxLength={MAX_CHARS}
        rows={4}
        disabled={isSubmitting}
        className="resize-none"
        aria-describedby="feedback-error feedback-count"
        data-testid="request-changes-textarea"
      />

      <div className="flex items-center justify-between">
        {error ? (
          <p
            id="feedback-error"
            role="alert"
            className="text-xs text-destructive"
            data-testid="request-changes-error"
          >
            {error}
          </p>
        ) : (
          <span />
        )}
        <span
          id="feedback-count"
          className="text-xs text-muted-foreground"
          aria-live="polite"
          data-testid="request-changes-char-count"
        >
          {charCount}/{MAX_CHARS}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
          data-testid="request-changes-cancel-btn"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          data-testid="request-changes-submit-btn"
        >
          {isSubmitting ? "Submitting..." : "Submit Feedback"}
        </Button>
      </div>
    </div>
  );
}
