import { useState } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Home,
  Laptop,
  UtensilsCrossed,
  BedDouble,
  Sparkles,
  Tags,
  Images,
  Video,
  Newspaper,
  Quote,
  HelpCircle,
  Phone,
  Search,
  Settings,
  FolderOpen,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Loader2,
  Check,
  MessageCircle,
  Palette,
  CalendarCheck,
  Ship,
  Users,
  CircleDollarSign,
  Bike,
  ClipboardList,
  Zap,
  Bot,
  BookOpen,
  Brain,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCms } from "@/context/CmsContext";
import { cn } from "@/utils/cn";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  end?: boolean;
}
interface NavGroup {
  title?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    title: "Operations",
    items: [
      { to: "/admin/operations", label: "Overview", icon: ClipboardList },
      { to: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
      { to: "/admin/tours", label: "Tours", icon: Ship },
      { to: "/admin/rentals", label: "Motorbike Rentals", icon: Bike },
      { to: "/admin/staff", label: "Staff & Payroll", icon: Users },
      { to: "/admin/payments", label: "Payments", icon: CircleDollarSign },
    ],
  },
  {
    title: "TALA",
    items: [
      { to: "/admin/tala", label: "TALA Setup", icon: Bot },
      { to: "/admin/tala/knowledge", label: "TALA Knowledge Base", icon: BookOpen },
      { to: "/admin/tala/ops", label: "TALA Operations", icon: Brain },
    ],
  },
  {
    title: "Website Content",
    items: [
      { to: "/admin/homepage", label: "Homepage", icon: Home },
      { to: "/admin/workspace", label: "Workspace", icon: Laptop },
      { to: "/admin/kitchen", label: "Kitchen", icon: UtensilsCrossed },
      { to: "/admin/stay", label: "Stay", icon: BedDouble },
      { to: "/admin/facilities", label: "Facilities", icon: Sparkles },
      { to: "/admin/speed", label: "Internet Speed", icon: Zap },
      { to: "/admin/pricing", label: "Pricing", icon: Tags },
      { to: "/admin/gallery", label: "Gallery", icon: Images },
      { to: "/admin/videos", label: "Videos", icon: Video },
      { to: "/admin/blog", label: "Blog", icon: Newspaper },
      { to: "/admin/testimonials", label: "Testimonials", icon: Quote },
      { to: "/admin/faqs", label: "FAQs", icon: HelpCircle },
      { to: "/admin/media", label: "Media Library", icon: FolderOpen },
    ],
  },
  {
    title: "Configuration",
    items: [
      { to: "/admin/contact", label: "Contact", icon: Phone },
      { to: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle },
      { to: "/admin/seo", label: "SEO", icon: Search },
      { to: "/admin/appearance", label: "Appearance", icon: Palette },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const { saving, lastSaved } = useCms();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    // Send the user back to the public homepage on sign-out so they're not
    // stranded on the login screen with no way to return to the main site.
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-[#F4F1EA]">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-[#26221C]/10 bg-[#FAF6EF] px-4 py-3 lg:hidden">
        <span className="font-serif text-lg text-[#26221C]">Marina Admin</span>
        <button onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 shrink-0 transform overflow-y-auto border-r border-[#26221C]/10 bg-[#1B1812] pb-8 transition-transform duration-300 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-6 py-7">
          <p className="font-serif text-xl text-white">Marina Terrace</p>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Admin Dashboard</p>
        </div>

        <nav className="flex flex-col gap-4 px-3 pb-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-0.5">
              {group.title && (
                <p className="mb-1 mt-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
                  {group.title}
                </p>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-[#C6A15B] text-[#221D14] font-medium"
                        : "text-white/65 hover:bg-white/5 hover:text-white",
                    )
                  }
                >
                  <item.icon className="h-4 w-4" strokeWidth={1.75} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-8 space-y-1 border-t border-white/10 px-3 pt-4">
          <Link
            to="/"
            target="_blank"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/65 hover:bg-white/5 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" /> View Live Site
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-white/65 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Log Out
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Content */}
      <div className="flex-1 pt-14 lg:pt-0">
        <div className="sticky top-0 z-10 hidden items-center justify-end gap-2 border-b border-[#26221C]/10 bg-[#FAF6EF]/80 px-8 py-3 backdrop-blur lg:flex">
          {saving ? (
            <span className="flex items-center gap-1.5 text-xs text-[#26221C]/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
            </span>
          ) : lastSaved ? (
            <span className="flex items-center gap-1.5 text-xs text-[#26221C]/40">
              <Check className="h-3.5 w-3.5 text-[#C6A15B]" /> Saved{" "}
              {lastSaved.toLocaleTimeString()}
            </span>
          ) : null}
        </div>
        <main className="admin-scroll mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
