"use client";

import { useRef, useState, useEffect, useCallback, type RefObject } from "react";
import { AUTO_SCROLL_THRESHOLD_PX } from "@/lib/constants/pipeline-nodes";

export interface UseAutoScrollReturn {
  scrollRef: RefObject<HTMLDivElement | null>;
  isAtBottom: boolean;
  scrollToBottom: () => void;
}

export function useAutoScroll(): UseAutoScrollReturn {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Track scroll position to determine if user is at bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setIsAtBottom(distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll when content changes and user is at bottom
  useEffect(() => {
    if (!isAtBottom || !scrollRef.current) return;

    const el = scrollRef.current;

    const observer = new MutationObserver(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });

    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [isAtBottom]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setIsAtBottom(true);
  }, []);

  return { scrollRef, isAtBottom, scrollToBottom };
}
