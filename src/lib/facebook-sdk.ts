// Facebook SDK Types
interface FBInstance {
  init: (params: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
  login: (callback: (response: FBLoginResponse) => void, options?: FBLoginOptions) => void;
  logout: (callback: () => void) => void;
  getLoginStatus: (callback: (response: FBLoginResponse) => void) => void;
}

declare global {
  interface Window {
    FB: FBInstance;
    fbAsyncInit: () => void;
  }
}

interface FBLoginOptions {
  config_id?: string;
  response_type?: string;
  override_default_response_type?: boolean;
  extras?: {
    setup?: object;
    featureType?: string;
    sessionInfoVersion?: number;
  };
}

interface FBLoginResponse {
  authResponse?: {
    code?: string;
    accessToken?: string;
    userID?: string;
  };
  status: 'connected' | 'not_authorized' | 'unknown';
}

interface WhatsAppSignupResult {
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
}

// Facebook SDK configuration
const FB_SDK_VERSION = 'v21.0';
const META_APP_ID = '1540198137306576';

// Initialize Facebook SDK
export function initFacebookSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already initialized
    if (window.FB) {
      console.log('[FB SDK] Already initialized');
      resolve();
      return;
    }

    // Add SDK script if not present
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      
      script.onerror = () => {
        reject(new Error('Failed to load Facebook SDK'));
      };
      
      document.body.appendChild(script);
    }

    // Set up async init callback
    window.fbAsyncInit = function() {
      console.log('[FB SDK] Initializing with app ID:', META_APP_ID);
      window.FB.init({
        appId: META_APP_ID,
        cookie: true,
        xfbml: true,
        version: FB_SDK_VERSION,
      });
      console.log('[FB SDK] Initialized successfully');
      resolve();
    };

    // If script was already added but not initialized, wait for it
    const checkFB = setInterval(() => {
      if (window.FB) {
        clearInterval(checkFB);
        window.FB.init({
          appId: META_APP_ID,
          cookie: true,
          xfbml: true,
          version: FB_SDK_VERSION,
        });
        console.log('[FB SDK] Initialized via polling');
        resolve();
      }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkFB);
      if (!window.FB) {
        reject(new Error('Facebook SDK load timeout'));
      }
    }, 10000);
  });
}

// Launch WhatsApp Embedded Signup flow
export function launchWhatsAppSignup(configId: string): Promise<WhatsAppSignupResult> {
  return new Promise((resolve, reject) => {
    console.log('[FB SDK] Launching WhatsApp signup with config_id:', configId);

    // Generate a random state for security
    const state = Math.random().toString(36).substring(2, 15);

    // Store state in sessionStorage for validation
    sessionStorage.setItem('fb_oauth_state', state);

    // Use the official Meta Business Embedded Signup URL
    const extras = JSON.stringify({
      sessionInfoVersion: '3',
      version: 'v3',
    });

    const params = new URLSearchParams({
      app_id: META_APP_ID,
      config_id: configId,
      extras: extras,
    });

    // Use the official Meta onboarding URL
    const oauthUrl = `https://business.facebook.com/messaging/whatsapp/onboard/?${params.toString()}`;

    console.log('[FB SDK] Opening Embedded Signup URL:', oauthUrl);

    // Calculate popup dimensions and position
    const width = 800;
    const height = 800;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // Open popup
    const popup = window.open(
      oauthUrl,
      'whatsapp_signup',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup) {
      reject(new Error('Não foi possível abrir o popup. Verifique se o bloqueador de popups está desativado.'));
      return;
    }

    // Listen for messages from the popup (Meta sends postMessage events)
    const messageListener = (event: MessageEvent) => {
      // Accept messages from Facebook/Meta domains
      if (!event.origin.includes('facebook.com') && event.origin !== window.location.origin) {
        return;
      }

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        console.log('[FB SDK] Received message:', data);

        // Handle WhatsApp Embedded Signup response
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          console.log('[FB SDK] WhatsApp signup data received:', data.data);

          window.removeEventListener('message', messageListener);
          clearInterval(pollTimer);

          if (data.data?.phone_number_id && data.data?.waba_id) {
            resolve({
              code: data.data.code || 'embedded_signup',
              wabaId: data.data.waba_id,
              phoneNumberId: data.data.phone_number_id,
            });
          }
        }

        // Handle OAuth result from our callback page
        if (data.type === 'WHATSAPP_OAUTH_RESULT') {
          window.removeEventListener('message', messageListener);
          clearInterval(pollTimer);

          if (data.error) {
            reject(new Error(data.error));
          } else if (data.code) {
            resolve({
              code: data.code,
              wabaId: data.wabaId,
              phoneNumberId: data.phoneNumberId,
            });
          } else {
            reject(new Error('Nenhum código de autorização recebido'));
          }
        }
      } catch (e) {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', messageListener);

    // Poll to check if popup was closed without completing
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        window.removeEventListener('message', messageListener);

        // Check if we got the result via localStorage (fallback)
        const result = localStorage.getItem('whatsapp_oauth_result');
        if (result) {
          localStorage.removeItem('whatsapp_oauth_result');
          try {
            const data = JSON.parse(result);
            if (data.type === 'WHATSAPP_OAUTH_SUCCESS') {
              resolve({
                code: data.code || 'embedded_signup',
                wabaId: data.wabaId,
                phoneNumberId: data.phoneNumberId,
              });
              return;
            } else if (data.type === 'WHATSAPP_OAUTH_ERROR') {
              reject(new Error(data.error || 'Erro na autenticação'));
              return;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }

        reject(new Error('Login cancelado ou janela fechada'));
      }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(pollTimer);
      window.removeEventListener('message', messageListener);
      if (!popup.closed) {
        popup.close();
      }
      reject(new Error('Tempo limite excedido. Tente novamente.'));
    }, 300000);
  });
}

// Get Facebook login status
export function getFBLoginStatus(): Promise<FBLoginResponse> {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error('Facebook SDK not initialized'));
      return;
    }

    window.FB.getLoginStatus(function(response: FBLoginResponse) {
      resolve(response);
    });
  });
}

// Logout from Facebook
export function fbLogout(): Promise<void> {
  return new Promise((resolve) => {
    if (!window.FB) {
      resolve();
      return;
    }

    window.FB.logout(function() {
      resolve();
    });
  });
}
