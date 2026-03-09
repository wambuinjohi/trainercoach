import React, { useEffect, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ApiConfigProvider } from "@/contexts/ApiConfigContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AutoSetupWrapper } from "@/components/AutoSetupWrapper";
import { AuthForm } from "@/components/auth/AuthForm";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { TrainerDashboard } from "@/components/trainer/TrainerDashboard";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
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
    return <Home />;
  }

  // Route based on user type
  switch (userType) {
    case "client":
      return <ClientDashboard />;
    case "trainer":
      return <TrainerDashboard />;
    case "admin":
      return <AdminDashboard />;
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
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/trainer" element={<TrainerDashboard />} />
      <Route path="/client" element={<ClientDashboard />} />
      <Route path="/signin" element={<AuthForm onSuccess={() => (window.location.href = "/")} />} />
      <Route path="/signup" element={<AuthForm initialTab="signup" onSuccess={() => (window.location.href = "/")} />} />
      <Route path="/password-reset" element={<PasswordReset />} />
      <Route path="/reset-passwords" element={<ResetPasswords />} />
      <Route path="/admin/reset-passwords" element={<ResetPasswords />} />
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
      <Route path="/admin/mpesamigration" element={<MpesaMigration />} />
      <Route path="/api-diagnostics" element={<ApiDiagnostics />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
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
