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
const META_APP_ID = '1544198137306574';

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
    if (!window.FB) {
      reject(new Error('Facebook SDK not initialized'));
      return;
    }

    console.log('[FB SDK] Launching WhatsApp signup with config_id:', configId);

    let sessionData: { wabaId?: string; phoneNumberId?: string } = {};

    // Listen for session info from the WhatsApp Embedded Signup flow
    const sessionInfoListener = (event: MessageEvent) => {
      // Only accept messages from Facebook
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') {
        return;
      }

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        console.log('[FB SDK] Received message:', data);

        // WhatsApp Embedded Signup sends session info with type 'WA_EMBEDDED_SIGNUP'
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          console.log('[FB SDK] WhatsApp session info received:', data.data);
          
          // Extract WABA ID and Phone Number ID from the response
          if (data.data) {
            sessionData = {
              wabaId: data.data.waba_id,
              phoneNumberId: data.data.phone_number_id,
            };
          }
        }
      } catch (e) {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', sessionInfoListener);

    // Call FB.login with WhatsApp Embedded Signup configuration
    window.FB.login(
      function(response: FBLoginResponse) {
        window.removeEventListener('message', sessionInfoListener);

        console.log('[FB SDK] Login response:', {
          status: response.status,
          hasAuthResponse: !!response.authResponse,
          hasCode: !!response.authResponse?.code,
        });

        if (response.authResponse?.code) {
          resolve({
            code: response.authResponse.code,
            wabaId: sessionData.wabaId,
            phoneNumberId: sessionData.phoneNumberId,
          });
        } else if (response.status === 'not_authorized') {
          reject(new Error('Usuário não autorizou o acesso'));
        } else {
          reject(new Error('Login cancelado ou falhou'));
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'only_waba_sharing',
          sessionInfoVersion: 2,
        },
      } as FBLoginOptions
    );
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
