import { Phone, Mail, MapPin, Tag, Calendar, MessageSquare, Edit, ExternalLink, DollarSign, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Contact {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  avatar_url?: string;
  city?: string;
  state?: string;
  lead_status?: string;
  created_at?: string;
  notes?: string;
  tags?: Array<{ id: string; name: string; color: string }>;
  negotiated_value?: number;
  origin?: string;
  origin_campaign?: string;
}

interface MobileContactDetailsProps {
  contact?: Contact;
  onCall?: () => void;
  onEdit?: () => void;
}

export function MobileContactDetails({
  contact,
  onCall,
  onEdit,
}: MobileContactDetailsProps) {
  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/20 text-muted-foreground">
        <div className="text-center p-8">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="h-8 w-8" />
          </div>
          <h3 className="font-medium text-foreground mb-1">
            Detalhes do contato
          </h3>
          <p className="text-sm">
            Deslize para a direita para ver os detalhes
          </p>
        </div>
      </div>
    );
  }

  const initials = contact.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const statusColors: Record<string, string> = {
    new: "bg-blue-500",
    qualified: "bg-green-500",
    negotiation: "bg-yellow-500",
    won: "bg-emerald-500",
    lost: "bg-red-500",
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-6 border-b border-border text-center safe-area-inset-top">
        <Avatar className="h-20 w-20 mx-auto mb-3">
          <AvatarImage src={contact.avatar_url} />
          <AvatarFallback className="bg-primary/10 text-primary text-2xl">
            {initials}
          </AvatarFallback>
        </Avatar>
        <h1 className="text-xl font-bold text-foreground mb-1">
          {contact.full_name}
        </h1>
        {contact.lead_status && (
          <Badge
            variant="secondary"
            className={`${statusColors[contact.lead_status] || "bg-gray-500"} text-white`}
          >
            {contact.lead_status}
          </Badge>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 p-4 border-b border-border">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => window.open(`tel:${contact.phone}`, "_blank")}
        >
          <Phone className="h-4 w-4 mr-2" />
          Ligar
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() =>
            window.open(`https://wa.me/${contact.phone.replace(/\D/g, "")}`, "_blank")
          }
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          WhatsApp
        </Button>
        <Button variant="outline" size="icon" onClick={onEdit}>
          <Edit className="h-4 w-4" />
        </Button>
      </div>

      {/* Details */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Informações
            </h3>

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium">{contact.phone}</p>
              </div>
            </div>

            {contact.email && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{contact.email}</p>
                </div>
              </div>
            )}

            {(contact.city || contact.state) && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Localização</p>
                  <p className="font-medium">
                    {[contact.city, contact.state].filter(Boolean).join(", ")}
                  </p>
                </div>
              </div>
            )}

            {contact.created_at && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Cliente desde</p>
                  <p className="font-medium">
                    {format(new Date(contact.created_at), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Value & Origin */}
          {(contact.negotiated_value || contact.origin) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Negociação
                </h3>

                {contact.negotiated_value && contact.negotiated_value > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Negociado</p>
                      <p className="font-bold text-green-600 text-lg">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(contact.negotiated_value)}
                      </p>
                    </div>
                  </div>
                )}

                {contact.origin && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Target className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Origem</p>
                      <p className="font-medium">{contact.origin}</p>
                      {contact.origin_campaign && (
                        <p className="text-xs text-muted-foreground">{contact.origin_campaign}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {contact.tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    style={{ borderColor: tag.color, color: tag.color }}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {contact.notes && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Observações
                </h3>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {contact.notes}
                </p>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
