import { useEffect, useMemo, useState } from "react";
import { Eye, Mail, Phone, Globe, MessageSquare, Clock, CheckCircle2, UserCircle } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { supabase, isSupabaseConnected } from "@/lib/supabase";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { OpsTable, OpsTH, OpsTD, StatusPill, KpiCard } from "../ops/OpsPrimitives";
import { cn } from "@/utils/cn";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AmumaApplication {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  country: string | null;
  heard_from: string | null;
  message: string | null;
  status: "new" | "reviewed" | "contacted";
  created_at: string;
}

type StatusFilter = "all" | "new" | "reviewed" | "contacted";

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  reviewed: "Reviewed",
  contacted: "Contacted",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  reviewed: "bg-yellow-100 text-yellow-700",
  contacted: "bg-green-100 text-green-700",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AmumaApplications() {
  const { notify } = useToast();
  const [applications, setApplications] = useState<AmumaApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<AmumaApplication | null>(null);

  useEffect(() => {
    loadApplications();
  }, []);

  async function loadApplications() {
    if (!isSupabaseConnected() || !supabase) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("amuma_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load AMUMA applications:", error);
      notify("Failed to load applications", "error");
    } else {
      setApplications(data || []);
    }
    setLoading(false);
  }

  async function updateStatus(id: string, status: AmumaApplication["status"]) {
    if (!supabase) return;
    const { error } = await supabase
      .from("amuma_applications")
      .update({ status })
      .eq("id", id);

    if (error) {
      notify("Failed to update status", "error");
    } else {
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a)),
      );
      if (selected?.id === id) {
        setSelected((prev) => (prev ? { ...prev, status } : null));
      }
      notify("Status updated", "success");
    }
  }

  const filtered = useMemo(() => {
    let list = applications;
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.first_name.toLowerCase().includes(q) ||
          a.last_name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          (a.country && a.country.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [applications, search, statusFilter]);

  const counts = useMemo(
    () => ({
      all: applications.length,
      new: applications.filter((a) => a.status === "new").length,
      reviewed: applications.filter((a) => a.status === "reviewed").length,
      contacted: applications.filter((a) => a.status === "contacted").length,
    }),
    [applications],
  );

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div>
      <PageHeader
        title="AMUMA Applications"
        description="Founding Circle membership applications from the investment page."
      />

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total" value={String(counts.all)} />
        <KpiCard label="New" value={String(counts.new)} />
        <KpiCard label="Reviewed" value={String(counts.reviewed)} />
        <KpiCard label="Contacted" value={String(counts.contacted)} />

      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {(["all", "new", "reviewed", "contacted"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-medium transition-all",
                statusFilter === s
                  ? "bg-[#26221C] text-white"
                  : "border border-[#26221C]/10 bg-white text-[#26221C]/55 hover:text-[#26221C]",
              )}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-semibold",
                  statusFilter === s ? "bg-white/20" : "bg-[#26221C]/8 text-[#26221C]/60",
                )}
              >
                {counts[s]}
              </span>
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by name, email, country..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 rounded-full border border-[#26221C]/10 bg-white px-4 text-[13px] text-[#26221C] outline-none focus:border-[#C6A15B]"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-sm text-[#26221C]/40">Loading...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Applications submitted through the investment page will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#26221C]/10 bg-white">
          <OpsTable>
            <thead>
              <tr className="border-b border-[#26221C]/10">
                <OpsTH>Name</OpsTH>
                <OpsTH>Contact</OpsTH>
                <OpsTH>Country</OpsTH>
                <OpsTH>Heard Via</OpsTH>
                <OpsTH>Date</OpsTH>
                <OpsTH>Status</OpsTH>
                <OpsTH></OpsTH>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app) => (
                <tr key={app.id} className="border-b border-[#26221C]/5 last:border-0 hover:bg-[#FAF6EF]/50">
                  <OpsTD>
                    <span className="font-medium text-[#26221C]">
                      {app.first_name} {app.last_name}
                    </span>
                  </OpsTD>
                  <OpsTD>
                    <div className="flex flex-col gap-0.5 text-[12px] text-[#26221C]/60">
                      <span>{app.email}</span>
                      {app.phone && <span>{app.phone}</span>}
                    </div>
                  </OpsTD>
                  <OpsTD>{app.country || "—"}</OpsTD>
                  <OpsTD>{app.heard_from || "—"}</OpsTD>
                  <OpsTD className="text-[12px] text-[#26221C]/50">
                    {formatDate(app.created_at)}
                  </OpsTD>
                  <OpsTD>
                    <StatusPill status={app.status} />
                  </OpsTD>
                  <OpsTD>
                    <button
                      onClick={() => setSelected(app)}
                      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-[#26221C]/50 hover:bg-[#26221C]/5 hover:text-[#26221C]"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                  </OpsTD>
                </tr>
              ))}
            </tbody>
          </OpsTable>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-serif text-xl text-[#26221C]">
                  {selected.first_name} {selected.last_name}
                </h3>
                <p className="mt-0.5 text-[12px] text-[#26221C]/45">
                  Applied {formatDate(selected.created_at)}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-[#26221C]/40 hover:bg-[#26221C]/5"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-[#26221C]/70">
                <Mail className="h-4 w-4 text-[#C6A15B]" />
                <a href={`mailto:${selected.email}`} className="hover:text-[#C6A15B]">
                  {selected.email}
                </a>
              </div>
              {selected.phone && (
                <div className="flex items-center gap-2 text-[#26221C]/70">
                  <Phone className="h-4 w-4 text-[#C6A15B]" />
                  <a href={`tel:${selected.phone}`} className="hover:text-[#C6A15B]">
                    {selected.phone}
                  </a>
                </div>
              )}
              {selected.country && (
                <div className="flex items-center gap-2 text-[#26221C]/70">
                  <Globe className="h-4 w-4 text-[#C6A15B]" />
                  {selected.country}
                </div>
              )}
              {selected.heard_from && (
                <div className="flex items-center gap-2 text-[#26221C]/70">
                  <UserCircle className="h-4 w-4 text-[#C6A15B]" />
                  Heard via: {selected.heard_from}
                </div>
              )}
              {selected.message && (
                <div className="mt-3 rounded-xl bg-[#FAF6EF] p-4">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#26221C]/40">
                    <MessageSquare className="h-3 w-3" /> Message
                  </div>
                  <p className="text-sm text-[#26221C]/70">{selected.message}</p>
                </div>
              )}
            </div>

            {/* Status actions */}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-[#26221C]/10 pt-4">
              {(["new", "reviewed", "contacted"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(selected.id, s)}
                  disabled={selected.status === s}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-medium transition-all",
                    selected.status === s
                      ? "bg-[#26221C] text-white"
                      : "border border-[#26221C]/10 text-[#26221C]/55 hover:border-[#26221C]/25 hover:text-[#26221C]",
                  )}
                >
                  {s === "new" && <Clock className="h-3 w-3" />}
                  {s === "reviewed" && <Eye className="h-3 w-3" />}
                  {s === "contacted" && <CheckCircle2 className="h-3 w-3" />}
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
