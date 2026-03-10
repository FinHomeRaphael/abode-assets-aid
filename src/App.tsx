import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Savings from "./pages/Savings";
import Debts from "./pages/Debts";
import AccountDetail from "./pages/AccountDetail";
import Profile from "./pages/Profile";
import StartOfMonth from "./pages/StartOfMonth";
import FinanceChat from "./pages/FinanceChat";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Pricing from "./pages/Pricing";

import HealthScore from "./pages/HealthScore";
import Aide from "./pages/Aide";
import AdminDashboard from "./pages/AdminDashboard";
import InvitationChoiceModal from "./components/InvitationChoiceModal";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

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

function InvitationChecker({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, session, householdId } = useApp();
  const location = useLocation();
  const [invitationData, setInvitationData] = useState<any>(null);
  const [checked, setChecked] = useState(false);

  // Skip invitation check on reset-password page
  const isResetPasswordPage = location.pathname === '/reset-password';

  const checkInvitations = useCallback(async () => {
    if (!session?.user || isResetPasswordPage) { setChecked(true); return; }

    // Check user metadata for invitation_id (from signup)
    const invitationId = session.user.user_metadata?.invitation_id;
    
    // Also check for pending invitations by email
    const { data: pendingInvs } = await supabase
      .from('invitations')
      .select('*')
      .eq('email', session.user.email || '')
      .eq('status', 'pending');

    const pendingInv = pendingInvs?.[0];

    if (invitationId || pendingInv) {
      const targetInvId = invitationId || pendingInv?.id;
      // Validate the invitation
      const token = pendingInv?.token;
      if (token) {
        const { data } = await supabase.rpc('validate_invitation_token', { _token: token });
        const info = data as any;
        if (info?.valid) {
          setInvitationData({
            invitation_id: info.invitation_id,
            household_name: info.household_name,
            household_currency: info.household_currency,
            member_count: info.member_count,
            inviter_name: info.inviter_name,
            hasExistingHousehold: !!householdId,
          });
        }
      } else if (invitationId) {
        // Invitation from metadata, fetch info differently
        const { data: inv } = await supabase
          .from('invitations')
          .select('*')
          .eq('id', invitationId)
          .eq('status', 'pending')
          .single();
        if (inv?.token) {
          const { data } = await supabase.rpc('validate_invitation_token', { _token: inv.token });
          const info = data as any;
          if (info?.valid) {
            setInvitationData({
              invitation_id: info.invitation_id,
              household_name: info.household_name,
              household_currency: info.household_currency,
              member_count: info.member_count,
              inviter_name: info.inviter_name,
              hasExistingHousehold: !!householdId,
            });
          }
        }
      }

      // Clear the metadata flag
      if (invitationId) {
        await supabase.auth.updateUser({ data: { invitation_id: null, skip_household_creation: null } });
      }
    }
    setChecked(true);
  }, [session, householdId, isResetPasswordPage]);

  useEffect(() => {
    if (isLoggedIn) {
      checkInvitations();
    } else {
      setChecked(true);
    }
  }, [isLoggedIn, checkInvitations]);

  const handleComplete = () => {
    setInvitationData(null);
    // Force reload to refresh context
    window.location.reload();
  };

  if (!checked && isLoggedIn) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-2xl">🏠</div></div>;
  }

  return (
    <>
      {children}
      <InvitationChoiceModal
        open={!!invitationData}
        invitation={invitationData}
        onComplete={handleComplete}
      />
    </>
  );
}

const AppRoutes = () => (
  <InvitationChecker>
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
      <Route path="/budgets" element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
      <Route path="/savings" element={<ProtectedRoute><Savings /></ProtectedRoute>} />
      <Route path="/debts" element={<ProtectedRoute><Debts /></ProtectedRoute>} />
      
      <Route path="/health-score" element={<ProtectedRoute><HealthScore /></ProtectedRoute>} />
      <Route path="/account/:id" element={<ProtectedRoute><AccountDetail /></ProtectedRoute>} />
      <Route path="/start-of-month" element={<ProtectedRoute><StartOfMonth /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><FinanceChat /></ProtectedRoute>} />
      <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
      <Route path="/aide" element={<ProtectedRoute><Aide /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </InvitationChecker>
);

// App root
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
