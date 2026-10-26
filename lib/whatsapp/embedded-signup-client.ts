/**
 * Client-side WhatsApp Embedded Signup helper (Facebook JavaScript SDK).
 * Captures Meta's FINISH session data and returns an exchangeable auth code.
 */

const GRAPH_VERSION = 'v21.0';
const SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';

export function buildEmbeddedSignupOptions(configId: string): Record<string, unknown> {
  return {
    config_id: configId,
    auth_type: 'rerequest',
    response_type: 'code',
    override_default_response_type: true,
    // Embedded Signup v4 is driven by the Facebook Login for Business
    // configuration. Do not send the retired v2/v3 flow parameters.
    extras: { setup: {} },
  };
}

interface FBLoginResponse {
  authResponse?: { code?: string; accessToken?: string } | null;
  status?: string;
}

interface FBStatic {
  init(params: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }): void;
  login(cb: (response: FBLoginResponse) => void, opts: Record<string, unknown>): void;
}

declare global {
  interface Window {
    FB?: FBStatic;
    fbAsyncInit?: () => void;
  }
}

export interface EmbeddedSignupResult {
  code?: string;
  accessToken?: string;
  wabaId?: string;
  phoneNumberId?: string;
}

export interface EmbeddedSignupSessionInfo {
  event: 'FINISH' | 'CANCEL' | 'ERROR';
  wabaId?: string;
  phoneNumberId?: string;
  errorMessage?: string;
}

/** Parse only postMessage payloads emitted by Meta's Embedded Signup UI. */
export function parseEmbeddedSignupMessage(
  origin: string,
  payload: unknown,
): EmbeddedSignupSessionInfo | null {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    if (hostname !== 'facebook.com' && !hostname.endsWith('.facebook.com')) return null;

    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!data || typeof data !== 'object') return null;
    const message = data as Record<string, any>;
    if (message.type !== 'WA_EMBEDDED_SIGNUP') return null;

    const event = String(message.event || '').toUpperCase();
    if (!['FINISH', 'CANCEL', 'ERROR'].includes(event)) return null;
    return {
      event: event as EmbeddedSignupSessionInfo['event'],
      wabaId: typeof message.data?.waba_id === 'string' ? message.data.waba_id : undefined,
      phoneNumberId:
        typeof message.data?.phone_number_id === 'string'
          ? message.data.phone_number_id
          : undefined,
      errorMessage:
        typeof message.data?.error_message === 'string'
          ? message.data.error_message
          : undefined,
    };
  } catch {
    return null;
  }
}

let sdkPromise: Promise<FBStatic> | null = null;

/** Inject and initialize the Facebook JS SDK exactly once. */
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
      } catch (error) {
        reject(error);
      }
    };

    if (document.getElementById('facebook-jssdk')) return;

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
 * Launch Embedded Signup and resolve with the code plus selected WABA ids.
 * Meta can return the FB.login callback just before its FINISH postMessage, so
 * the listener stays alive for a short grace period to avoid losing those ids.
 */
export function launchWhatsAppEmbeddedSignup(opts: {
  appId: string;
  configId: string;
}): Promise<EmbeddedSignupResult> {
  const { appId, configId } = opts;

  return new Promise<EmbeddedSignupResult>((resolve, reject) => {
    let captured: { wabaId?: string; phoneNumberId?: string } = {};
    let authCode: string | undefined;
    let accessToken: string | undefined;
    let settled = false;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      window.removeEventListener('message', sessionInfoListener);
      if (graceTimer) clearTimeout(graceTimer);
    };

    const resolveSignup = () => {
      if (settled || (!authCode && !accessToken)) return;
      settled = true;
      cleanup();
      resolve({
        code: authCode,
        accessToken,
        wabaId: captured.wabaId,
        phoneNumberId: captured.phoneNumberId,
      });
    };

    const rejectSignup = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const settleWhenReady = () => {
      if ((!authCode && !accessToken) || settled) return;
      if (captured.wabaId && captured.phoneNumberId) {
        resolveSignup();
        return;
      }
      if (!graceTimer) graceTimer = setTimeout(resolveSignup, 10000);
    };

    const sessionInfoListener = (event: MessageEvent) => {
      const info = parseEmbeddedSignupMessage(event.origin, event.data);
      if (!info) return;

      if (info.event === 'FINISH') {
        captured = {
          wabaId: info.wabaId || captured.wabaId,
          phoneNumberId: info.phoneNumberId || captured.phoneNumberId,
        };
        settleWhenReady();
      } else if (!authCode && !accessToken) {
        rejectSignup(
          new Error(
            info.errorMessage ||
              (info.event === 'CANCEL'
                ? 'WhatsApp signup was cancelled.'
                : 'Meta could not complete WhatsApp signup.'),
          ),
        );
      }
    };

    window.addEventListener('message', sessionInfoListener);

    loadFacebookSdk(appId)
      .then((FB) => {
        FB.login(
          (response: FBLoginResponse) => {
            const code = response?.authResponse?.code;
            const token = response?.authResponse?.accessToken;
            if (!code && !token) {
              rejectSignup(new Error('WhatsApp signup was cancelled or returned no authorization credential.'));
              return;
            }
            authCode = code;
            accessToken = token;
            settleWhenReady();
          },
          buildEmbeddedSignupOptions(configId),
        );
      })
      .catch((error) => {
        rejectSignup(
          error instanceof Error ? error : new Error('Failed to start WhatsApp signup.'),
        );
      });
  });
}
