import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Compass, MapPin } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { ImagePlaceholder } from "@/components/site/ImagePlaceholder";
import { Reveal } from "@/components/site/Reveal";

export default function BlogList() {
  const { data } = useCms();
  const [activeCategory, setActiveCategory] = useState("all");
  const posts = data.blogPosts
    .filter((p) => p.status === "published")
    .sort((a, b) => new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime());
  const visiblePosts =
    activeCategory === "all"
      ? posts
      : posts.filter((post) => post.categoryIds.includes(activeCategory));
  const featuredPost =
    activeCategory === "all"
      ? visiblePosts.find((post) => post.id === "field_note_building_community") || visiblePosts[0]
      : visiblePosts[0];
  const remainingPosts = visiblePosts.filter((post) => post.id !== featuredPost?.id);

  return (
    <div className="min-h-screen bg-[#FAF6EF] pb-24 pt-36">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <Reveal className="mx-auto mb-10 max-w-3xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#C6A15B]">
            San Vicente Field Notes
          </p>
          <h1 className="font-serif text-4xl text-[#26221C] sm:text-5xl">
            A slower guide to living and working in Palawan.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#26221C]/65">
            Practical, first-hand notes for people considering a longer stay: how to work well,
            settle in slowly, and be a good temporary neighbour in San Vicente.
          </p>
        </Reveal>

        <Reveal className="mx-auto mb-14 flex max-w-3xl flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${activeCategory === "all" ? "bg-[#26221C] text-[#FAF6EF]" : "bg-white text-[#26221C]/60 hover:bg-[#26221C]/5"}`}
          >
            All Notes
          </button>
          {data.blogCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${activeCategory === category.id ? "bg-[#26221C] text-[#FAF6EF]" : "bg-white text-[#26221C]/60 hover:bg-[#26221C]/5"}`}
            >
              {category.name}
            </button>
          ))}
        </Reveal>

        {visiblePosts.length === 0 ? (
          <p className="text-center text-[#26221C]/50">No posts published yet. Check back soon.</p>
        ) : (
          <>
            {featuredPost && (
              <Reveal className="mb-14">
                <Link
                  to={`/blog/${featuredPost.slug}`}
                  className="group grid overflow-hidden rounded-[2rem] bg-[#26221C] shadow-[0_24px_70px_rgba(38,34,28,0.12)] lg:grid-cols-[1.1fr_0.9fr]"
                >
                  <ImagePlaceholder
                    mediaId={featuredPost.featuredImageId}
                    className="aspect-[4/3] h-full min-h-[280px] w-full"
                  />
                  <div className="flex flex-col justify-center p-8 sm:p-12">
                    <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#D8BB82]">
                      <Compass className="h-3.5 w-3.5" /> Start here
                    </p>
                    <h2 className="font-serif text-3xl leading-tight text-[#FAF6EF] sm:text-4xl">
                      {featuredPost.title}
                    </h2>
                    <p className="mt-5 max-w-md text-base leading-relaxed text-[#FAF6EF]/70">
                      {featuredPost.excerpt}
                    </p>
                    <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#D8BB82]">
                      Read field note{" "}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            )}

            <div className="mb-7 flex items-end justify-between gap-6 border-b border-[#26221C]/10 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C6A15B]">
                  Guide library
                </p>
                <h2 className="mt-2 font-serif text-2xl text-[#26221C]">Read before you arrive</h2>
              </div>
              <p className="hidden items-center gap-2 text-sm text-[#26221C]/50 sm:flex">
                <MapPin className="h-4 w-4" /> San Vicente, Palawan
              </p>
            </div>

            <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {remainingPosts.map((post, i) => (
                <Reveal key={post.id} delay={i * 0.06}>
                  <Link to={`/blog/${post.slug}`} className="group block">
                    <ImagePlaceholder
                      mediaId={post.featuredImageId}
                      className="aspect-[4/3] w-full"
                    />
                    <div className="mt-5">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[#26221C]/40">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(post.publishAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                      <h2 className="mt-2 font-serif text-xl text-[#26221C] transition-colors group-hover:text-[#8A6B32]">
                        {post.title}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#26221C]/60">
                        {post.excerpt}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A6B32]">
                        Read guide{" "}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
