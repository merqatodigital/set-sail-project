import { useCms } from "@/context/CmsContext";
import { getIcon } from "@/lib/icons";
import { Reveal } from "./Reveal";
import { ImagePlaceholder } from "./ImagePlaceholder";
import { SectionEyebrow } from "@/components/ui";
import type { MenuCategory } from "@/types/cms";

export function WorkspaceSection() {
  const { data } = useCms();
  const w = data.workspace;
  return (
    <section id="workspace" className="bg-[#FAF6EF] py-24 lg:py-32">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2 lg:gap-20 lg:px-12">
        <Reveal>
          <ImagePlaceholder mediaId={w.imageId} label="Rooftop Workspace" className="aspect-[4/5] w-full lg:aspect-[3/4]" />
        </Reveal>
        <Reveal delay={0.1}>
          <SectionEyebrow>{w.eyebrow}</SectionEyebrow>
          <h2 className="font-serif text-4xl font-light leading-[1.1] text-[#26221C] sm:text-5xl">{w.title}</h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-[#26221C]/65">{w.paragraph}</p>
          <div className="mt-10 grid gap-7 sm:grid-cols-1">
            {w.highlights.map((h) => {
              const Icon = getIcon(h.icon);
              return (
                <div key={h.id} className="flex gap-4">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C6A15B]/12">
                    <Icon className="h-4.5 w-4.5 text-[#C6A15B]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h4 className="font-serif text-base text-[#26221C]">{h.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-[#26221C]/60">{h.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function KitchenSection() {
  const { data } = useCms();
  const k = data.homepage.kitchen;
  const menuItems = data.operations.menuItems.filter((m) => m.active).sort((a, b) => a.order - b.order);
  const categories: MenuCategory[] = ["breakfast", "lunch", "dinner", "drinks"];

  return (
    <section id="kitchen" className="bg-white py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <Reveal className="mx-auto max-w-xl text-center">
          <SectionEyebrow>{k.eyebrow}</SectionEyebrow>
          <h2 className="font-serif text-4xl font-light leading-[1.1] text-[#26221C] sm:text-5xl">{k.title}</h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-[#26221C]/65">{k.paragraph}</p>
        </Reveal>

        {/* Menu Display */}
        <div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat) => {
            const items = menuItems.filter((m) => m.category === cat);
            if (items.length === 0) return null;
            return (
              <Reveal key={cat} delay={categories.indexOf(cat) * 0.1}>
                <div>
                  <h3 className="mb-4 font-serif text-2xl text-[#26221C]">{cat.charAt(0).toUpperCase() + cat.slice(1)}</h3>
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-serif text-base text-[#26221C]">{item.name}</h4>
                          <p className="mt-0.5 text-xs leading-relaxed text-[#26221C]/50">{item.description}</p>
                        </div>
                        <span className="shrink-0 font-serif text-base text-[#C6A15B]">{"\u20B1"}{item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-12 text-center">
          <p className="text-sm text-[#26221C]/50">Prices are in Philippine Peso ({'\u20B1'}). Menu available all day.</p>
        </Reveal>
      </div>
    </section>
  );
}

export function FocusSection() {
  const { data } = useCms();
  const f = data.homepage.focus;
  return (
    <section className="bg-[#F3ECDD] py-24 lg:py-32">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2 lg:gap-20 lg:px-12">
        <Reveal>
          <ImagePlaceholder mediaId={f.imageId} label="Sunset Workspace" className="aspect-[4/5] w-full lg:aspect-[3/4]" />
        </Reveal>
        <Reveal delay={0.1}>
          <SectionEyebrow>{f.eyebrow}</SectionEyebrow>
          <h2 className="font-serif text-4xl font-light leading-[1.1] text-[#26221C] sm:text-5xl">{f.title}</h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-[#26221C]/65">{f.paragraph}</p>
          <div className="mt-10 grid gap-7 sm:grid-cols-2">
            {f.features.map((item) => {
              const Icon = getIcon(item.icon);
              return (
                <div key={item.id} className="flex gap-4">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C6A15B]/12">
                    <Icon className="h-4.5 w-4.5 text-[#C6A15B]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h4 className="font-serif text-base text-[#26221C]">{item.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-[#26221C]/60">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
