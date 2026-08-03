import { Plus, Trash2, Star } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea, Switch } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { SortableList } from "../shared/SortableList";
import { IconPicker } from "../shared/IconPicker";
import { getIcon } from "@/lib/icons";
import type { PackageItem } from "@/types/cms";

export default function PackagesManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const packages = [...data.packages].sort((a, b) => a.order - b.order);

  const setAll = (items: PackageItem[]) => update((d) => ({ ...d, packages: items }));

  const addPackage = () => {
    const pkg: PackageItem = {
      id: `pkg_${Date.now()}`,
      name: "New Package",
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
    setAll([...packages, pkg]);
    notify("Package added");
  };

  const update1 = (id: string, patch: Partial<PackageItem>) => {
    setAll(packages.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const remove = (id: string) => {
    setAll(packages.filter((p) => p.id !== id));
    notify("Package deleted");
  };

  const setFeatured = (id: string) => {
    setAll(packages.map((p) => ({ ...p, featured: p.id === id })));
    notify("Featured package updated");
  };

  return (
    <div>
      <PageHeader
        title="Packages Manager"
        description="Add, edit, delete and reorder all-inclusive packages. Mark one as Most Popular."
        actions={<Button onClick={addPackage}><Plus className="h-4 w-4" /> Add Package</Button>}
      />

      {packages.length === 0 ? (
        <EmptyState title="No packages yet" description="Add your first all-inclusive package to get started." />
      ) : (
        <SortableList
          items={packages}
          onChange={(items) => setAll(items.map((it, idx) => ({ ...it, order: idx })))}
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

                    {/* Feature Lines */}
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

                    {/* Inclusions Toggles */}
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
    </div>
  );
}
