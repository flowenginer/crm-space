import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);
    
    // Log context for debugging
    const userStore = localStorage.getItem('user-storage');
    if (userStore) {
      try {
        const parsed = JSON.parse(userStore);
        console.error('User context at error:', {
          tenantId: parsed?.state?.tenantId,
          profileId: parsed?.state?.profile?.id,
          roles: parsed?.state?.roles,
        });
      } catch (e) {
        console.error('Could not parse user store');
      }
    }
    
    this.setState({ errorInfo });
  }

  private handleSignOut = async () => {
    // Clear all local storage and reload
    localStorage.removeItem('user-storage');
    localStorage.removeItem('sb-akebxmyjxngfopajjjpm-auth-token');
    window.location.href = '/auth';
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-lg p-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            
            <h1 className="text-xl font-semibold text-foreground">
              Ops, algo deu errado
            </h1>
            
            <p className="text-muted-foreground text-sm">
              Ocorreu um erro inesperado. Você pode tentar recarregar a página ou sair e entrar novamente.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="text-left bg-muted/50 p-3 rounded text-xs overflow-auto max-h-32">
                <p className="font-mono text-destructive">{this.state.error.message}</p>
              </div>
            )}
            
            <div className="flex gap-3 justify-center pt-2">
              <Button
                variant="outline"
                onClick={this.handleReload}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Recarregar
              </Button>
              
              <Button
                variant="destructive"
                onClick={this.handleSignOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
