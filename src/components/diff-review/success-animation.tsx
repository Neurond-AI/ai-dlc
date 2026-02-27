"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

interface SuccessAnimationProps {
  isVisible: boolean;
  onComplete: () => void;
}

export function SuccessAnimation({ isVisible, onComplete }: SuccessAnimationProps) {
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(onComplete, 1500);
    return () => clearTimeout(timer);
  }, [isVisible, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          data-testid="success-animation"
          aria-live="polite"
          aria-label="Task approved successfully"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 15, stiffness: 200 }}
          >
            <CheckCircle2
              className="h-24 w-24 text-emerald-500 drop-shadow-lg"
              data-testid="success-check-icon"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
