import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, AlertCircle } from 'lucide-react';

interface Country {
  code: string;
  ddi: string;
  flag: string;
  name: string;
  mask: string;
  placeholder: string;
}

const countries: Country[] = [
  { code: 'BR', ddi: '55', flag: '🇧🇷', name: 'Brasil', mask: '(99) 99999-9999', placeholder: '(21) 99999-9999' },
  { code: 'PT', ddi: '351', flag: '🇵🇹', name: 'Portugal', mask: '999 999 999', placeholder: '912 345 678' },
  { code: 'US', ddi: '1', flag: '🇺🇸', name: 'Estados Unidos', mask: '(999) 999-9999', placeholder: '(555) 123-4567' },
  { code: 'AR', ddi: '54', flag: '🇦🇷', name: 'Argentina', mask: '(99) 9999-9999', placeholder: '(11) 1234-5678' },
  { code: 'MX', ddi: '52', flag: '🇲🇽', name: 'México', mask: '99 9999 9999', placeholder: '55 1234 5678' },
  { code: 'CO', ddi: '57', flag: '🇨🇴', name: 'Colômbia', mask: '999 999 9999', placeholder: '321 123 4567' },
  { code: 'CL', ddi: '56', flag: '🇨🇱', name: 'Chile', mask: '9 9999 9999', placeholder: '9 1234 5678' },
  { code: 'PE', ddi: '51', flag: '🇵🇪', name: 'Peru', mask: '999 999 999', placeholder: '987 654 321' },
  { code: 'ES', ddi: '34', flag: '🇪🇸', name: 'Espanha', mask: '999 99 99 99', placeholder: '612 34 56 78' },
  { code: 'FR', ddi: '33', flag: '🇫🇷', name: 'França', mask: '9 99 99 99 99', placeholder: '6 12 34 56 78' },
  { code: 'DE', ddi: '49', flag: '🇩🇪', name: 'Alemanha', mask: '999 9999999', placeholder: '151 1234567' },
  { code: 'IT', ddi: '39', flag: '🇮🇹', name: 'Itália', mask: '999 999 9999', placeholder: '312 345 6789' },
  { code: 'UK', ddi: '44', flag: '🇬🇧', name: 'Reino Unido', mask: '9999 999999', placeholder: '7911 123456' },
  { code: 'UY', ddi: '598', flag: '🇺🇾', name: 'Uruguai', mask: '99 999 999', placeholder: '99 123 456' },
  { code: 'PY', ddi: '595', flag: '🇵🇾', name: 'Paraguai', mask: '(999) 999-999', placeholder: '(981) 123-456' },
];

interface PhoneInputWithCountryProps {
  value: string;
  onChange: (fullPhone: string, countryCode: string) => void;
  buttonText?: string;
  buttonColor?: string;
  onSubmit: () => void;
  disabled?: boolean;
}

export function PhoneInputWithCountry({
  value,
  onChange,
  buttonText = 'Falar com Vendedor',
  buttonColor = '#8B5CF6',
  onSubmit,
  disabled = false,
}: PhoneInputWithCountryProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [open, setOpen] = useState(false);
  const [localPhone, setLocalPhone] = useState(value);
  const [showError, setShowError] = useState(false);

  const applyMask = (rawValue: string, mask: string): string => {
    const digits = rawValue.replace(/\D/g, '');
    let result = '';
    let digitIndex = 0;

    for (let i = 0; i < mask.length && digitIndex < digits.length; i++) {
      if (mask[i] === '9') {
        result += digits[digitIndex];
        digitIndex++;
      } else {
        result += mask[i];
      }
    }

    return result;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const maskedValue = applyMask(rawValue, selectedCountry.mask);
    setLocalPhone(maskedValue);
    
    // Limpar erro quando começar a digitar
    if (showError) setShowError(false);
    
    // Retorna o número completo com DDI
    const cleanPhone = maskedValue.replace(/\D/g, '');
    onChange(`${selectedCountry.ddi}${cleanPhone}`, selectedCountry.ddi);
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setOpen(false);
    setLocalPhone('');
    onChange('', country.ddi);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = localPhone.replace(/\D/g, '');
    
    if (cleanPhone.length < 8) {
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
      return;
    }
    
    setShowError(false);
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="flex items-center gap-2 px-3 min-w-[100px] bg-white border-gray-300"
            >
              <span className="text-xl">{selectedCountry.flag}</span>
              <span className="text-sm text-gray-600">+{selectedCountry.ddi}</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="start">
            <ScrollArea className="h-[300px]">
              <div className="p-2">
                {countries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleCountrySelect(country)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-gray-100 transition-colors ${
                      selectedCountry.code === country.code ? 'bg-gray-100' : ''
                    }`}
                  >
                    <span className="text-xl">{country.flag}</span>
                    <span className="flex-1 text-sm">{country.name}</span>
                    <span className="text-sm text-gray-500">+{country.ddi}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <Input
          type="tel"
          value={localPhone}
          onChange={handlePhoneChange}
          placeholder={selectedCountry.placeholder}
          className="flex-1 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
          disabled={disabled}
        />
      </div>

      {showError && (
        <div className="flex items-center justify-center gap-2 text-sm text-red-500 animate-pulse">
          <AlertCircle className="h-4 w-4" />
          <span>Por favor, digite seu número de WhatsApp</span>
        </div>
      )}

      <Button
        type="submit"
        className="w-full h-12 text-base font-semibold text-white transition-all hover:opacity-90"
        style={{ backgroundColor: buttonColor }}
        disabled={disabled}
      >
        {buttonText}
      </Button>
    </form>
  );
}
