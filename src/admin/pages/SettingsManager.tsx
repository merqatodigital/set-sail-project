import { useState } from "react";
import { ShieldCheck, RotateCcw } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { supabase, isSupabaseConnected } from "@/lib/supabase";
import { Button, Card, Field, Input, Switch } from "@/components/ui";
import { PageHeader } from "../shared/PageHeader";

export default function SettingsManager() {
  const { data, update, resetAll } = useCms();
  const { notify } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const s = data.settings;
  const patch = (fn: (d: typeof s) => typeof s) =>
    update((d) => ({ ...d, settings: fn(d.settings) }));

  const savePassword = async () => {
    if (newPassword.trim().length < 8) {
      notify("Password should be at least 8 characters", "info");
      return;
    }
    if (!isSupabaseConnected() || !supabase) {
      notify("Supabase is not connected", "info");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });
    setChangingPassword(false);
    if (error) {
      notify(error.message || "Could not update password", "info");
      return;
    }
    setNewPassword("");
    notify("Admin password updated");
  };

  const handleReset = async () => {
    if (window.confirm("This will reset ALL website content back to defaults. Continue?")) {
      await resetAll();
      notify("Content reset to defaults");
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="General site settings, appearance defaults, and admin access controls."
      />

      <Card className="space-y-5 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Site Name">
            <Input
              value={s.siteName}
              onChange={(e) => patch((d) => ({ ...d, siteName: e.target.value }))}
              onBlur={() => notify("Settings updated")}
            />
          </Field>
          <Field label="Logo Text (navbar)">
            <Input
              value={s.logoText}
              onChange={(e) => patch((d) => ({ ...d, logoText: e.target.value }))}
              onBlur={() => notify("Settings updated")}
            />
          </Field>
          <Field label="Tagline">
            <Input
              value={s.tagline}
              onChange={(e) => patch((d) => ({ ...d, tagline: e.target.value }))}
              onBlur={() => notify("Settings updated")}
            />
          </Field>
          <Field label="Accent Color">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={s.accentColor}
                onChange={(e) => patch((d) => ({ ...d, accentColor: e.target.value }))}
                className="h-10 w-14 cursor-pointer rounded-lg border border-[#26221C]/15"
              />
              <Input
                value={s.accentColor}
                onChange={(e) => patch((d) => ({ ...d, accentColor: e.target.value }))}
                onBlur={() => notify("Accent color updated")}
              />
            </div>
          </Field>
        </div>
        <label className="flex items-center gap-3 text-sm text-[#26221C]/70">
          <Switch
            checked={s.darkModeDefault}
            onChange={(v) => {
              patch((d) => ({ ...d, darkModeDefault: v }));
              notify("Setting updated");
            }}
          />
          Default admin dashboard to dark mode
        </label>
      </Card>

      <Card className="mt-6 space-y-4 p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#C6A15B]" />
          <div>
            <p className="font-serif text-lg text-[#26221C]">Admin Access</p>
            <p className="text-sm text-[#26221C]/55">
              Signed in with real Supabase Auth. Change your password below; to add another admin,
              create their account in the Supabase dashboard and insert an{" "}
              <code className="rounded bg-[#26221C]/5 px-1">admin</code> row for their user id into{" "}
              <code className="rounded bg-[#26221C]/5 px-1">user_roles</code>.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="New Password">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              autoComplete="new-password"
            />
          </Field>
          <Button onClick={savePassword} disabled={changingPassword}>
            {changingPassword ? "Updating…" : "Update Password"}
          </Button>
        </div>
      </Card>

      <Card className="mt-6 flex items-center justify-between p-6">
        <div>
          <p className="font-serif text-lg text-[#26221C]">Danger Zone</p>
          <p className="text-sm text-[#26221C]/55">
            Reset all website content back to the original defaults.
          </p>
        </div>
        <Button variant="danger" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" /> Reset All Content
        </Button>
      </Card>
    </div>
  );
}
