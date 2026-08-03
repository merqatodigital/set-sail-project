import { useState, useEffect } from "react";
import { X } from "lucide-react";

const COOKIE_KEY = "cookie_consent_accepted";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const accepted = localStorage.getItem(COOKIE_KEY);
      if (!accepted) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(COOKIE_KEY, "true");
    } catch {
      /* storage full */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#26221C]/10 bg-white px-5 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] sm:px-6">
      <div className="mx-auto flex max-w-4xl items-start gap-4">
        <p className="flex-1 text-[12px] leading-relaxed text-[#26221C]/60 sm:text-[13px]">
          We use essential cookies to make our website work. We'd also like your consent to use cookies to improve your
          experience and analyze site traffic. By clicking "Accept", you agree to our use of cookies as described in our{" "}
          <a href="/privacy" className="underline transition-colors hover:text-[#26221C]">Privacy Policy</a>.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={accept}
            className="rounded-full bg-[#1F3D2B] px-4 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#2A5240] sm:text-[13px]"
          >
            Accept
          </button>
          <button
            onClick={() => setVisible(false)}
            aria-label="Dismiss cookie banner"
            className="rounded-full p-1.5 text-[#26221C]/40 transition-colors hover:text-[#26221C]/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
