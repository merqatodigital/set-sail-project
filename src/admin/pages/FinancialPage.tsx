import { useMemo, useState } from "react";
import { DollarSign, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { useCms } from "@/context/CmsContext";
import { PageHeader } from "../shared/PageHeader";
import { KpiCard } from "../ops/OpsPrimitives";
import { formatPHP } from "../ops/opsUtils";
import type { Booking, TourBooking, MotorbikeRental, FoodOrder, Payment, Tour } from "@/types/cms";

const COLORS = ["#C6A15B", "#4ade80", "#60a5fa", "#f87171", "#a78bfa", "#fbbf24"];

type Period = "month" | "quarter" | "year";

function getPeriodRange(period: Period) {
  const now = new Date();
  const start = new Date(now);
  if (period === "month") start.setMonth(now.getMonth() - 1);
  else if (period === "quarter") start.setMonth(now.getMonth() - 3);
  else start.setFullYear(now.getFullYear() - 1);
  return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
}

function calcFixedCosts(dailyLabor: number, monthlyUtilities: number, daysInPeriod: number) {
  return dailyLabor * daysInPeriod + monthlyUtilities;
}

export default function FinancialPage() {
  const { data } = useCms();
  const [period, setPeriod] = useState<Period>("month");

  const { start, end } = getPeriodRange(period);
  const daysInPeriod = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000) || 30;

  const financial = data.settings.financial;
  const tours = data.operations.tours;
  const bookings = data.operations.bookings;
  const tourBookings = data.operations.tourBookings;
  const rentals = data.operations.motorbikeRentals;
  const foodOrders = data.operations.foodOrders;
  const payments = data.operations.payments;

  const inRange = <T extends { createdAt: string }>(items: T[]) =>
    items.filter((i) => i.createdAt >= start && i.createdAt <= end);

  const activeBookings = inRange(bookings).filter((b) => b.status !== "cancelled");
  const activeTourBookings = inRange(tourBookings).filter((t) => t.status !== "cancelled");
  const activeRentals = inRange(rentals).filter((r) => r.status !== "cancelled");
  const activeFoodOrders = inRange(foodOrders).filter((o) => o.status !== "cancelled");

  // Revenue by stream
  const revenueAccommodation = activeBookings.reduce((s, b) => s + b.amount, 0);
  const revenueTours = activeTourBookings.reduce((s, t) => s + t.amount, 0);
  const revenueRentals = activeRentals.reduce((s, r) => s + r.amount, 0);
  const revenueFood = activeFoodOrders.reduce((s, o) => s + o.total, 0);
  const totalRevenue = revenueAccommodation + revenueTours + revenueRentals + revenueFood;

  // Costs by stream
  const costTours = activeTourBookings.reduce((s, t) => s + t.cost, 0);
  const costFood = activeFoodOrders.reduce((s, o) => s + o.totalCost, 0);
  const fixedCosts = calcFixedCosts(financial.dailyLaborCost, financial.monthlyUtilities, daysInPeriod);
  const totalCosts = fixedCosts + costTours + costFood;

  // Profit by stream
  const profitAccommodation = revenueAccommodation - (fixedCosts * (revenueAccommodation / (totalRevenue || 1)));
  const profitTours = revenueTours - costTours;
  const profitRentals = revenueRentals;
  const profitFood = revenueFood - costFood;
  const netProfit = totalRevenue - totalCosts;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  // Monthly data for charts (last6 months)
  const monthlyData = useMemo(() => {
    const months: { month: string; revenue: number; costs: number; profit: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
      const mDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const mBookings = bookings.filter((b) => b.createdAt >= mStart && b.createdAt <= mEnd && b.status !== "cancelled");
      const mTours = tourBookings.filter((t) => t.createdAt >= mStart && t.createdAt <= mEnd && t.status !== "cancelled");
      const mRentalsFiltered = rentals.filter((r) => r.createdAt >= mStart && r.createdAt <= mEnd && r.status !== "cancelled");
      const mFood = foodOrders.filter((o) => o.createdAt >= mStart && o.createdAt <= mEnd && o.status !== "cancelled");
      const mRevenue = mBookings.reduce((s, b) => s + b.amount, 0) + mTours.reduce((s, t) => s + t.amount, 0) + mRentalsFiltered.reduce((s, r) => s + r.amount, 0) + mFood.reduce((s, o) => s + o.total, 0);
      const mCostFixed = calcFixedCosts(financial.dailyLaborCost, financial.monthlyUtilities, mDays);
      const mCostVar = mTours.reduce((s, t) => s + t.cost, 0) + mFood.reduce((s, o) => s + o.totalCost, 0);
      const mCosts = mCostFixed + mCostVar;
      months.push({
        month: d.toLocaleString("default", { month: "short" }),
        revenue: mRevenue,
        costs: mCosts,
        profit: mRevenue - mCosts,
      });
    }
    return months;
  }, [bookings, tourBookings, rentals, foodOrders, financial]);

  // Revenue breakdown for pie chart
  const revenuePie = [
    { name: "Accommodations", value: revenueAccommodation },
    { name: "Tours", value: revenueTours },
    { name: "Rentals", value: revenueRentals },
    { name: "Food & Beverage", value: revenueFood },
  ].filter((d) => d.value > 0);

  // Cost breakdown for pie chart
  const costPie = [
    { name: "Staff & Utilities", value: fixedCosts },
    { name: "Tour Costs", value: costTours },
    { name: "Food Ingredients", value: costFood },
  ].filter((d) => d.value > 0);

  // Profit by stream for bar chart
  const profitBar = [
    { name: "Accommodations", profit: Math.round(profitAccommodation) },
    { name: "Tours", profit: profitTours },
    { name: "Rentals", profit: profitRentals },
    { name: "Food & Beverage", profit: profitFood },
  ];

  return (
    <div>
      <PageHeader
        title="Financial Overview"
        description="Revenue, costs, and profit analysis"
        actions={
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="rounded-lg border border-[#26221C]/10 bg-white px-3 py-2.5 text-sm"
          >
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last Quarter</option>
            <option value="year">Last Year</option>
          </select>
        }
      />

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Revenue" value={formatPHP(totalRevenue)} tone="positive" />
        <KpiCard label="Total Costs" value={formatPHP(totalCosts)} />
        <KpiCard label="Net Profit" value={formatPHP(netProfit)} tone={netProfit > 0 ? "positive" : "warning"} />
        <KpiCard label="Profit Margin" value={`${profitMargin}%`} tone={profitMargin > 0 ? "positive" : "warning"} />
      </div>

      {/* Revenue vs Costs Over Time */}
      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#26221C]/60">Revenue vs Costs (6 Months)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#26221C10" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatPHP(v)} />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#4ade80" radius={[4, 4, 0, 0]} />
              <Bar dataKey="costs" name="Costs" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Breakdown Pie */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#26221C]/60">Revenue by Stream</h3>
          {revenuePie.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="h-48 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={revenuePie} cx="50%" cy="50%" innerRadius={40} outerRadius={80} dataKey="value">
                      {revenuePie.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatPHP(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {revenuePie.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span>{item.name}</span>
                    </div>
                    <span className="font-medium">{formatPHP(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#26221C]/40">No revenue data for this period.</p>
          )}
        </div>

        {/* Cost Breakdown Pie */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#26221C]/60">Cost Breakdown</h3>
          {costPie.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="h-48 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={costPie} cx="50%" cy="50%" innerRadius={40} outerRadius={80} dataKey="value">
                      {costPie.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatPHP(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {costPie.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span>{item.name}</span>
                    </div>
                    <span className="font-medium">{formatPHP(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#26221C]/40">No cost data for this period.</p>
          )}
        </div>
      </div>

      {/* Profit by Stream */}
      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#26221C]/60">Profit by Stream</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={profitBar} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#26221C10" />
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
              <Tooltip formatter={(v: number) => formatPHP(v)} />
              <Bar dataKey="profit" name="Profit" radius={[0, 4, 4, 0]}>
                {profitBar.map((entry, i) => (
                  <Cell key={i} fill={entry.profit >= 0 ? "#4ade80" : "#f87171"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Net Profit Trend */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#26221C]/60">Net Profit Trend (6 Months)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#26221C10" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatPHP(v)} />
              <Legend />
              <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#C6A15B" strokeWidth={2} dot={{ fill: "#C6A15B" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
