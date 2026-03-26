import React, { useEffect, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ApiConfigProvider } from "@/contexts/ApiConfigContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useIsMobile } from "@/hooks/use-mobile";
import { AutoSetupWrapper } from "@/components/AutoSetupWrapper";
import { initializeTimezoneDetection } from "@/lib/timezone";
import { AuthForm } from "@/components/auth/AuthForm";
import { TrainerSignupWithProfileModal } from "@/components/auth/TrainerSignupWithProfileModal";
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
import SignupStep2 from "./pages/SignupStep2";
import SignupClientStep2 from "./pages/SignupClientStep2";
import MpesaMigration from "./pages/MpesaMigration";
import ApiDiagnostics from "./pages/ApiDiagnostics";
import OverviewPage from "./pages/admin/OverviewPage";
import UsersPage from "./pages/admin/UsersPage";
import ApprovalsPage from "./pages/admin/ApprovalsPage";
import DisputesPage from "./pages/admin/DisputesPage";
import IssuesPage from "./pages/admin/IssuesPage";
import ContactsPage from "./pages/admin/ContactsPage";
import AnalyticsPage from "./pages/admin/AnalyticsPage";
import PayoutsPage from "./pages/admin/PayoutsPage";
import SMSManagerPage from "./pages/admin/SMSManagerPage";
import CategoriesPage from "./pages/admin/CategoriesPage";
import WaitlistPage from "./pages/admin/WaitlistPage";
import BookingsPage from "./pages/admin/BookingsPage";
import SettingsPage from "./pages/admin/SettingsPage";
import DocumentReviewPage from "./pages/admin/DocumentReviewPage";
import ResetPasswordsPage from "./pages/admin/ResetPasswordsPage";
import AnnouncementsPage from "./pages/admin/AnnouncementsPage";
import BookingConfirmation from "./pages/BookingConfirmation";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, userType, loading } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => {
    // Initialize timezone detection on app load
    initializeTimezoneDetection()
  }, []);

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
    // Mobile users go directly to Explore, desktop users see Home (intro) page
    return isMobile ? <Explore /> : <Home />;
  }

  // Check if user is in signup step 2 onboarding - don't redirect if they are
  const trainerStep2 = localStorage.getItem('trainer_signup_step2') === 'true';
  const clientStep2 = localStorage.getItem('client_signup_step2') === 'true';

  if (trainerStep2 && userType === 'trainer') {
    // Let trainer proceed to step 2 onboarding
    return <Navigate to="/signup-step2" replace />;
  }

  if (clientStep2 && userType === 'client') {
    // Let client proceed to step 2 onboarding
    return <Navigate to="/signup-client-step2" replace />;
  }

  // Route based on user type
  switch (userType) {
    case "admin":
      return <Navigate to="/admin/overview" replace />;
    case "trainer":
      return <Navigate to="/trainer" replace />;
    case "client":
      return <ClientDashboard />;
    default:
      return <ClientDashboard />;
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
      <Route path="/signup" element={<TrainerSignupWithProfileModal onSuccess={(type) => {
        // Note: Trainers are redirected by the component itself after step 2 onboarding
        if (type === 'admin') window.location.href = "/admin";
        else if (type !== 'trainer') window.location.href = "/client";
      }} />} />
      <Route path="/signup-step2" element={<SignupStep2 />} />
      <Route path="/signup-client-step2" element={<SignupClientStep2 />} />
      <Route path="/booking-confirmation/:bookingId" element={<BookingConfirmation />} />
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
    <Route path="document-review" element={<DocumentReviewPage />} />
    <Route path="disputes" element={<DisputesPage />} />
    <Route path="issues" element={<IssuesPage />} />
    <Route path="contacts" element={<ContactsPage />} />
    <Route path="analytics" element={<AnalyticsPage />} />
    <Route path="payouts" element={<PayoutsPage />} />
    <Route path="sms-manager" element={<SMSManagerPage />} />
    <Route path="announcements" element={<AnnouncementsPage />} />
    <Route path="categories" element={<CategoriesPage />} />
    <Route path="waitlist" element={<WaitlistPage />} />
    <Route path="bookings" element={<BookingsPage />} />
    <Route path="settings" element={<SettingsPage />} />
    <Route path="reset-passwords" element={<ResetPasswordsPage />} />
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
