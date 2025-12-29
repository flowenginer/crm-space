import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreditCard, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

const cardFormSchema = z.object({
  cardNumber: z.string()
    .min(19, "Número do cartão inválido")
    .max(19, "Número do cartão inválido"),
  cardholderName: z.string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .regex(/^[A-Za-zÀ-ÿ\s]+$/, "Nome deve conter apenas letras"),
  expirationDate: z.string()
    .regex(/^(0[1-9]|1[0-2])\/([0-9]{2})$/, "Data inválida (MM/AA)"),
  cvv: z.string()
    .min(3, "CVV inválido")
    .max(4, "CVV inválido"),
  cpf: z.string()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido"),
  installments: z.string(),
});

type CardFormData = z.infer<typeof cardFormSchema>;

interface CreditCardFormProps {
  paymentLinkId: string;
  amount: number;
  maxInstallments: number;
  onSuccess: (data: { transactionId?: string; authorizationCode?: string }) => void;
  onError: (message: string) => void;
  onProcessing: () => void;
  isProcessing?: boolean;
}

export function CreditCardForm({
  paymentLinkId,
  amount,
  maxInstallments,
  onSuccess,
  onError,
  onProcessing,
  isProcessing = false,
}: CreditCardFormProps) {
  const [cardBrand, setCardBrand] = useState<string>("");
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CardFormData>({
    resolver: zodResolver(cardFormSchema),
    defaultValues: {
      installments: "1",
    },
  });

  const selectedInstallments = watch("installments");

  // Detect card brand from number
  const detectCardBrand = (number: string) => {
    const cleaned = number.replace(/\s/g, "");
    if (/^4/.test(cleaned)) return "visa";
    if (/^5[1-5]/.test(cleaned)) return "mastercard";
    if (/^3[47]/.test(cleaned)) return "amex";
    if (/^6(?:011|5)/.test(cleaned)) return "discover";
    if (/^(36|38|30[0-5])/.test(cleaned)) return "diners";
    if (/^35(2[89]|[3-8])/.test(cleaned)) return "jcb";
    if (/^(606282|3841)/.test(cleaned)) return "hipercard";
    if (/^(50|636368|438935|504175|451416|636297)/.test(cleaned)) return "elo";
    return "";
  };

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 16);
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(" ") : cleaned;
  };

  // Format expiration date
  const formatExpiration = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 4);
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    return cleaned;
  };

  // Format CPF
  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
    if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setValue("cardNumber", formatted);
    setCardBrand(detectCardBrand(formatted));
  };

  const handleExpirationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue("expirationDate", formatExpiration(e.target.value));
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue("cpf", formatCPF(e.target.value));
  };

  const handleCVVChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 4);
    setValue("cvv", cleaned);
  };

  // Generate installment options
  const installmentOptions = Array.from({ length: maxInstallments }, (_, i) => {
    const installmentNumber = i + 1;
    const installmentValue = amount / installmentNumber;
    return {
      value: String(installmentNumber),
      label: installmentNumber === 1 
        ? `À vista - ${formatCurrency(amount)}`
        : `${installmentNumber}x de ${formatCurrency(installmentValue)}`,
    };
  });

  const onSubmit = async (data: CardFormData) => {
    onProcessing();

    try {
      const [expMonth, expYear] = data.expirationDate.split("/");
      
      const { data: result, error } = await supabase.functions.invoke("process-rede-payment", {
        body: {
          paymentLinkId,
          cardNumber: data.cardNumber.replace(/\s/g, ""),
          cardholderName: data.cardholderName.toUpperCase(),
          expirationMonth: parseInt(expMonth, 10),
          expirationYear: 2000 + parseInt(expYear, 10),
          securityCode: data.cvv,
          installments: parseInt(data.installments, 10),
          cpf: data.cpf.replace(/\D/g, ""),
        },
      });

      if (error) {
        console.error("Payment error:", error);
        onError(error.message || "Erro ao processar pagamento");
        return;
      }

      if (!result.success) {
        onError(result.message || "Pagamento não autorizado");
        return;
      }

      onSuccess({
        transactionId: result.transactionId,
        authorizationCode: result.authorizationCode,
      });
    } catch (err) {
      console.error("Payment error:", err);
      onError("Erro inesperado ao processar pagamento");
    }
  };

  const getBrandIcon = () => {
    const brandIcons: Record<string, string> = {
      visa: "💳",
      mastercard: "💳",
      amex: "💳",
      elo: "💳",
      hipercard: "💳",
    };
    return brandIcons[cardBrand] || "";
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
          <CreditCard className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">Dados do Cartão</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Card Number */}
        <div className="space-y-2">
          <Label htmlFor="cardNumber">Número do cartão</Label>
          <div className="relative">
            <Input
              id="cardNumber"
              placeholder="0000 0000 0000 0000"
              {...register("cardNumber")}
              onChange={handleCardNumberChange}
              className="pr-12"
              disabled={isProcessing}
            />
            {cardBrand && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">
                {getBrandIcon()}
              </span>
            )}
          </div>
          {errors.cardNumber && (
            <p className="text-sm text-destructive">{errors.cardNumber.message}</p>
          )}
        </div>

        {/* Cardholder Name */}
        <div className="space-y-2">
          <Label htmlFor="cardholderName">Nome no cartão</Label>
          <Input
            id="cardholderName"
            placeholder="Como está no cartão"
            {...register("cardholderName")}
            className="uppercase"
            disabled={isProcessing}
          />
          {errors.cardholderName && (
            <p className="text-sm text-destructive">{errors.cardholderName.message}</p>
          )}
        </div>

        {/* Expiration and CVV */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="expirationDate">Validade</Label>
            <Input
              id="expirationDate"
              placeholder="MM/AA"
              {...register("expirationDate")}
              onChange={handleExpirationChange}
              disabled={isProcessing}
            />
            {errors.expirationDate && (
              <p className="text-sm text-destructive">{errors.expirationDate.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cvv">CVV</Label>
            <Input
              id="cvv"
              placeholder="123"
              type="password"
              {...register("cvv")}
              onChange={handleCVVChange}
              disabled={isProcessing}
            />
            {errors.cvv && (
              <p className="text-sm text-destructive">{errors.cvv.message}</p>
            )}
          </div>
        </div>

        {/* CPF */}
        <div className="space-y-2">
          <Label htmlFor="cpf">CPF do titular</Label>
          <Input
            id="cpf"
            placeholder="000.000.000-00"
            {...register("cpf")}
            onChange={handleCPFChange}
            disabled={isProcessing}
          />
          {errors.cpf && (
            <p className="text-sm text-destructive">{errors.cpf.message}</p>
          )}
        </div>

        {/* Installments */}
        {maxInstallments > 1 && (
          <div className="space-y-2">
            <Label htmlFor="installments">Parcelas</Label>
            <Select
              value={selectedInstallments}
              onValueChange={(value) => setValue("installments", value)}
              disabled={isProcessing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione as parcelas" />
              </SelectTrigger>
              <SelectContent>
                {installmentOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          className="w-full btn-gradient text-white font-semibold h-12 text-base mt-6"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Lock className="mr-2 h-5 w-5" />
              Pagar {formatCurrency(amount)}
            </>
          )}
        </Button>

        <p className="text-xs text-center text-slate-400 mt-4">
          Seus dados estão protegidos com criptografia de ponta a ponta
        </p>
      </form>
    </div>
  );
}
