import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Check, AlertTriangle, Key } from "lucide-react";
import { useCreateIntegrationAPIKey } from "@/hooks/useIntegrationAPIKeys";
import { toast } from "sonner";

interface CreateAPIKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAPIKeyModal({ open, onOpenChange }: CreateAPIKeyModalProps) {
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState({
    send_message: true,
    read_contacts: true,
  });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createAPIKey = useCreateIntegrationAPIKey();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Digite um nome para a API Key");
      return;
    }

    const result = await createAPIKey.mutateAsync({
      name: name.trim(),
      permissions,
    });

    setCreatedKey(result.api_key);
  };

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      toast.success("API Key copiada!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setName("");
    setPermissions({ send_message: true, read_contacts: true });
    setCreatedKey(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {createdKey ? "API Key Criada" : "Nova API Key"}
          </DialogTitle>
          <DialogDescription>
            {createdKey
              ? "Copie sua API Key agora. Ela não será exibida novamente."
              : "Crie uma nova chave de API para integrar com sistemas externos."}
          </DialogDescription>
        </DialogHeader>

        {createdKey ? (
          <div className="space-y-4">
            <Alert variant="destructive" className="border-amber-500 bg-amber-50 text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> Esta é a única vez que você verá esta chave. 
                Copie e guarde em local seguro.
              </AlertDescription>
            </Alert>

            <div className="flex items-center gap-2">
              <Input
                value={createdKey}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da API Key</Label>
              <Input
                id="name"
                placeholder="Ex: N8N Integration, Zapier, etc."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>Permissões</Label>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send_message"
                  checked={permissions.send_message}
                  onCheckedChange={(checked) =>
                    setPermissions((prev) => ({ ...prev, send_message: !!checked }))
                  }
                />
                <label
                  htmlFor="send_message"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Enviar mensagens
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="read_contacts"
                  checked={permissions.read_contacts}
                  onCheckedChange={(checked) =>
                    setPermissions((prev) => ({ ...prev, read_contacts: !!checked }))
                  }
                />
                <label
                  htmlFor="read_contacts"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Ler contatos
                </label>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {createdKey ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createAPIKey.isPending || !name.trim()}
              >
                {createAPIKey.isPending ? "Criando..." : "Gerar API Key"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
