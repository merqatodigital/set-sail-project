import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button, Input } from "@/components/ui";

export default function AdminLogin() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await login(email.trim(), password);
    setSubmitting(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#1B1812] px-6 py-16">
      <Link
        to="/"
        className="absolute left-4 top-4 inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 text-[12px] font-medium tracking-wide text-white/70 backdrop-blur-sm transition-all duration-200 hover:border-white/40 hover:bg-white/10 hover:text-white active:scale-[0.97] sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Site
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-2xl bg-[#FAF6EF] p-8 shadow-2xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#C6A15B]/15">
            <Lock className="h-6 w-6 text-[#C6A15B]" strokeWidth={1.5} />
          </div>
          <h1 className="font-serif text-2xl text-[#26221C]">Marina Terrace Admin</h1>
          <p className="mt-1 text-sm text-[#26221C]/50">Sign in to manage the website.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Input
            type="email"
            autoFocus
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="text-center text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/" className="text-xs text-[#26221C]/45 hover:text-[#8A6B32]">
            ← Return to Marina Terrace
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
