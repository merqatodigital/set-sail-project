import { Outlet, useLocation } from "react-router-dom";
import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { Navbar } from "@/components/site/Navbar";
import { Footer, WhatsAppFloat } from "@/components/site/CtaFooter";
import { TalaWidget } from "@/components/tala/TalaWidget";
import { useCms } from "@/context/CmsContext";

class TalaWidgetBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("TALA widget failed without blocking the site", error, info);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function PublicLayout() {
  const location = useLocation();
  const { data } = useCms();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    document.title = data.settings.seo.homeTitle || data.settings.seo.siteTitle;
    const meta =
      document.querySelector('meta[name="description"]') || document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute("content", data.settings.seo.homeDescription);
    if (!meta.parentElement) document.head.appendChild(meta);
  }, [data.settings.seo]);

  return (
    <div className="min-h-screen bg-[#FAF6EF] font-sans text-[#26221C] antialiased">
      <Navbar />
      <Outlet />
      <Footer />
      <WhatsAppFloat />
      <TalaWidgetBoundary>
        <TalaWidget />
      </TalaWidgetBoundary>
    </div>
  );
}
