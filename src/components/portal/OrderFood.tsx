import { useState, useMemo } from "react";
import { useCms } from "@/context/CmsContext";
import type { MenuItem, MenuCategory } from "@/types/cms";
import { createFoodOrder } from "@/lib/portalRepo";

// ---------------------------------------------------------------------------
// Order Food & Drinks — guest builds a cart and places a PENDING food order.
// The order persists server-side (tala_food_orders, source=portal) and the
// kitchen confirms/prepares it in admin / via TALA. No fake payment and no
// blob inventory mutation happen here — inventory is managed by admin.
// ---------------------------------------------------------------------------

const GOLD = "#C6A15B";
const DARK_CARD = "#16213e";

const CATEGORIES: { key: MenuCategory; label: string; emoji: string }[] = [
  { key: "breakfast", label: "Breakfast", emoji: "\u2600\uFE0F" },
  { key: "lunch", label: "Lunch", emoji: "\u{1F31E}" },
  { key: "dinner", label: "Dinner", emoji: "\u{1F319}" },
  { key: "drinks", label: "Drinks", emoji: "\u{1F379}" },
];

interface CartItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  foodCost: number;
}

interface Props {
  guest: { phone: string; name: string };
  onOrderComplete: () => void;
  onBack: () => void;
}

export default function OrderFood({ guest, onOrderComplete, onBack }: Props) {
  const { data } = useCms();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tab, setTab] = useState<MenuCategory>("breakfast");
  const [notes, setNotes] = useState("");
  const [placed, setPlaced] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  const menuItems = useMemo(
    () => data.operations.menuItems.filter((m) => m.active).sort((a, b) => a.order - b.order),
    [data.operations.menuItems],
  );

  const filtered = menuItems.filter((m) => m.category === tab);

  const addToCart = (item: MenuItem) => {
    if (item.inventoryCount <= 0) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        if (existing.quantity >= item.inventoryCount) return prev;
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, quantity: 1, price: item.price, foodCost: item.foodCost }];
    });
  };

  const updateQty = (menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.menuItemId === menuItemId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0),
    );
  };

  const total = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const totalCost = cart.reduce((s, c) => s + c.foodCost * c.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setError("");
    setPlacing(true);

    const saved = await createFoodOrder({
      guest: { name: guest.name, phone: guest.phone },
      items: cart.map((c) => ({ menuItemId: c.menuItemId, name: c.name, quantity: c.quantity, price: c.price, foodCost: c.foodCost })),
      total,
      totalCost,
      notes,
    });

    setPlacing(false);

    if (!saved) {
      setError("We couldn't place your order right now. Please try again or message Reception.");
      return;
    }

    setPlaced(true);
  };

  if (placed) {
    return (
      <div className="flex flex-col items-center space-y-6 py-12 text-center">
        <div className="text-5xl">{"\u{1F37D}\uFE0F"}</div>
        <h1 className="text-xl font-semibold">Order Placed!</h1>
        <p className="text-sm opacity-60">
          Your order is being prepared. We'll bring it to your room or you can pick it up at the front desk.
        </p>
        <button
          onClick={onOrderComplete}
          className="w-full rounded-lg py-3 text-sm font-medium transition"
          style={{ backgroundColor: GOLD, color: "#1a1a2e" }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm opacity-60 transition hover:opacity-100"
      >
        <span>{"\u2190"}</span> Back
      </button>

      <h1 className="text-xl font-semibold">Order Food & Drinks</h1>

      {/* Category Tabs */}
      <div className="flex gap-1.5 sm:gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setTab(c.key)}
            className="flex-1 rounded-lg py-2 text-[11px] font-medium transition sm:text-xs"
            style={{
              backgroundColor: tab === c.key ? GOLD : DARK_CARD,
              color: tab === c.key ? "#1a1a2e" : "#e8e8e8",
            }}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* Menu Items */}
      <div className="space-y-2">
        {filtered.map((item) => {
          const inCart = cart.find((c) => c.menuItemId === item.id);
          const soldOut = item.inventoryCount <= 0;
          const lowStock = item.inventoryCount > 0 && item.inventoryCount < 5;
          return (
            <button
              key={item.id}
              onClick={() => !soldOut && addToCart(item)}
              disabled={soldOut}
              className="w-full rounded-xl p-3.5 text-left transition hover:scale-[1.02] sm:p-4"
              style={{
                backgroundColor: soldOut ? "#1a1a2e88" : DARK_CARD,
                opacity: soldOut ? 0.5 : 1,
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium">{item.name}</h3>
                  <p className="mt-1 text-xs opacity-50">{item.description}</p>
                  {soldOut && <p className="mt-1 text-xs font-medium text-red-400">Sold Out</p>}
                  {lowStock && <p className="mt-1 text-xs font-medium text-amber-400">Only {item.inventoryCount} left</p>}
                </div>
                <div className="flex items-center gap-3">
                  {inCart && !soldOut && (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                        style={{ backgroundColor: `${GOLD}22`, color: GOLD }}
                      >
                        -
                      </button>
                      <span className="w-5 text-center text-sm font-medium">{inCart.quantity}</span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        disabled={inCart.quantity >= item.inventoryCount}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold disabled:opacity-30"
                        style={{ backgroundColor: `${GOLD}22`, color: GOLD }}
                      >
                        +
                      </button>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-sm font-semibold" style={{ color: GOLD }}>
                      {"\u20B1"}{item.price}
                    </p>
                    {!inCart && !soldOut && <p className="text-[10px] opacity-40">Tap to add</p>}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl p-6 text-center" style={{ backgroundColor: DARK_CARD }}>
            <p className="opacity-50">No items available right now.</p>
          </div>
        )}
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="space-y-4 rounded-2xl p-5 shadow-lg" style={{ backgroundColor: DARK_CARD }}>
          <h2 className="font-medium">Your Order</h2>

          <div className="space-y-2">
            {cart.map((c) => (
              <div key={c.menuItemId} className="flex items-center justify-between text-sm">
                <span className="flex-1">
                  {c.name} x {c.quantity}
                </span>
                <span style={{ color: GOLD }}>{"\u20B1"}{(c.price * c.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-3" style={{ borderColor: `${GOLD}22` }}>
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span style={{ color: GOLD }}>{"\u20B1"}{total.toLocaleString()}</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide opacity-50">
              Special Requests
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Allergies, extra rice, etc."
              rows={2}
              className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none"
              style={{
                backgroundColor: "#0f3460",
                borderColor: `${GOLD}44`,
                color: "#e8e8e8",
              }}
            />
          </div>

          <div className="rounded-lg p-3" style={{ backgroundColor: "#0f346022" }}>
            <p className="text-xs opacity-50">Ordering for</p>
            <p className="text-sm font-medium">{guest.name}</p>
            <p className="text-xs opacity-50">{guest.phone}</p>
          </div>

          {error && (
            <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>
          )}

          <button
            onClick={placeOrder}
            disabled={placing}
            className="w-full rounded-lg py-3 text-sm font-medium transition disabled:opacity-50"
            style={{ backgroundColor: GOLD, color: "#1a1a2e" }}
          >
            {placing ? "Placing order…" : `Place Order — \u20B1${total.toLocaleString()}`}
          </button>
        </div>
      )}
    </div>
  );
}
