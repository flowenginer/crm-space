// =====================================================
// SERVIÇO DE CRIAÇÃO DE INSTÂNCIAS WHATSAPP
// Chama Edge Function para evitar CORS
// =====================================================

import { supabase } from '@/integrations/supabase/client';

// =====================================================
// TIPOS
// =====================================================
export interface CreateInstanceResult {
  success: boolean;
  instanceId?: string;
  token?: string;
  qrCode?: string;
  error?: string;
}

export interface ProviderConfig {
  baseUrl: string;
  adminToken: string;
  clientToken?: string;
}

// =====================================================
// FUNÇÃO UNIFICADA - CRIAR INSTÂNCIA
// =====================================================
export async function createWhatsAppInstance(
  providerCode: 'zapi' | 'uazapi' | 'evolution',
  instanceName: string,
  webhookBaseUrl: string
): Promise<CreateInstanceResult> {
  try {
    console.log('[Instance Creator] Creating instance:', { providerCode, instanceName });
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'create',
        providerCode,
        instanceName,
        webhookUrl: `${webhookBaseUrl}/functions/v1/whatsapp-webhook?provider=${providerCode}`,
      },
    });

    console.log('[Instance Creator] Response:', data, error);

    if (error) {
      return { success: false, error: error.message || 'Erro ao criar instância' };
    }

    return data as CreateInstanceResult;
  } catch (error: any) {
    console.error('[Instance Creator] Error:', error);
    return { success: false, error: error.message || 'Erro ao criar instância' };
  }
}

// =====================================================
// FUNÇÃO UNIFICADA - BUSCAR QR CODE
// =====================================================
export async function getWhatsAppQRCode(
  providerCode: 'zapi' | 'uazapi' | 'evolution',
  instanceId: string,
  token: string
): Promise<{ qrCode?: string; connected?: boolean }> {
  try {
    console.log('[Instance Creator] Getting QR code:', { providerCode, instanceId });
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'qrcode',
        providerCode,
        instanceId,
        instanceToken: token,
      },
    });

    console.log('[Instance Creator] QR Response:', data, error);

    if (error) {
      console.error('[Instance Creator] QR Error:', error);
      return {};
    }

    return data as { qrCode?: string; connected?: boolean };
  } catch (error: any) {
    console.error('[Instance Creator] Error:', error);
    return {};
  }
}
