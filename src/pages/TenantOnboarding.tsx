import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useCreateTenant, generateTenantSlug, useAssignUserToTenant } from '@/hooks/useTenant';
import { useUserStore } from '@/store/userStore';
import { toast } from 'sonner';

export default function TenantOnboarding() {
  const navigate = useNavigate();
  const createTenantMutation = useCreateTenant();
  const assignUserMutation = useAssignUserToTenant();
  const { profile } = useUserStore();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    companyName: '',
    phone: '',
    email: '',
  });

  const isCreating = createTenantMutation.isPending || assignUserMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.companyName.trim()) {
      toast.error('Por favor, informe o nome da empresa');
      return;
    }

    if (!profile?.id) {
      toast.error('Usuário não encontrado. Faça login novamente.');
      return;
    }

    try {
      // Create tenant
      const newTenant = await createTenantMutation.mutateAsync({
        name: formData.companyName,
        slug: generateTenantSlug(formData.companyName),
      });
      
      // Assign user to tenant
      await assignUserMutation.mutateAsync({
        userId: profile.id,
        tenantId: newTenant.id,
      });
      
      setStep(3);
      
      // Redirect after success animation
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('Error creating tenant:', error);
      // Toast is handled by the hook
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                s === step
                  ? 'w-8 bg-primary'
                  : s < step
                  ? 'w-8 bg-primary/60'
                  : 'w-2 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        <Card className="border-border/50 shadow-2xl backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              {step === 3 ? (
                <CheckCircle2 className="h-8 w-8 text-primary animate-in zoom-in duration-300" />
              ) : (
                <Building2 className="h-8 w-8 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold">
              {step === 1 && 'Bem-vindo!'}
              {step === 2 && 'Quase lá!'}
              {step === 3 && 'Tudo pronto!'}
            </CardTitle>
            <CardDescription className="text-base">
              {step === 1 && 'Vamos configurar sua empresa em poucos passos'}
              {step === 2 && 'Informações opcionais de contato'}
              {step === 3 && 'Sua empresa foi criada com sucesso'}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            {step === 1 && (
              <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-sm font-medium">
                    Nome da Empresa *
                  </Label>
                  <Input
                    id="companyName"
                    placeholder="Sua Empresa Ltda"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="h-12 text-base"
                    autoFocus
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-12 text-base font-medium">
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium">
                      Telefone (opcional)
                    </Label>
                    <Input
                      id="phone"
                      placeholder="(11) 99999-9999"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      E-mail comercial (opcional)
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="contato@suaempresa.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="h-12 text-base"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12"
                    onClick={() => setStep(1)}
                  >
                    Voltar
                  </Button>
                  <Button type="submit" className="flex-1 h-12 text-base font-medium" disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        Criar Empresa
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}

            {step === 3 && (
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-2 text-primary font-medium">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecionando para o painel...
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Você poderá editar essas informações depois nas configurações
        </p>
      </div>
    </div>
  );
}
