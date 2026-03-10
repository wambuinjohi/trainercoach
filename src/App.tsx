import React, { useEffect, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ApiConfigProvider } from "@/contexts/ApiConfigContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AutoSetupWrapper } from "@/components/AutoSetupWrapper";
import { AuthForm } from "@/components/auth/AuthForm";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { TrainerDashboard } from "@/components/trainer/TrainerDashboard";
import { AdminLayout } from "@/layouts/AdminLayout";
import NotFound from "./pages/NotFound";
import ClearCache from "./pages/ClearCache";
import AdminSetup from "./pages/AdminSetup";
import ApiTest from "./pages/ApiTest";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import UploadDemo from "./pages/UploadDemo";
import PasswordReset from "./pages/PasswordReset";
import ResetPasswords from "./pages/ResetPasswords";
import MpesaMigration from "./pages/MpesaMigration";
import ApiDiagnostics from "./pages/ApiDiagnostics";
import OverviewPage from "./pages/admin/OverviewPage";
import UsersPage from "./pages/admin/UsersPage";
import ApprovalsPage from "./pages/admin/ApprovalsPage";
import DisputesPage from "./pages/admin/DisputesPage";
import IssuesPage from "./pages/admin/IssuesPage";
import ContactsPage from "./pages/admin/ContactsPage";
import AnalyticsPage from "./pages/admin/AnalyticsPage";
import PromotionsPage from "./pages/admin/PromotionsPage";
import PayoutsPage from "./pages/admin/PayoutsPage";
import SMSManagerPage from "./pages/admin/SMSManagerPage";
import CategoriesPage from "./pages/admin/CategoriesPage";
import WaitlistPage from "./pages/admin/WaitlistPage";
import BookingsPage from "./pages/admin/BookingsPage";
import SettingsPage from "./pages/admin/SettingsPage";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, userType, loading } = useAuth();

  useEffect(() => {
    // Auth state updated
  }, [user, userType, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-gradient-primary mx-auto mb-4 animate-pulse"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/explore" replace />;
  }

  // Route based on user type
  switch (userType) {
    case "admin":
      return <Navigate to="/admin/overview" replace />;
    case "trainer":
      return <Navigate to="/trainer" replace />;
    case "client":
      return <Navigate to="/client" replace />;
    default:
      return <Navigate to="/client" replace />;
  }
};

const LoadingFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-gradient-primary mx-auto mb-4 animate-pulse"></div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const AppRoutes = () => (
  <Suspense fallback={<LoadingFallback />}>
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
      <Route path="/admin/*" element={<AdminLayout><AdminRoutes /></AdminLayout>} />
      <Route path="/trainer" element={<TrainerDashboard />} />
      <Route path="/client" element={<ClientDashboard />} />
      <Route path="/signin" element={<AuthForm onSuccess={(type) => {
        if (type === 'admin') window.location.href = "/admin";
        else if (type === 'trainer') window.location.href = "/trainer";
        else window.location.href = "/client";
      }} />} />
      <Route path="/signup" element={<AuthForm initialTab="signup" onSuccess={(type) => {
        if (type === 'admin') window.location.href = "/admin";
        else if (type === 'trainer') window.location.href = "/trainer";
        else window.location.href = "/client";
      }} />} />
      <Route path="/password-reset" element={<PasswordReset />} />
      <Route path="/reset-passwords" element={<ResetPasswords />} />
      <Route path="/setup" element={<AdminSetup />} />
      <Route path="/api-test" element={<ApiTest />} />
      <Route path="/explore" element={<Explore />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/home" element={<Home />} />
      <Route path="/clear-cache" element={<ClearCache />} />
      <Route path="/upload-demo" element={<UploadDemo />} />
      <Route path="/api-diagnostics" element={<ApiDiagnostics />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

const AdminRoutes = () => (
  <Routes>
    <Route path="overview" element={<OverviewPage />} />
    <Route path="users" element={<UsersPage />} />
    <Route path="approvals" element={<ApprovalsPage />} />
    <Route path="disputes" element={<DisputesPage />} />
    <Route path="issues" element={<IssuesPage />} />
    <Route path="contacts" element={<ContactsPage />} />
    <Route path="analytics" element={<AnalyticsPage />} />
    <Route path="promotions" element={<PromotionsPage />} />
    <Route path="payouts" element={<PayoutsPage />} />
    <Route path="sms-manager" element={<SMSManagerPage />} />
    <Route path="categories" element={<CategoriesPage />} />
    <Route path="waitlist" element={<WaitlistPage />} />
    <Route path="bookings" element={<BookingsPage />} />
    <Route path="settings" element={<SettingsPage />} />
    <Route path="reset-passwords" element={<ResetPasswords />} />
    <Route path="mpesamigration" element={<MpesaMigration />} />
    <Route path="*" element={<Navigate to="/admin/overview" replace />} />
  </Routes>
);

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <ApiConfigProvider>
              <AuthProvider>
                <AutoSetupWrapper>
                  <AppRoutes />
                </AutoSetupWrapper>
              </AuthProvider>
            </ApiConfigProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
