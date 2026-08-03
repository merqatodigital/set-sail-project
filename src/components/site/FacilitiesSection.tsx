import { useCms } from "@/context/CmsContext";
import { getIcon } from "@/lib/icons";
import { Reveal } from "./Reveal";
import { SectionEyebrow } from "@/components/ui";

export function FacilitiesSection() {
  const { data } = useCms();
  const f = data.homepage.facilities;
  const items = [...f.items]
    .filter((i) => i.visible !== false) // treat missing flag as visible for legacy data
    .sort((a, b) => a.order - b.order);

  if (items.length === 0) return null;

  return (
    <section id="facilities" className="bg-white py-16 sm:py-20 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-6 lg:px-12">
        <Reveal className="mx-auto mb-10 max-w-xl text-center sm:mb-14">
          <SectionEyebrow>{f.eyebrow}</SectionEyebrow>
          <h2 className="font-serif text-3xl font-light leading-[1.1] text-[#26221C] sm:text-4xl lg:text-5xl">{f.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#26221C]/60 sm:mt-4 sm:text-base">{f.paragraph}</p>
        </Reveal>

        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-6 sm:gap-y-8 lg:grid-cols-4 lg:gap-x-10 lg:gap-y-10">
          {items.map((item, i) => {
            const Icon = getIcon(item.icon);
            return (
              <Reveal key={item.id} delay={i * 0.04}>
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C6A15B]/12 sm:h-12 sm:w-12">
                    <Icon className="h-4 w-4 text-[#C6A15B] sm:h-5 sm:w-5" strokeWidth={1.5} />
                  </div>
                  <p className="text-[13px] font-medium text-[#26221C] sm:text-sm">{item.name}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
