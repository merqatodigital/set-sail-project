import { Link } from "react-router-dom";
import { LogIn, LogOut, Ship, Bike, Users, CircleDollarSign, ArrowUpRight, Clock } from "lucide-react";
import { PageHeader } from "../shared/PageHeader";
import { OpsTable, OpsTH, OpsTD, StatusPill, KpiCard } from "../ops/OpsPrimitives";
import { formatPHP, formatDate, todayISO } from "../ops/opsUtils";
import { useOperations } from "../ops/useOperations";

export default function OperationsDashboard() {
  const { data: ops, loading } = useOperations();
  const today = todayISO();

  if (loading) return null;

  // ---- Today's activity -----------------------------------------------------
  const arrivals = ops.bookings.filter((b) => b.checkIn === today && b.status !== "cancelled");
  const departures = ops.bookings.filter((b) => b.checkOut === today && b.status !== "cancelled");
  const tourToday = ops.tourBookings.filter((t) => t.date === today && t.status !== "cancelled");
  const bikesRented = ops.motorbikes.filter((b) => b.status === "rented").length;

  // ---- 30-day KPIs ----------------------------------------------------------
  const days30 = 30 * 86400000;
  const revenue = ops.payments
    .filter((p) => p.direction === "in" && new Date(p.date).getTime() > Date.now() - days30)
    .reduce((s, p) => s + p.amount, 0);
  const expenses = ops.payments
    .filter((p) => p.direction === "out" && new Date(p.date).getTime() > Date.now() - days30)
    .reduce((s, p) => s + p.amount, 0);
  const bookings30 = ops.bookings.filter((b) => new Date(b.createdAt).getTime() > Date.now() - days30).length;
  const inHouse = ops.bookings.filter((b) => b.status === "checked_in").length;
  const unpaidPayroll = ops.payRecords.filter((p) => !p.paid).reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <PageHeader
        title="Operations Dashboard"
        description="Everything happening at Marina Terrace today — bookings, tours, rentals and cash flow."
      />

      {/* ---- KPI row ---- */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="In-House Guests" value={String(inHouse)} tone={inHouse ? "positive" : "default"} />
        <KpiCard label="Revenue (30d)" value={formatPHP(revenue)} tone="positive" />
        <KpiCard label="Expenses (30d)" value={formatPHP(expenses)} tone="warning" />
        <KpiCard label="New Bookings (30d)" value={String(bookings30)} />
        <KpiCard label="Unpaid Payroll" value={formatPHP(unpaidPayroll)} tone={unpaidPayroll ? "warning" : "positive"} />
      </div>

      {/* ---- Today's activity grid ---- */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TodaySection
          title="Arrivals Today"
          icon={<LogIn className="h-4 w-4 text-green-700" />}
          empty="No arrivals scheduled"
          link="/admin/bookings"
          count={arrivals.length}
        >
          {arrivals.length > 0 && (
            <OpsTable>
              <thead>
                <tr>
                  <OpsTH>Guest</OpsTH>
                  <OpsTH>Package</OpsTH>
                  <OpsTH>Status</OpsTH>
                </tr>
              </thead>
              <tbody>
                {arrivals.map((b) => (
                  <tr key={b.id}>
                    <OpsTD className="font-medium">{b.guestName}</OpsTD>
                    <OpsTD className="text-xs">{b.roomType}</OpsTD>
                    <OpsTD><StatusPill value={b.status} /></OpsTD>
                  </tr>
                ))}
              </tbody>
            </OpsTable>
          )}
        </TodaySection>

        <TodaySection
          title="Departures Today"
          icon={<LogOut className="h-4 w-4 text-slate-600" />}
          empty="No departures scheduled"
          link="/admin/bookings"
          count={departures.length}
        >
          {departures.length > 0 && (
            <OpsTable>
              <thead>
                <tr>
                  <OpsTH>Guest</OpsTH>
                  <OpsTH>Package</OpsTH>
                  <OpsTH>Owed</OpsTH>
                </tr>
              </thead>
              <tbody>
                {departures.map((b) => {
                  const owed = b.amount - b.paidAmount;
                  return (
                    <tr key={b.id}>
                      <OpsTD className="font-medium">{b.guestName}</OpsTD>
                      <OpsTD className="text-xs">{b.roomType}</OpsTD>
                      <OpsTD>
                        <span className={owed > 0 ? "text-red-600" : "text-green-700"}>
                          {owed > 0 ? formatPHP(owed) : "Paid"}
                        </span>
                      </OpsTD>
                    </tr>
                  );
                })}
              </tbody>
            </OpsTable>
          )}
        </TodaySection>

        <TodaySection
          title="Tours Today"
          icon={<Ship className="h-4 w-4 text-[#C6A15B]" />}
          empty="No tours scheduled today"
          link="/admin/tours"
          count={tourToday.length}
        >
          {tourToday.length > 0 && (
            <OpsTable>
              <thead>
                <tr>
                  <OpsTH>Tour</OpsTH>
                  <OpsTH>Guest</OpsTH>
                  <OpsTH>Pax</OpsTH>
                </tr>
              </thead>
              <tbody>
                {tourToday.map((t) => (
                  <tr key={t.id}>
                    <OpsTD className="text-xs">{t.tourName}</OpsTD>
                    <OpsTD className="font-medium">{t.guestName}</OpsTD>
                    <OpsTD>{t.guests}</OpsTD>
                  </tr>
                ))}
              </tbody>
            </OpsTable>
          )}
        </TodaySection>

        <TodaySection
          title="Bikes Out"
          icon={<Bike className="h-4 w-4 text-[#C6A15B]" />}
          empty="All bikes available"
          link="/admin/rentals"
          count={bikesRented}
        >
          {bikesRented > 0 && (
            <OpsTable>
              <thead>
                <tr>
                  <OpsTH>Bike</OpsTH>
                  <OpsTH>Guest</OpsTH>
                  <OpsTH>Return</OpsTH>
                </tr>
              </thead>
              <tbody>
                {ops.motorbikeRentals.filter((r) => r.status === "active").map((r) => (
                  <tr key={r.id}>
                    <OpsTD className="font-medium">{r.bikeName}</OpsTD>
                    <OpsTD className="text-xs">{r.guestName}</OpsTD>
                    <OpsTD className="text-xs">{formatDate(r.endDate)}</OpsTD>
                  </tr>
                ))}
              </tbody>
            </OpsTable>
          )}
        </TodaySection>
      </div>

      {/* ---- Quick actions ---- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <QuickAction to="/admin/bookings" icon={LogIn} label="Bookings" />
        <QuickAction to="/admin/tours" icon={Ship} label="Tours" />
        <QuickAction to="/admin/rentals" icon={Bike} label="Rentals" />
        <QuickAction to="/admin/staff" icon={Users} label="Staff" />
        <QuickAction to="/admin/payments" icon={CircleDollarSign} label="Payments" />
        <QuickAction to="/admin/staff" icon={Clock} label="Shifts" />
      </div>
    </div>
  );
}

function TodaySection({
  title, icon, empty, link, count, children,
}: {
  title: string; icon: React.ReactNode; empty: string; link: string; count: number; children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-serif text-base text-[#26221C]">{title}</h3>
          <span className="rounded-full bg-[#26221C]/8 px-2 py-0.5 text-xs font-medium text-[#26221C]/60">{count}</span>
        </div>
        <Link to={link} className="text-xs text-[#8A6B32] hover:underline">View all →</Link>
      </div>
      {count === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#26221C]/15 bg-white/50 p-8 text-center text-sm text-[#26221C]/45">
          {empty}
        </div>
      ) : children}
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to} className="group flex items-center justify-between rounded-2xl border border-[#26221C]/8 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-[#C6A15B]" />
        <span className="text-sm font-medium text-[#26221C]">{label}</span>
      </div>
      <ArrowUpRight className="h-4 w-4 text-[#26221C]/20 transition group-hover:text-[#C6A15B]" />
    </Link>
  );
}
