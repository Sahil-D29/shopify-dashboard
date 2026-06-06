/**
 * Client-side WhatsApp Embedded Signup helper (Facebook JavaScript SDK).
 *
 * Implements the official WhatsApp Embedded Signup popup flow:
 *   1. Load + init the Facebook JS SDK (connect.facebook.net/en_US/sdk.js).
 *   2. Listen for the `message` event whose data is the WA_EMBEDDED_SIGNUP
 *      session info — this carries the customer's `waba_id` and
 *      `phone_number_id`.
 *   3. Call `FB.login()` with the Embedded Signup `config_id` and
 *      `response_type: 'code'` so the popup returns an exchangeable code.
 *   4. Resolve with `{ code, wabaId, phoneNumberId }` for the backend to
 *      exchange + persist.
 *
 * Requires env: NEXT_PUBLIC_META_APP_ID, NEXT_PUBLIC_META_CONFIG_ID.
 */

const GRAPH_VERSION = 'v21.0';
const SDK_SRC = `https://connect.facebook.net/en_US/sdk.js`;

interface FBLoginResponse {
  authResponse?: { code?: string; accessToken?: string } | null;
  status?: string;
}

interface FBStatic {
  init(params: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }): void;
  login(
    cb: (response: FBLoginResponse) => void,
    opts: Record<string, unknown>,
  ): void;
}

declare global {
  interface Window {
    FB?: FBStatic;
    fbAsyncInit?: () => void;
  }
}

export interface EmbeddedSignupResult {
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
}

let sdkPromise: Promise<FBStatic> | null = null;

/** Inject + initialize the Facebook JS SDK exactly once. */
export function loadFacebookSdk(appId: string): Promise<FBStatic> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Facebook SDK can only load in the browser'));
  }
  if (window.FB) return Promise.resolve(window.FB);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<FBStatic>((resolve, reject) => {
    window.fbAsyncInit = () => {
      try {
        window.FB!.init({ appId, cookie: true, xfbml: false, version: GRAPH_VERSION });
        resolve(window.FB!);
      } catch (err) {
        reject(err);
      }
    };

    // Avoid injecting the script twice.
    if (document.getElementById('facebook-jssdk')) {
      // Script tag exists but FB not ready yet — fbAsyncInit will fire.
      return;
    }

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = SDK_SRC;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error('Failed to load the Facebook SDK. Check your network or ad-blocker.'));
    };
    document.body.appendChild(script);
  });

  return sdkPromise;
}

/**
 * Launch the Embedded Signup popup and resolve with the auth code plus the
 * captured WABA + phone number ids.
 */
export function launchWhatsAppEmbeddedSignup(opts: {
  appId: string;
  configId: string;
}): Promise<EmbeddedSignupResult> {
  const { appId, configId } = opts;

  return new Promise<EmbeddedSignupResult>((resolve, reject) => {
    let captured: { wabaId?: string; phoneNumberId?: string } = {};

    const sessionInfoListener = (event: MessageEvent) => {
      // Only trust messages from Facebook's domain.
      if (!event.origin || !/\.facebook\.com$/.test(new URL(event.origin).hostname)) {
        return;
      }
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'WA_EMBEDDED_SIGNUP') {
          // data.event: 'FINISH' | 'CANCEL' | 'ERROR'
          if (data.event === 'FINISH' || data.data) {
            captured = {
              wabaId: data.data?.waba_id,
              phoneNumberId: data.data?.phone_number_id,
            };
          }
        }
      } catch {
        // Non-JSON messages are not ours — ignore.
      }
    };

    window.addEventListener('message', sessionInfoListener);

    const cleanup = () => window.removeEventListener('message', sessionInfoListener);

    loadFacebookSdk(appId)
      .then((FB) => {
        FB.login(
          (response: FBLoginResponse) => {
            cleanup();
            const code = response?.authResponse?.code;
            if (!code) {
              reject(new Error('WhatsApp signup was cancelled or returned no authorization code.'));
              return;
            }
            resolve({ code, wabaId: captured.wabaId, phoneNumberId: captured.phoneNumberId });
          },
          {
            config_id: configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
          },
        );
      })
      .catch((err) => {
        cleanup();
        reject(err);
      });
  });
}
