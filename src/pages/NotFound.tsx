import { Link } from "react-router-dom";
import { Home, MessageCircle } from "lucide-react";
import { openTalaIntent } from "@/components/tala/talaOpen";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <p className="text-[120px] font-light leading-none text-[#26221C]/10 sm:text-[160px]">404</p>
      <h1 className="mt-4 font-serif text-2xl font-light text-[#26221C] sm:text-3xl">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-[#26221C]/50">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-full bg-[#1F3D2B] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2A5240]"
        >
          <Home className="h-4 w-4" />
          Back to Home
        </Link>
        <button
          onClick={() =>
            openTalaIntent(
              "general_help",
              { source: "not_found", interest: "general" },
              "I'm looking for something on the site",
            )
          }
          className="flex items-center gap-2 rounded-full border border-[#C6A15B]/30 px-5 py-2.5 text-sm font-medium text-[#C6A15B] transition-colors hover:bg-[#C6A15B]/10"
        >
          <MessageCircle className="h-4 w-4" />
          Ask TALA
        </button>
      </div>
    </div>
  );
}
