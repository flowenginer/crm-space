import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GamificationProvider } from "@/contexts/GamificationContext";

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
import CRMSettings from "@/pages/CRMSettings";
import WhatsAppChannels from "@/pages/WhatsAppChannels";
import Contacts from "@/pages/Contacts";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import ScheduledMessages from "@/pages/ScheduledMessages";
import LiveMonitor from "@/pages/LiveMonitor";
import ConversationReport from "@/pages/ConversationReport";
import CampaignReport from "@/pages/CampaignReport";
import MetaAdsManager from "@/pages/MetaAdsManager";
import Automations from "@/pages/Automations";
import FlowEditor from "@/pages/FlowEditor";
import Webhooks from "@/pages/Webhooks";
import ContactRequests from "@/pages/ContactRequests";
import InternalChat from "@/pages/InternalChat";
import InternalEmail from "@/pages/InternalEmail";
import Attributes from "@/pages/products/Attributes";
import PriceRules from "@/pages/products/PriceRules";
import Catalogs from "@/pages/products/Catalogs";
import Products from "@/pages/products/Products";
import Templates from "@/pages/products/Templates";
import Orders from "@/pages/Orders";
import OrderSettings from "@/pages/orders/Settings";
import Quotes from "@/pages/Quotes";
import Financial from "@/pages/Financial";
import SellerDashboard from "@/pages/SellerDashboard";
import RescueTemplates from "@/pages/RescueTemplates";
import Gamification from "@/pages/Gamification";
import GamificationRankings from "@/pages/gamification/Rankings";
import GamificationAchievements from "@/pages/gamification/Achievements";
import GamificationSettings from "@/pages/gamification/Settings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <GamificationProvider>
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
              <Route path="/" element={
                <ProtectedRoute permission="dashboard.view">
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/conversations" element={
                <ProtectedRoute permission="conversations.view">
                  <Conversations />
                </ProtectedRoute>
              } />
              <Route path="/internal-chat" element={
                <ProtectedRoute permission="internal_chat.view">
                  <InternalChat />
                </ProtectedRoute>
              } />
              <Route path="/internal-email" element={
                <ProtectedRoute permission="internal_email.view">
                  <InternalEmail />
                </ProtectedRoute>
              } />
              <Route path="/conversations/requests" element={
                <ProtectedRoute permission="conversations.requests">
                  <ContactRequests />
                </ProtectedRoute>
              } />
              <Route path="/quick-messages" element={
                <ProtectedRoute permission="templates.view">
                  <QuickMessages />
                </ProtectedRoute>
              } />
              <Route path="/rescue-templates" element={
                <ProtectedRoute permission="templates.view">
                  <RescueTemplates />
                </ProtectedRoute>
              } />
              <Route path="/crm" element={
                <ProtectedRoute permission="deals.view">
                  <CRM />
                </ProtectedRoute>
              } />
              <Route path="/crm/settings" element={
                <ProtectedRoute permission="deals.view">
                  <CRMSettings />
                </ProtectedRoute>
              } />
              <Route path="/whatsapp-channels" element={
                <ProtectedRoute permission="channels.view">
                  <WhatsAppChannels />
                </ProtectedRoute>
              } />
              <Route path="/contacts" element={
                <ProtectedRoute permission="contacts.view">
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
                <ProtectedRoute permission="schedules.view">
                  <ScheduledMessages />
                </ProtectedRoute>
              } />
              <Route path="/ao-vivo" element={
                <ProtectedRoute permission="live.view">
                  <LiveMonitor />
                </ProtectedRoute>
              } />
              <Route path="/relatorios/atendimentos" element={
                <ProtectedRoute permission="reports.view">
                  <ConversationReport />
                </ProtectedRoute>
              } />
              <Route path="/relatorios/campanhas" element={
                <ProtectedRoute permission="marketing.view_campaigns">
                  <CampaignReport />
                </ProtectedRoute>
              } />
              <Route path="/relatorio-campanhas" element={
                <ProtectedRoute permission="marketing.view_campaigns">
                  <CampaignReport />
                </ProtectedRoute>
              } />
              <Route path="/meta-ads" element={
                <ProtectedRoute permission="marketing.view">
                  <MetaAdsManager />
                </ProtectedRoute>
              } />
              <Route path="/automations" element={
                <ProtectedRoute permission="automations.view">
                  <Automations />
                </ProtectedRoute>
              } />
              <Route path="/automations/:id/edit" element={
                <ProtectedRoute permission="automations.update">
                  <FlowEditor />
                </ProtectedRoute>
              } />
              <Route path="/automations/:id/stats" element={
                <ProtectedRoute permission="automations.view">
                  <Automations />
                </ProtectedRoute>
              } />
              <Route path="/webhooks" element={
                <ProtectedRoute permission="webhooks.view">
                  <Webhooks />
                </ProtectedRoute>
              } />
              <Route path="/products/attributes" element={
                <ProtectedRoute permission="products.view">
                  <Attributes />
                </ProtectedRoute>
              } />
              <Route path="/products/price-rules" element={
                <ProtectedRoute permission="products.view">
                  <PriceRules />
                </ProtectedRoute>
              } />
              <Route path="/products/catalogs" element={
                <ProtectedRoute permission="products.view">
                  <Catalogs />
                </ProtectedRoute>
              } />
              <Route path="/products" element={
                <ProtectedRoute permission="products.view">
                  <Products />
                </ProtectedRoute>
              } />
              <Route path="/products/templates" element={
                <ProtectedRoute permission="products.view">
                  <Templates />
                </ProtectedRoute>
              } />
              <Route path="/orders" element={
                <ProtectedRoute permission="orders.view">
                  <Orders />
                </ProtectedRoute>
              } />
              <Route path="/orders/settings" element={
                <ProtectedRoute permission="orders.manage_settings">
                  <OrderSettings />
                </ProtectedRoute>
              } />
              <Route path="/quotes" element={
                <ProtectedRoute permission="quotes.view">
                  <Quotes />
                </ProtectedRoute>
              } />
              <Route path="/financial" element={
                <ProtectedRoute permission="financial.view">
                  <Financial />
                </ProtectedRoute>
              } />
              <Route path="/seller-dashboard" element={
                <ProtectedRoute permission="seller.view">
                  <SellerDashboard />
                </ProtectedRoute>
              } />
              <Route path="/gamification" element={
                <ProtectedRoute permission="dashboard.view">
                  <Gamification />
                </ProtectedRoute>
              } />
              <Route path="/gamification/rankings" element={
                <ProtectedRoute permission="dashboard.view">
                  <GamificationRankings />
                </ProtectedRoute>
              } />
              <Route path="/gamification/achievements" element={
                <ProtectedRoute permission="dashboard.view">
                  <GamificationAchievements />
                </ProtectedRoute>
              } />
              <Route path="/gamification/settings" element={
                <ProtectedRoute permission="settings.view">
                  <GamificationSettings />
                </ProtectedRoute>
              } />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </GamificationProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
