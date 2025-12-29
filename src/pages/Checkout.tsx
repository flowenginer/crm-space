import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { usePublicPaymentLink } from "@/hooks/usePublicPaymentLink";
import { CheckoutLayout } from "@/components/checkout/CheckoutLayout";
import { PaymentSummary } from "@/components/checkout/PaymentSummary";
import { CreditCardForm } from "@/components/checkout/CreditCardForm";
import { CheckoutSuccess } from "@/components/checkout/CheckoutSuccess";
import { CheckoutError } from "@/components/checkout/CheckoutError";
import { CheckoutExpired } from "@/components/checkout/CheckoutExpired";
import { CheckoutLoading } from "@/components/checkout/CheckoutLoading";
import { CheckoutNotFound } from "@/components/checkout/CheckoutNotFound";

export type CheckoutStatus = "loading" | "form" | "processing" | "success" | "error" | "expired" | "not_found" | "already_paid";

export default function Checkout() {
  const { paymentLinkId } = useParams<{ paymentLinkId: string }>();
  const { data: paymentLink, isLoading, error } = usePublicPaymentLink(paymentLinkId);
  const [status, setStatus] = useState<CheckoutStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [transactionData, setTransactionData] = useState<{
    transactionId?: string;
    authorizationCode?: string;
  }>({});

  useEffect(() => {
    if (isLoading) {
      setStatus("loading");
      return;
    }

    if (error || !paymentLink) {
      setStatus("not_found");
      return;
    }

    // Check if already paid
    if (paymentLink.status === "paid") {
      setStatus("already_paid");
      return;
    }

    // Check if expired
    if (paymentLink.expires_at && new Date(paymentLink.expires_at) < new Date()) {
      setStatus("expired");
      return;
    }

    // Check if cancelled/failed
    if (paymentLink.status === "cancelled" || paymentLink.status === "failed") {
      setStatus("expired");
      return;
    }

    setStatus("form");
  }, [paymentLink, isLoading, error]);

  const handlePaymentSuccess = (data: { transactionId?: string; authorizationCode?: string }) => {
    setTransactionData(data);
    setStatus("success");
  };

  const handlePaymentError = (message: string) => {
    setErrorMessage(message);
    setStatus("error");
  };

  const handleRetry = () => {
    setErrorMessage("");
    setStatus("form");
  };

  return (
    <CheckoutLayout
      companyName={paymentLink?.company_name}
      logoUrl={paymentLink?.logo_url}
    >
      {status === "loading" && <CheckoutLoading />}
      
      {status === "not_found" && <CheckoutNotFound />}
      
      {status === "expired" && <CheckoutExpired />}
      
      {status === "already_paid" && (
        <CheckoutSuccess
          amount={paymentLink?.amount || 0}
          transactionId={transactionData.transactionId}
          authorizationCode={transactionData.authorizationCode}
          alreadyPaid
        />
      )}
      
      {status === "form" && paymentLink && (
        <div className="space-y-6">
          <PaymentSummary
            amount={paymentLink.amount}
            description={paymentLink.description}
            customerName={paymentLink.customer_name}
          />
          <CreditCardForm
            paymentLinkId={paymentLinkId!}
            amount={paymentLink.amount}
            maxInstallments={paymentLink.max_installments || 1}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            onProcessing={() => setStatus("processing")}
          />
        </div>
      )}
      
      {status === "processing" && paymentLink && (
        <div className="space-y-6">
          <PaymentSummary
            amount={paymentLink.amount}
            description={paymentLink.description}
            customerName={paymentLink.customer_name}
          />
          <CreditCardForm
            paymentLinkId={paymentLinkId!}
            amount={paymentLink.amount}
            maxInstallments={paymentLink.max_installments || 1}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            onProcessing={() => setStatus("processing")}
            isProcessing
          />
        </div>
      )}
      
      {status === "success" && (
        <CheckoutSuccess
          amount={paymentLink?.amount || 0}
          transactionId={transactionData.transactionId}
          authorizationCode={transactionData.authorizationCode}
        />
      )}
      
      {status === "error" && (
        <CheckoutError
          message={errorMessage}
          onRetry={handleRetry}
        />
      )}
    </CheckoutLayout>
  );
}
