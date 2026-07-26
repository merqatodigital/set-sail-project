import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Tag } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { ImagePlaceholder } from "@/components/site/ImagePlaceholder";
import { Reveal } from "@/components/site/Reveal";
import { sanitizeHtml } from "@/lib/security";

export default function BlogPost() {
  const { slug } = useParams();
  const { data } = useCms();
  const post = data.blogPosts.find((p) => p.slug === slug);

  useEffect(() => {
    if (!post) return;
    document.title = post.seoTitle || post.title;
    const meta =
      document.querySelector('meta[name="description"]') || document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute("content", post.seoDescription || post.excerpt);
    if (!meta.parentElement) document.head.appendChild(meta);
  }, [post]);

  if (!post) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAF6EF] px-6 text-center">
        <h1 className="font-serif text-3xl text-[#26221C]">Post Not Found</h1>
        <Link to="/blog" className="text-sm text-[#8A6B32] underline">
          Back to Field Notes
        </Link>
      </div>
    );
  }

  const categories = data.blogCategories.filter((c) => post.categoryIds.includes(c.id));

  return (
    <article className="min-h-screen bg-[#FAF6EF] pb-24 pt-36">
      <div className="mx-auto max-w-3xl px-6 lg:px-12">
        <Link
          to="/blog"
          className="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-[#26221C]/50 hover:text-[#8A6B32]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Field Notes
        </Link>

        <Reveal>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-[#26221C]/40">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date(post.publishAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            {categories.map((c) => (
              <span
                key={c.id}
                className="flex items-center gap-1 rounded-full bg-[#C6A15B]/15 px-2.5 py-1 text-[#8A6B32]"
              >
                {c.name}
              </span>
            ))}
          </div>
          <h1 className="font-serif text-3xl leading-tight text-[#26221C] sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-[#26221C]/60">{post.excerpt}</p>
        </Reveal>

        <Reveal delay={0.1} className="my-10">
          <ImagePlaceholder mediaId={post.featuredImageId} className="aspect-[16/9] w-full" />
        </Reveal>

        <Reveal delay={0.15}>
          <div
            className="prose prose-neutral max-w-none prose-headings:font-serif prose-headings:text-[#26221C] prose-p:text-[#26221C]/75 prose-p:leading-relaxed prose-a:text-[#8A6B32] prose-iframe:aspect-video prose-iframe:w-full"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
          />
        </Reveal>

        {post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-[#26221C]/10 pt-8">
            <Tag className="h-4 w-4 text-[#26221C]/40" />
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white px-3 py-1 text-xs text-[#26221C]/60 shadow-sm"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-12 rounded-[1.5rem] bg-[#26221C] p-7 sm:p-9">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#D8BB82]">
            <MapPin className="h-3.5 w-3.5" /> San Vicente, Palawan
          </p>
          <h2 className="mt-3 font-serif text-2xl text-[#FAF6EF]">Considering a longer stay?</h2>
          <p className="mt-3 max-w-xl leading-relaxed text-[#FAF6EF]/70">
            Explore Marina Terrace and ask for the current, practical details that matter to your
            working week.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#D8BB82] hover:text-white"
          >
            Explore Marina Terrace <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
