import { Suspense, lazy } from "react";
import {
  Routes,
  Route,
  unstable_HistoryRouter as HistoryRouter,
  UNSAFE_createBrowserHistory as createBrowserHistory,
} from "react-router-dom";
import { CmsProvider } from "@/context/CmsContext";
import { ThemeProvider } from "@/context/ThemeProvider";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import PublicLayout from "@/pages/PublicLayout";
import Home from "@/pages/Home";
import { AppLoader } from "@/components/AppLoader";
import { CookieConsent } from "@/components/site/CookieConsent";

// Lazy-load non-critical routes so the public landing page parses faster.
const BlogList = lazy(() => import("@/pages/BlogList"));
const BlogPost = lazy(() => import("@/pages/BlogPost"));
const AdminApp = lazy(() => import("@/admin/AdminApp"));
const Portal = lazy(() => import("@/pages/Portal"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("@/pages/TermsOfService"));
const AccessibilityStatement = lazy(() => import("@/pages/AccessibilityStatement"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Created once at module scope. BrowserRouter builds this history INSIDE its
// render, and stamping the history index there triggered a router state update
// during React's render phase. Building it outside the render phase keeps the
// exact same routing behaviour without the illegal mid-render update.
const history = createBrowserHistory();

export default function App() {
  return (
    <ToastProvider>
      <CmsProvider>
        <ThemeProvider>
          <CurrencyProvider>
            <AuthProvider>
            <HistoryRouter history={history}>
              <Routes>
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route
                    path="/blog"
                    element={
                      <Suspense fallback={<AppLoader label="Loading journal…" />}>
                        <BlogList />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/blog/:slug"
                    element={
                      <Suspense fallback={<AppLoader label="Loading article…" />}>
                        <BlogPost />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/privacy"
                    element={
                      <Suspense fallback={<AppLoader label="Loading…" />}>
                        <PrivacyPolicy />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/terms"
                    element={
                      <Suspense fallback={<AppLoader label="Loading…" />}>
                        <TermsOfService />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/accessibility"
                    element={
                      <Suspense fallback={<AppLoader label="Loading…" />}>
                        <AccessibilityStatement />
                      </Suspense>
                    }
                  />
                  <Route
                    path="*"
                    element={
                      <Suspense fallback={<AppLoader label="Loading…" />}>
                        <NotFound />
                      </Suspense>
                    }
                  />
                </Route>
                <Route
                  path="/portal"
                  element={
                    <Suspense fallback={<AppLoader label="Loading portal…" />}>
                      <Portal />
                    </Suspense>
                  }
                />
                <Route
                  path="/admin/*"
                  element={
                    <Suspense fallback={<AppLoader label="Loading admin…" />}>
                      <AdminApp />
                    </Suspense>
                  }
                />
              </Routes>
            </HistoryRouter>
            <CookieConsent />
          </AuthProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </CmsProvider>
    </ToastProvider>
  );
}
