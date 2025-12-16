import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PackagingType = 'stack' | 'box' | 'side_by_side' | 'layered' | 'custom';

export interface ShippingProduct {
  weight: number;
  height: number;
  width: number;
  length: number;
  quantity: number;
  insurance_value?: number;
  packaging_type?: PackagingType;
}

export interface ShippingOption {
  id: number;
  name: string;
  company: string;
  companyLogo: string;
  price: number;
  originalPrice: number;
  discount: number;
  deliveryDays: number;
  deliveryRange: {
    min: number;
    max: number;
  };
  currency: string;
}

export interface PackageInfo {
  weight: number;
  height: number;
  width: number;
  length: number;
  insurance_value: number;
  packaging_type?: string;
  volume?: number;
}

export interface ShippingQuoteResult {
  success: boolean;
  options: ShippingOption[];
  errors?: Array<{ id: number; name: string; error: string }>;
  package?: PackageInfo;
}

interface CalculateShippingParams {
  fromPostalCode: string;
  toPostalCode: string;
  products: ShippingProduct[];
  services?: string;
}

export function useShippingQuote() {
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ShippingOption | null>(null);
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null);

  const calculateShippingMutation = useMutation({
    mutationFn: async ({ fromPostalCode, toPostalCode, products, services }: CalculateShippingParams): Promise<ShippingQuoteResult> => {
      const { data, error } = await supabase.functions.invoke('calculate-shipping', {
        body: {
          from_postal_code: fromPostalCode,
          to_postal_code: toPostalCode,
          products,
          services,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao calcular frete');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data as ShippingQuoteResult;
    },
    onSuccess: (data) => {
      setShippingOptions(data.options);
      if (data.package) {
        setPackageInfo({
          ...data.package,
          volume: data.package.height * data.package.width * data.package.length,
        });
      }
      if (data.options.length === 0) {
        toast.warning('Nenhuma opção de frete disponível para este CEP');
      }
    },
    onError: (error: Error) => {
      console.error('Shipping quote error:', error);
      toast.error(error.message || 'Erro ao calcular frete');
      setShippingOptions([]);
      setPackageInfo(null);
    },
  });

  const calculateShipping = (params: CalculateShippingParams) => {
    return calculateShippingMutation.mutateAsync(params);
  };

  const selectShippingOption = (option: ShippingOption) => {
    setSelectedOption(option);
  };

  const clearShippingOptions = () => {
    setShippingOptions([]);
    setSelectedOption(null);
    setPackageInfo(null);
  };

  return {
    calculateShipping,
    isLoading: calculateShippingMutation.isPending,
    shippingOptions,
    selectedOption,
    selectShippingOption,
    clearShippingOptions,
    packageInfo,
  };
}
