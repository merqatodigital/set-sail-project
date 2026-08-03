import { Routes, Route } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AdminLogin from "./AdminLogin";
import AdminLayout from "./AdminLayout";
import Dashboard from "./pages/Dashboard";
import HomepageEditor from "./pages/HomepageEditor";
import WorkspaceEditor from "./pages/WorkspaceEditor";
import KitchenEditor from "./pages/KitchenEditor";
import StayEditor from "./pages/StayEditor";
import FacilitiesEditor from "./pages/FacilitiesEditor";
import SpeedEditor from "./pages/SpeedEditor";
import PricingManager from "./pages/PricingManager";
import GalleryManager from "./pages/GalleryManager";
import VideoManager from "./pages/VideoManager";
import BlogManager from "./pages/BlogManager";
import TestimonialsManager from "./pages/TestimonialsManager";
import FaqManager from "./pages/FaqManager";
import ContactManager from "./pages/ContactManager";
import WhatsAppManager from "./pages/WhatsAppManager";
import TalaManager from "./pages/TalaManager";
import TalaKnowledgeManager from "./pages/TalaKnowledgeManager";
import TalaOps from "./pages/TalaOps";
import SeoManager from "./pages/SeoManager";
import AppearanceManager from "./pages/AppearanceManager";
import SettingsManager from "./pages/SettingsManager";
import MediaLibrary from "./pages/MediaLibrary";
import OperationsDashboard from "./pages/OperationsDashboard";
import BookingsManager from "./pages/BookingsManager";
import ToursManager from "./pages/ToursManager";
import StaffManager from "./pages/StaffManager";
import PaymentsManager from "./pages/PaymentsManager";
import RentalsManager from "./pages/RentalsManager";
import FoodOrdersManager from "./pages/FoodOrdersManager";

export default function AdminApp() {
  const { isAuthed } = useAuth();

  if (!isAuthed) return <AdminLogin />;

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="homepage" element={<HomepageEditor />} />
        <Route path="workspace" element={<WorkspaceEditor />} />
        <Route path="kitchen" element={<KitchenEditor />} />
        <Route path="stay" element={<StayEditor />} />
        <Route path="facilities" element={<FacilitiesEditor />} />
        <Route path="speed" element={<SpeedEditor />} />
        <Route path="pricing" element={<PricingManager />} />
        <Route path="gallery" element={<GalleryManager />} />
        <Route path="videos" element={<VideoManager />} />
        <Route path="blog" element={<BlogManager />} />
        <Route path="testimonials" element={<TestimonialsManager />} />
        <Route path="faqs" element={<FaqManager />} />
        <Route path="contact" element={<ContactManager />} />
        <Route path="whatsapp" element={<WhatsAppManager />} />
        <Route path="tala" element={<TalaManager />} />
        <Route path="tala/knowledge" element={<TalaKnowledgeManager />} />
        <Route path="tala/ops" element={<TalaOps />} />
        <Route path="seo" element={<SeoManager />} />
        <Route path="appearance" element={<AppearanceManager />} />
        <Route path="settings" element={<SettingsManager />} />
        <Route path="media" element={<MediaLibrary />} />

        {/* ---- Operations back-office ---- */}
        <Route path="operations" element={<OperationsDashboard />} />
        <Route path="bookings" element={<BookingsManager />} />
        <Route path="tours" element={<ToursManager />} />
        <Route path="staff" element={<StaffManager />} />
        <Route path="payments" element={<PaymentsManager />} />
        <Route path="rentals" element={<RentalsManager />} />
        <Route path="food-orders" element={<FoodOrdersManager />} />
      </Route>
    </Routes>
  );
}
