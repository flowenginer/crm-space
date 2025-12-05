import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";

// Layout
import { MainLayout } from "@/components/layout/MainLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Auth pages
import Auth from "@/pages/Auth";
import Register from "@/pages/Register";

// Main pages
import Dashboard from "@/pages/Dashboard";
import Conversations from "@/pages/Conversations";
import QuickMessages from "@/pages/QuickMessages";
import CRM from "@/pages/CRM";
import WhatsAppChannels from "@/pages/WhatsAppChannels";
import Contacts from "@/pages/Contacts";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import ScheduledMessages from "@/pages/ScheduledMessages";
import LiveMonitor from "@/pages/LiveMonitor";
import ConversationReport from "@/pages/ConversationReport";
import CampaignReport from "@/pages/CampaignReport";
import MetaAdsManager from "@/pages/MetaAdsManager";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Auth routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/register" element={<Register />} />

            {/* Protected routes with MainLayout */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/conversations" element={
                <ProtectedRoute permission="conversations.read">
                  <Conversations />
                </ProtectedRoute>
              } />
              <Route path="/quick-messages" element={
                <ProtectedRoute permission="templates.read">
                  <QuickMessages />
                </ProtectedRoute>
              } />
              <Route path="/crm" element={
                <ProtectedRoute permission="deals.read">
                  <CRM />
                </ProtectedRoute>
              } />
              <Route path="/whatsapp-channels" element={
                <ProtectedRoute permission="channels.read">
                  <WhatsAppChannels />
                </ProtectedRoute>
              } />
              <Route path="/contacts" element={
                <ProtectedRoute permission="contacts.read">
                  <Contacts />
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute permission="reports.view">
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute permission="settings.view">
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/agendamentos" element={
                <ProtectedRoute permission="templates.read">
                  <ScheduledMessages />
                </ProtectedRoute>
              } />
              <Route path="/ao-vivo" element={
                <ProtectedRoute permission="settings.view">
                  <LiveMonitor />
                </ProtectedRoute>
              } />
              <Route path="/relatorios/atendimentos" element={
                <ProtectedRoute permission="reports.view">
                  <ConversationReport />
                </ProtectedRoute>
              } />
              <Route path="/relatorios/campanhas" element={
                <ProtectedRoute permission="reports.view">
                  <CampaignReport />
                </ProtectedRoute>
              } />
              <Route path="/relatorio-campanhas" element={
                <ProtectedRoute permission="reports.view">
                  <CampaignReport />
                </ProtectedRoute>
              } />
              <Route path="/meta-ads" element={
                <ProtectedRoute permission="reports.view">
                  <MetaAdsManager />
                </ProtectedRoute>
              } />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
