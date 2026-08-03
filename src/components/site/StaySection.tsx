import { useCms } from "@/context/CmsContext";
import { getIcon } from "@/lib/icons";
import { Reveal } from "./Reveal";
import { ImagePlaceholder } from "./ImagePlaceholder";
import { SectionEyebrow } from "@/components/ui";

export function StaySection() {
  const { data } = useCms();
  const s = data.homepage.stay;
  const images = s.galleryImageIds;

  return (
    <section id="stay" className="bg-[#FAF6EF] py-16 sm:py-20 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-6 lg:px-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <SectionEyebrow>{s.eyebrow}</SectionEyebrow>
            <h2 className="font-serif text-3xl font-light leading-[1.1] text-[#26221C] sm:text-4xl lg:text-5xl">{s.title}</h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#26221C]/65 sm:text-base">{s.paragraph}</p>
            <div className="mt-8 space-y-6 sm:mt-10 sm:space-y-7">
              {s.features.map((f) => {
                const Icon = getIcon(f.icon);
                return (
                  <div key={f.id} className="flex gap-4">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C6A15B]/12">
                      <Icon className="h-4.5 w-4.5 text-[#C6A15B]" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="font-serif text-base text-[#26221C]">{f.title}</h4>
                      <p className="mt-1 text-sm leading-relaxed text-[#26221C]/60">{f.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="grid grid-cols-2 gap-4">
              <ImagePlaceholder mediaId={images[0]} className="col-span-2 aspect-[16/10]" />
              <ImagePlaceholder mediaId={images[1]} className="aspect-square" />
              <ImagePlaceholder mediaId={images[2]} className="aspect-square" />
              <ImagePlaceholder mediaId={images[3]} className="aspect-square" />
              <ImagePlaceholder mediaId={images[4]} className="aspect-square" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
