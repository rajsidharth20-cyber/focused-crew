import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PlannerProvider } from "@/hooks/use-planner-store";
import Index from "./pages/Index";
import Auth from "./pages/Auth";

const Install = lazy(() => import("./pages/Install"));
const StudyTimer = lazy(() => import("./pages/StudyTimer"));
const AddSession = lazy(() => import("./pages/AddSession"));
const Planner = lazy(() => import("./pages/Planner"));
const More = lazy(() => import("./pages/More"));
const Copilot = lazy(() => import("./pages/Copilot"));
const Chat = lazy(() => import("./pages/Chat"));
const ChatThread = lazy(() => import("./pages/Chat").then(m => ({ default: m.ChatThread })));
const SocialHub = lazy(() => import("./pages/SocialHub"));
const Feed = lazy(() => import("./pages/Feed"));
const Notes = lazy(() => import("./pages/Notes"));
const Announcements = lazy(() => import("./pages/Announcements"));
const AdminAnnouncements = lazy(() => import("./pages/AdminAnnouncements"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const StudyGroups = lazy(() => import("./pages/StudyGroups"));
const GroupDashboard = lazy(() => import("./pages/GroupDashboard"));
const GroupChat = lazy(() => import("./pages/GroupChat"));
const FocusBotSettings = lazy(() => import("./pages/FocusBotSettings"));
const FocusBotChat = lazy(() => import("./pages/FocusBotChat"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const GoogleCallback = lazy(() => import("./pages/GoogleCallback"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
);

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
          <PlannerProvider>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/install" element={<Install />} />
            <Route path="/google-callback" element={<GoogleCallback />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/study" element={<ProtectedRoute><StudyTimer /></ProtectedRoute>} />
            <Route path="/study/add-session" element={<ProtectedRoute><AddSession /></ProtectedRoute>} />
            <Route path="/planner" element={<ProtectedRoute><Planner /></ProtectedRoute>} />
            <Route path="/copilot" element={<ProtectedRoute><Copilot /></ProtectedRoute>} />
            <Route path="/more" element={<ProtectedRoute><More /></ProtectedRoute>} />

            <Route path="/social" element={<ProtectedRoute><SocialHub /></ProtectedRoute>} />
            <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
            <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
            <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
            <Route path="/admin/announcements" element={<ProtectedRoute><AdminAnnouncements /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/chat/:userId" element={<ProtectedRoute><ChatThread /></ProtectedRoute>} />
             <Route path="/focusbot" element={<ProtectedRoute><FocusBotChat /></ProtectedRoute>} />
            <Route path="/u/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/groups" element={<ProtectedRoute><StudyGroups /></ProtectedRoute>} />
            <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDashboard /></ProtectedRoute>} />
            <Route path="/groups/:groupId/chat" element={<ProtectedRoute><GroupChat /></ProtectedRoute>} />
             <Route path="/groups/:groupId/bots/focusbot" element={<ProtectedRoute><FocusBotSettings /></ProtectedRoute>} />

            <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </PlannerProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
