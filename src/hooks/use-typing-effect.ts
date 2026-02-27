"use client";

import { useState, useEffect, useRef } from "react";
import type { UseTypingEffectOptions, UseTypingEffectReturn } from "@/types/pipeline-ui";
import { TYPING_CHARS_PER_FRAME, TYPING_FRAME_INTERVAL_MS } from "@/lib/constants/pipeline-nodes";

export function useTypingEffect({
  text,
  charsPerFrame = TYPING_CHARS_PER_FRAME,
  frameInterval = TYPING_FRAME_INTERVAL_MS,
  enabled = true,
}: UseTypingEffectOptions): UseTypingEffectReturn {
  const [displayedText, setDisplayedText] = useState(enabled ? "" : text);
  const [isTyping, setIsTyping] = useState(enabled && text.length > 0);

  const indexRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text);
      setIsTyping(false);
      return;
    }

    // If index is ahead of new text length, reset (shouldn't happen but guard)
    if (indexRef.current > text.length) {
      indexRef.current = 0;
    }

    setIsTyping(true);

    // Cancel any previous rAF loop
    if (rafRef.current !== undefined) {
      cancelAnimationFrame(rafRef.current);
    }

    const animate = (timestamp: number) => {
      if (timestamp - lastTimeRef.current >= frameInterval) {
        lastTimeRef.current = timestamp;

        const nextIndex = Math.min(indexRef.current + charsPerFrame, text.length);
        indexRef.current = nextIndex;
        setDisplayedText(text.slice(0, nextIndex));

        if (nextIndex >= text.length) {
          setIsTyping(false);
          return; // Stop loop
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
      }
    };
  }, [text, charsPerFrame, frameInterval, enabled]);

  return { displayedText, isTyping };
}
