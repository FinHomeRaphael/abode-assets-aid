import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Savings from "./pages/Savings";
import AccountDetail from "./pages/AccountDetail";
import Profile from "./pages/Profile";
import StartOfMonth from "./pages/StartOfMonth";
import FinanceChat from "./pages/FinanceChat";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useApp();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-2xl">🏠</div></div>;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useApp();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-2xl">🏠</div></div>;
  if (isLoggedIn) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
    <Route path="/budgets" element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
    <Route path="/savings" element={<ProtectedRoute><Savings /></ProtectedRoute>} />
    <Route path="/account/:id" element={<ProtectedRoute><AccountDetail /></ProtectedRoute>} />
    <Route path="/start-of-month" element={<ProtectedRoute><StartOfMonth /></ProtectedRoute>} />
    <Route path="/chat" element={<ProtectedRoute><FinanceChat /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

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
