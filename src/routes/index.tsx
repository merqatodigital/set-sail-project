import { createFileRoute } from "@tanstack/react-router";
import { Component, type ErrorInfo, type ReactNode } from "react";
import App from "../App";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRoute,
});

class LandingPageBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Landing page failed", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[#FAF6EF] px-6 text-center text-[#26221C]">
          <div className="max-w-sm">
            <h1 className="font-serif text-2xl">Marina Terrace</h1>
            <p className="mt-3 text-sm text-[#26221C]/70">
              The page hit a temporary loading problem.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-full bg-[#1F3D2B] px-5 py-2.5 text-sm font-medium text-white"
            >
              Reload page
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

function IndexRoute() {
  return (
    <LandingPageBoundary>
      <App />
    </LandingPageBoundary>
  );
}
