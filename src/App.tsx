import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import LoginPage from "./pages/LoginPage";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Savings from "./pages/Savings";
import AccountDetail from "./pages/AccountDetail";
import Profile from "./pages/Profile";
import StartOfMonth from "./pages/StartOfMonth";
import FinanceChat from "./pages/FinanceChat";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold mx-auto mb-4 animate-pulse">F</div>
        <p className="text-muted-foreground text-sm">Chargement...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isLoggedIn, isOnboarded, loading } = useApp();

  if (loading) return <LoadingScreen />;
  if (!isLoggedIn) return <LoginPage />;
  if (!isOnboarded) return <Onboarding />;

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/transactions" element={<Transactions />} />
      <Route path="/budgets" element={<Budgets />} />
      <Route path="/savings" element={<Savings />} />
      <Route path="/account/:id" element={<AccountDetail />} />
      <Route path="/start-of-month" element={<StartOfMonth />} />
      <Route path="/chat" element={<FinanceChat />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
