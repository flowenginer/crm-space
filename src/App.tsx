import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Layout
import { MainLayout } from "@/components/layout/MainLayout";

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
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
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
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/quick-messages" element={<QuickMessages />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/whatsapp-channels" element={<WhatsAppChannels />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
