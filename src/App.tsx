import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CmsProvider } from "@/context/CmsContext";
import { ThemeProvider } from "@/context/ThemeProvider";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import PublicLayout from "@/pages/PublicLayout";
import Home from "@/pages/Home";
import { AppLoader } from "@/components/AppLoader";

// Lazy-load non-critical routes so the public landing page parses faster.
const BlogList = lazy(() => import("@/pages/BlogList"));
const BlogPost = lazy(() => import("@/pages/BlogPost"));
const AdminApp = lazy(() => import("@/admin/AdminApp"));
const Portal = lazy(() => import("@/pages/Portal"));

export default function App() {
  return (
    <ToastProvider>
      <CmsProvider>
        <ThemeProvider>
          <CurrencyProvider>
            <AuthProvider>
            <BrowserRouter>
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
            </BrowserRouter>
          </AuthProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </CmsProvider>
    </ToastProvider>
  );
}
