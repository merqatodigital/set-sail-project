import { useState } from "react";
import { Plus, Trash2, Star } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea, Switch } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { SortableList } from "../shared/SortableList";
import { IconPicker } from "../shared/IconPicker";
import { getIcon } from "@/lib/icons";
import type { PricingPackage, PackageItem } from "@/types/cms";

type Tab = "workspace" | "allinclusive";

export default function PricingManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>("workspace");

  const pricing = [...data.pricing].sort((a, b) => a.order - b.order);
  const packages = [...data.packages].sort((a, b) => a.order - b.order);

  const setPricing = (items: PricingPackage[]) => update((d) => ({ ...d, pricing: items }));
  const setPackages = (items: PackageItem[]) => update((d) => ({ ...d, packages: items }));

  return (
    <div>
      <PageHeader
        title="Pricing Manager"
        description="Manage workspace pricing and all-inclusive packages in one place."
      />

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {([
          { id: "workspace" as Tab, label: "Workspace Pricing" },
          { id: "allinclusive" as Tab, label: "All-Inclusive Packages" },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="rounded-lg px-4 py-2 text-sm font-medium transition"
            style={{
              backgroundColor: tab === t.id ? "#C6A15B" : "#F4F1EA",
              color: tab === t.id ? "#221D14" : "#26221C",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "workspace" ? (
        <WorkspacePricingTab pricing={pricing} setPricing={setPricing} notify={notify} />
      ) : (
        <AllInclusiveTab packages={packages} setPackages={setPackages} notify={notify} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace Pricing Tab (Day Pass, Weekly Sprint, Deep Work Month)
// ---------------------------------------------------------------------------

function WorkspacePricingTab({
  pricing,
  setPricing,
  notify,
}: {
  pricing: PricingPackage[];
  setPricing: (items: PricingPackage[]) => void;
  notify: (msg: string) => void;
}) {
  const addItem = () => {
    const item: PricingPackage = {
      id: `price_${Date.now()}`,
      name: "New Package",
      price: "₱0",
      period: "/day",
      icon: "Tag",
      description: "Describe this package.",
      features: [{ id: `pf_${Date.now()}`, text: "Feature one" }],
      buttonLabel: "Book Now",
      featured: false,
      order: pricing.length,
    };
    setPricing([...pricing, item]);
    notify("Package added");
  };

  const update1 = (id: string, patch: Partial<PricingPackage>) => {
    setPricing(pricing.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const remove = (id: string) => {
    setPricing(pricing.filter((p) => p.id !== id));
    notify("Package deleted");
  };

  const setFeatured = (id: string) => {
    setPricing(pricing.map((p) => ({ ...p, featured: p.id === id })));
    notify("Featured package updated");
  };

  return (
    <>
      {pricing.length === 0 ? (
        <EmptyState title="No pricing yet" description="Add your first workspace pricing package." />
      ) : (
        <SortableList
          items={pricing}
          onChange={(items) => setPricing(items.map((it, idx) => ({ ...it, order: idx })))}
          renderItem={(pkg, handle) => {
            const Icon = getIcon(pkg.icon);
            return (
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  {handle}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C6A15B]/12">
                    <Icon className="h-4.5 w-4.5 text-[#C6A15B]" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label="Name"><Input value={pkg.name} onChange={(e) => update1(pkg.id, { name: e.target.value })} /></Field>
                      <Field label="Price"><Input value={pkg.price} onChange={(e) => update1(pkg.id, { price: e.target.value })} /></Field>
                      <Field label="Period"><Input value={pkg.period} onChange={(e) => update1(pkg.id, { period: e.target.value })} /></Field>
                      <Field label="Icon">
                        <IconPicker value={pkg.icon} onChange={(icon) => update1(pkg.id, { icon })} />
                      </Field>
                    </div>
                    <Field label="Description">
                      <Textarea rows={2} value={pkg.description} onChange={(e) => update1(pkg.id, { description: e.target.value })} />
                    </Field>
                    <Field label="Button Label">
                      <Input value={pkg.buttonLabel} onChange={(e) => update1(pkg.id, { buttonLabel: e.target.value })} />
                    </Field>

                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#26221C]/50">Feature Lines</p>
                      <div className="space-y-2">
                        {pkg.features.map((f) => (
                          <div key={f.id} className="flex items-center gap-2">
                            <Input
                              value={f.text}
                              onChange={(e) =>
                                update1(pkg.id, { features: pkg.features.map((x) => (x.id === f.id ? { ...x, text: e.target.value } : x)) })
                              }
                            />
                            <button
                              onClick={() => update1(pkg.id, { features: pkg.features.filter((x) => x.id !== f.id) })}
                              className="text-[#26221C]/30 hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => update1(pkg.id, { features: [...pkg.features, { id: `pf_${Date.now()}`, text: "New feature" }] })}
                          className="text-xs font-medium text-[#8A6B32] hover:underline"
                        >
                          + Add feature line
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#26221C]/10 pt-3">
                      <label className="flex items-center gap-2 text-sm text-[#26221C]/70">
                        <Switch checked={pkg.featured} onChange={() => setFeatured(pkg.id)} />
                        <Star className="h-3.5 w-3.5 text-[#C6A15B]" /> Most Popular
                      </label>
                      <button onClick={() => remove(pkg.id)} className="flex items-center gap-1.5 text-sm text-red-500 hover:underline">
                        <Trash2 className="h-4 w-4" /> Delete Package
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          }}
        />
      )}
      <div className="mt-4">
        <Button onClick={addItem}><Plus className="h-4 w-4" /> Add Workspace Package</Button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// All-Inclusive Packages Tab
// ---------------------------------------------------------------------------

function AllInclusiveTab({
  packages,
  setPackages,
  notify,
}: {
  packages: PackageItem[];
  setPackages: (items: PackageItem[]) => void;
  notify: (msg: string) => void;
}) {
  const addItem = () => {
    const item: PackageItem = {
      id: `pkg_${Date.now()}`,
      name: "New All-Inclusive Package",
      price: 0,
      priceTwo: 0,
      period: "7 days",
      icon: "Package",
      description: "Describe this package.",
      features: [{ id: `pf_${Date.now()}`, text: "Feature one" }],
      includedTourIds: [],
      includeMotorbike: false,
      includeAirportTransfer: false,
      dailyCoffeeCount: 0,
      dailyMealCount: 0,
      buttonLabel: "Book Now",
      featured: false,
      order: packages.length,
    };
    setPackages([...packages, item]);
    notify("Package added");
  };

  const update1 = (id: string, patch: Partial<PackageItem>) => {
    setPackages(packages.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const remove = (id: string) => {
    setPackages(packages.filter((p) => p.id !== id));
    notify("Package deleted");
  };

  const setFeatured = (id: string) => {
    setPackages(packages.map((p) => ({ ...p, featured: p.id === id })));
    notify("Featured package updated");
  };

  return (
    <>
      {packages.length === 0 ? (
        <EmptyState title="No all-inclusive packages yet" description="Add your first all-inclusive package to get started." />
      ) : (
        <SortableList
          items={packages}
          onChange={(items) => setPackages(items.map((it, idx) => ({ ...it, order: idx })))}
          renderItem={(pkg, handle) => {
            const Icon = getIcon(pkg.icon);
            return (
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  {handle}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C6A15B]/12">
                    <Icon className="h-4.5 w-4.5 text-[#C6A15B]" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label="Name"><Input value={pkg.name} onChange={(e) => update1(pkg.id, { name: e.target.value })} /></Field>
                      <Field label="1-Person Price (PHP)"><Input type="number" value={pkg.price} onChange={(e) => update1(pkg.id, { price: Number(e.target.value) })} /></Field>
                      <Field label="2-Person Price (PHP)"><Input type="number" value={pkg.priceTwo} onChange={(e) => update1(pkg.id, { priceTwo: Number(e.target.value) })} /></Field>
                      <Field label="Period"><Input value={pkg.period} onChange={(e) => update1(pkg.id, { period: e.target.value })} /></Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Icon">
                        <IconPicker value={pkg.icon} onChange={(icon) => update1(pkg.id, { icon })} />
                      </Field>
                      <Field label="Button Label"><Input value={pkg.buttonLabel} onChange={(e) => update1(pkg.id, { buttonLabel: e.target.value })} /></Field>
                    </div>
                    <Field label="Description">
                      <Textarea rows={2} value={pkg.description} onChange={(e) => update1(pkg.id, { description: e.target.value })} />
                    </Field>

                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#26221C]/50">Features Included</p>
                      <div className="space-y-2">
                        {pkg.features.map((f) => (
                          <div key={f.id} className="flex items-center gap-2">
                            <Input
                              value={f.text}
                              onChange={(e) =>
                                update1(pkg.id, { features: pkg.features.map((x) => (x.id === f.id ? { ...x, text: e.target.value } : x)) })
                              }
                            />
                            <button
                              onClick={() => update1(pkg.id, { features: pkg.features.filter((x) => x.id !== f.id) })}
                              className="text-[#26221C]/30 hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => update1(pkg.id, { features: [...pkg.features, { id: `pf_${Date.now()}`, text: "New feature" }] })}
                          className="text-xs font-medium text-[#8A6B32] hover:underline"
                        >
                          + Add feature
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#26221C]/50">Package Inclusions</p>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm text-[#26221C]/70">
                          <Switch checked={pkg.includeMotorbike} onChange={() => update1(pkg.id, { includeMotorbike: !pkg.includeMotorbike })} />
                          Motorbike Rental
                        </label>
                        <label className="flex items-center gap-2 text-sm text-[#26221C]/70">
                          <Switch checked={pkg.includeAirportTransfer} onChange={() => update1(pkg.id, { includeAirportTransfer: !pkg.includeAirportTransfer })} />
                          Airport Transfer
                        </label>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Field label="Daily Coffee">
                          <Input type="number" value={pkg.dailyCoffeeCount} onChange={(e) => update1(pkg.id, { dailyCoffeeCount: Number(e.target.value) })} />
                        </Field>
                        <Field label="Daily Meals">
                          <Input type="number" value={pkg.dailyMealCount} onChange={(e) => update1(pkg.id, { dailyMealCount: Number(e.target.value) })} />
                        </Field>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#26221C]/10 pt-3">
                      <label className="flex items-center gap-2 text-sm text-[#26221C]/70">
                        <Switch checked={pkg.featured} onChange={() => setFeatured(pkg.id)} />
                        <Star className="h-3.5 w-3.5 text-[#C6A15B]" /> Most Popular
                      </label>
                      <button onClick={() => remove(pkg.id)} className="flex items-center gap-1.5 text-sm text-red-500 hover:underline">
                        <Trash2 className="h-4 w-4" /> Delete Package
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          }}
        />
      )}
      <div className="mt-4">
        <Button onClick={addItem}><Plus className="h-4 w-4" /> Add All-Inclusive Package</Button>
      </div>
    </>
  );
}
