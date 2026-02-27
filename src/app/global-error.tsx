"use client";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            padding: "16px",
          }}
          data-testid="global-error-boundary"
        >
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 600 }}>
              Something went wrong.
            </h2>
            <p style={{ marginTop: "8px", fontSize: "14px", color: "#6b7280" }}>
              A critical error occurred. Please refresh the page.
            </p>
          </div>
          <button
            onClick={reset}
            style={{
              padding: "8px 16px",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              background: "white",
              cursor: "pointer",
            }}
            data-testid="global-error-reset-button"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
