import { useState, useEffect } from "react";
import { X, Settings } from "lucide-react";

const COOKIE_KEY = "cookie_consent";
type ConsentChoice = "accepted" | "rejected" | "granular";

interface CookiePreferences {
  essential: boolean; // always true
  analytics: boolean;
  marketing: boolean;
}

const DEFAULTPrefs: CookiePreferences = { essential: true, analytics: false, marketing: false };

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState<CookiePreferences>(DEFAULTPrefs);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_KEY);
      if (!stored) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const save = (choice: ConsentChoice, p?: CookiePreferences) => {
    try {
      localStorage.setItem(COOKIE_KEY, choice);
      if (p) localStorage.setItem("cookie_preferences", JSON.stringify(p));
    } catch { /* storage full */ }
    setVisible(false);
  };

  const acceptAll = () => save("accepted", { essential: true, analytics: true, marketing: true });

  const rejectAll = () => save("rejected", DEFAULTPrefs);

  const saveGranular = () => save("granular", prefs);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[45vh] overflow-y-auto border-t border-[#26221C]/10 bg-white px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] sm:max-h-none sm:px-6 sm:py-4">
      <div className="mx-auto max-w-4xl">
        {!showSettings ? (
          /* Main banner */
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-[#26221C]/60 sm:text-[13px]">
              <span className="hidden sm:inline">
                We use essential cookies to make our website work. We'd also like your consent to use cookies to improve
                your experience and analyze site traffic. You can accept all, reject non-essential, or customize your
                preferences. See our{" "}
              </span>
              <span className="sm:hidden">
                We use cookies to run this site and improve your experience. See our{" "}
              </span>
              <a href="/privacy" className="underline transition-colors hover:text-[#26221C]">Privacy Policy</a> for details.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={acceptAll}
                className="flex-1 rounded-full bg-[#1F3D2B] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#2A5240] sm:flex-none sm:px-4 sm:text-[13px]"
              >
                Accept All
              </button>
              <button
                onClick={rejectAll}
                className="flex-1 whitespace-nowrap rounded-full border border-[#26221C]/20 px-3 py-1.5 text-[12px] font-medium text-[#26221C]/70 transition-colors hover:bg-[#26221C]/5 sm:flex-none sm:px-4 sm:text-[13px]"
              >
                <span className="sm:hidden">Reject</span>
                <span className="hidden sm:inline">Reject Non-Essential</span>
              </button>
              <button
                onClick={() => setShowSettings(true)}
                aria-label="Cookie settings"
                className="shrink-0 rounded-full p-1.5 text-[#26221C]/40 transition-colors hover:text-[#26221C]/70"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                onClick={() => save("rejected")}
                aria-label="Dismiss cookie banner"
                className="shrink-0 rounded-full p-1.5 text-[#26221C]/40 transition-colors hover:text-[#26221C]/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Granular settings */
          <div className="space-y-3">
            <p className="text-[12px] font-medium text-[#26221C] sm:text-[13px]">Cookie Preferences</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 text-[12px] text-[#26221C]/70 sm:text-[13px]">
                <input type="checkbox" checked disabled className="h-4 w-4 accent-[#1F3D2B]" />
                <span><strong>Essential</strong> — Required for the site to function (always on)</span>
              </label>
              <label className="flex items-center gap-3 text-[12px] text-[#26221C]/70 sm:text-[13px]">
                <input
                  type="checkbox"
                  checked={prefs.analytics}
                  onChange={(e) => setPrefs((p) => ({ ...p, analytics: e.target.checked }))}
                  className="h-4 w-4 accent-[#1F3D2B]"
                />
                <span><strong>Analytics</strong> — Help us understand how visitors use the site</span>
              </label>
              <label className="flex items-center gap-3 text-[12px] text-[#26221C]/70 sm:text-[13px]">
                <input
                  type="checkbox"
                  checked={prefs.marketing}
                  onChange={(e) => setPrefs((p) => ({ ...p, marketing: e.target.checked }))}
                  className="h-4 w-4 accent-[#1F3D2B]"
                />
                <span><strong>Marketing</strong> — Used to deliver relevant ads (not used currently)</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveGranular}
                className="rounded-full bg-[#1F3D2B] px-4 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#2A5240] sm:text-[13px]"
              >
                Save Preferences
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-full border border-[#26221C]/20 px-4 py-1.5 text-[12px] font-medium text-[#26221C]/70 transition-colors hover:bg-[#26221C]/5 sm:text-[13px]"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
