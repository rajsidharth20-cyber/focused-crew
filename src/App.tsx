import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Install from "./pages/Install";
import StudyTimer from "./pages/StudyTimer";
import Planner from "./pages/Planner";
import More from "./pages/More";

import Chat, { ChatThread } from "./pages/Chat";
import UserProfile from "./pages/UserProfile";
import StudyGroups from "./pages/StudyGroups";
import GroupDashboard from "./pages/GroupDashboard";
import GroupChat from "./pages/GroupChat";

import ResetPassword from "./pages/ResetPassword";
import GoogleCallback from "./pages/GoogleCallback";
import NotificationSettings from "./pages/NotificationSettings";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isGuest } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  return (user || isGuest) ? <>{children}</> : <Navigate to="/auth" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/install" element={<Install />} />
            <Route path="/google-callback" element={<GoogleCallback />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/study" element={<ProtectedRoute><StudyTimer /></ProtectedRoute>} />
            <Route path="/planner" element={<ProtectedRoute><Planner /></ProtectedRoute>} />
            <Route path="/more" element={<ProtectedRoute><More /></ProtectedRoute>} />

            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/chat/:userId" element={<ProtectedRoute><ChatThread /></ProtectedRoute>} />
            <Route path="/u/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/groups" element={<ProtectedRoute><StudyGroups /></ProtectedRoute>} />
            <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDashboard /></ProtectedRoute>} />
            <Route path="/groups/:groupId/chat" element={<ProtectedRoute><GroupChat /></ProtectedRoute>} />

            <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
