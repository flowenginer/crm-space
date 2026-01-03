import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Share, Plus, MoreVertical, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DeviceType = "ios" | "android" | "desktop";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPWA() {
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detect device
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) {
      setDevice("ios");
    } else if (/android/i.test(ua)) {
      setDevice("android");
    } else {
      setDevice("desktop");
    }

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const iosSteps = [
    {
      icon: Share,
      title: "Toque no ícone de Compartilhar",
      description: "Na barra inferior do Safari",
    },
    {
      icon: Plus,
      title: "Toque em 'Adicionar à Tela de Início'",
      description: "Role para baixo se necessário",
    },
    {
      icon: Check,
      title: "Toque em 'Adicionar'",
      description: "O app aparecerá na sua tela inicial",
    },
  ];

  const androidSteps = [
    {
      icon: MoreVertical,
      title: "Toque no menu (⋮)",
      description: "No canto superior direito do Chrome",
    },
    {
      icon: Smartphone,
      title: "Toque em 'Instalar aplicativo'",
      description: "Ou 'Adicionar à tela inicial'",
    },
    {
      icon: Check,
      title: "Confirme a instalação",
      description: "O app aparecerá na sua tela inicial",
    },
  ];

  const steps = device === "ios" ? iosSteps : androidSteps;

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle>App Instalado!</CardTitle>
            <CardDescription>
              O CRM Space Sports já está instalado no seu dispositivo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="/mobile/conversations">Abrir App</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 safe-area-inset-top safe-area-inset-bottom">
      <div className="max-w-md mx-auto space-y-6 py-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="h-20 w-20 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-lg">
            <Smartphone className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Instalar CRM</h1>
          <p className="text-muted-foreground">
            Instale o app para acesso rápido e atendimento onde você estiver
          </p>
        </div>

        {/* Native Install Button (Android/Desktop) */}
        {deferredPrompt && (
          <Button onClick={handleInstall} size="lg" className="w-full">
            Instalar Agora
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}

        {/* Manual Steps (iOS or fallback) */}
        {(device === "ios" || !deferredPrompt) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Como instalar no {device === "ios" ? "iPhone/iPad" : "Android"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="flex gap-4">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                      "bg-primary/10 text-primary"
                    )}
                  >
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{step.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Benefits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vantagens do App</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                "Acesso rápido pela tela inicial",
                "Funciona mesmo offline",
                "Notificações de novas mensagens",
                "Interface otimizada para celular",
                "Navegação por gestos (swipe)",
              ].map((benefit, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Continue without installing */}
        <div className="text-center">
          <Button variant="ghost" asChild>
            <a href="/mobile/conversations">Continuar sem instalar</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
