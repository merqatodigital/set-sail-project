import { useCms } from "@/context/CmsContext";
import { getIcon } from "@/lib/icons";
import { Reveal } from "./Reveal";

export function FeatureStrip() {
  const { data } = useCms();
  return (
    <section className="border-b border-[#26221C]/8 bg-[#FAF6EF] py-12 sm:py-16">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-6 lg:px-12">
        <Reveal>
          <p className="mb-8 text-center font-serif text-2xl font-light leading-snug text-[#26221C] sm:mb-10 sm:text-3xl lg:text-4xl">
            The Non-Negotiables: Built for Remote Work
          </p>
        </Reveal>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-4 lg:divide-x lg:divide-[#26221C]/10">
          {data.homepage.features.map((f, i) => {
            const Icon = getIcon(f.icon);
            return (
              <Reveal key={f.id} delay={i * 0.08} className="lg:px-8">
                <div className="flex flex-col items-start gap-2.5">
                  <Icon className="h-5 w-5 text-[#C6A15B] sm:h-6 sm:w-6" strokeWidth={1.5} />
                  <h3 className="font-serif text-base text-[#26221C] sm:text-lg">{f.title}</h3>
                  <p className="text-[13px] leading-relaxed text-[#26221C]/60 sm:text-sm">{f.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
