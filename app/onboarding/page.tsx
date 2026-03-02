'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, Sparkles, Store, ShoppingBag, CheckCircle2, ArrowRight, ExternalLink, SkipForward } from 'lucide-react';
import { StoreConfigManager } from '@/lib/store-config';

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  // Step: 1 = brand name, 2 = connect shopify
  const [step, setStep] = useState(1);
  const [brandName, setBrandName] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  // Shopify connect state
  const [shopDomain, setShopDomain] = useState('');
  const [shopifyConnecting, setShopifyConnecting] = useState(false);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [connectedStoreName, setConnectedStoreName] = useState('');
  const [connectedDomain, setConnectedDomain] = useState('');

  // ── Handle OAuth return ──────────────────────────────────────────────
  useEffect(() => {
    const success = searchParams.get('success');
    const storeId = searchParams.get('storeId');
    const shopDomainParam = searchParams.get('shopDomain');
    const shopName = searchParams.get('shopName');
    const token = searchParams.get('token');

    if (success === 'shopify_connected' && storeId) {
      // Returned from Shopify OAuth → save config to localStorage
      if (shopDomainParam && token) {
        try {
          StoreConfigManager.saveConfig({
            shopUrl: shopDomainParam,
            accessToken: token,
            apiKey: process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || '',
            apiSecret: '',
          });
        } catch { /* ignore localStorage errors */ }
      }

      setStep(2);
      setShopifyConnected(true);
      setConnectedStoreName(shopName || shopDomainParam || '');
      setConnectedDomain(shopDomainParam || '');

      // Clean URL
      const cleanUrl = new URL(window.location.href);
      cleanUrl.search = '';
      window.history.replaceState({}, '', cleanUrl.toString());
    }

    const errorParam = searchParams.get('error');
    if (errorParam) {
      setStep(2);
      setError(
        errorParam === 'shopify_oauth_failed'
          ? 'Shopify authorization was denied or failed. Please try again.'
          : errorParam === 'missing_parameters'
            ? 'Missing OAuth parameters. Please try connecting again.'
            : 'Connection failed. Please try again.',
      );
    }
  }, [searchParams]);

  // ── Check onboarding status ──────────────────────────────────────────
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      // Check onboarding status + store status in parallel
      Promise.all([
        fetch('/api/onboarding').then((r) => r.json()),
        fetch('/api/store/status').then((r) => r.json()),
      ])
        .then(([onboardingData, storeData]) => {
          if (onboardingData.onboardingComplete && storeData.connected) {
            // Fully onboarded + store connected → go to dashboard
            router.replace('/');
          } else if (onboardingData.onboardingComplete && !storeData.connected) {
            // Brand name done but no store → show step 2
            setStep(2);
            setChecking(false);
          } else if (onboardingData.onboardingComplete) {
            router.replace('/settings?setup=true');
          } else {
            setChecking(false);
          }

          // If store is already connected, reflect that
          if (storeData.connected && storeData.store) {
            setShopifyConnected(true);
            setConnectedStoreName(storeData.store.name);
            setConnectedDomain(storeData.store.domain);
          }
        })
        .catch(() => setChecking(false));
    }
  }, [status, router]);

  // ── Handle brand name submit ─────────────────────────────────────────
  const handleBrandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = brandName.trim();

    if (trimmed.length < 2) {
      setError('Brand name must be at least 2 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      // Move to step 2 instead of redirecting
      setStep(2);
      setError('');
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Shopify OAuth connect ─────────────────────────────────────
  const handleShopifyConnect = useCallback(async () => {
    let domain = shopDomain.trim().toLowerCase();
    if (!domain) {
      setError('Please enter your Shopify store domain');
      return;
    }

    // Normalize: "mystore" → "mystore.myshopify.com"
    if (!domain.includes('.')) {
      domain = `${domain}.myshopify.com`;
    }
    if (!domain.endsWith('.myshopify.com')) {
      setError('Please enter a valid Shopify store domain (e.g., yourstore or yourstore.myshopify.com)');
      return;
    }

    setShopifyConnecting(true);
    setError('');

    try {
      const response = await fetch(
        `/api/auth/shopify?shop=${encodeURIComponent(domain)}&return_to=onboarding`,
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate install URL');
      }

      const data = await response.json();
      // Redirect to Shopify to authorize
      window.location.href = data.installUrl;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
      setShopifyConnecting(false);
    }
  }, [shopDomain]);

  // ── Continue to dashboard ────────────────────────────────────────────
  const handleContinue = () => {
    router.push('/');
  };

  const handleSkip = () => {
    router.push('/settings?setup=true');
  };

  // ── Loading state ────────────────────────────────────────────────────
  if (status === 'loading' || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAF9F6' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#D4A574' }} />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#FAF9F6' }}>
      <div className="w-full max-w-md">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: step >= 1 ? '#D4A574' : '#E8E4DE' }}
            >
              {step > 1 ? <CheckCircle2 className="h-5 w-5" /> : '1'}
            </div>
            <span className="text-sm font-medium" style={{ color: '#4A4139' }}>
              Brand
            </span>
          </div>
          <div className="w-8 h-px" style={{ backgroundColor: '#E8E4DE' }} />
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{
                backgroundColor: step >= 2 ? '#D4A574' : '#E8E4DE',
                color: step >= 2 ? '#FFFFFF' : '#8B7F76',
              }}
            >
              {shopifyConnected ? <CheckCircle2 className="h-5 w-5" /> : '2'}
            </div>
            <span className="text-sm font-medium" style={{ color: step >= 2 ? '#4A4139' : '#8B7F76' }}>
              Shopify
            </span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: '#D4A574' }}
          >
            {step === 1 ? (
              <Store className="h-8 w-8 text-white" />
            ) : (
              <ShoppingBag className="h-8 w-8 text-white" />
            )}
          </div>
          <h1 className="text-3xl font-bold" style={{ color: '#4A4139' }}>
            {step === 1 ? 'Welcome!' : shopifyConnected ? 'Store Connected!' : 'Connect Your Store'}
          </h1>
          <p className="mt-2 text-base" style={{ color: '#8B7F76' }}>
            {step === 1
              ? "Let's get your brand set up in just a moment."
              : shopifyConnected
                ? 'Your Shopify store is ready to go.'
                : 'Link your Shopify store with one click.'}
          </p>
        </div>

        {/* ── Step 1: Brand Name ──────────────────────────────────────── */}
        {step === 1 && (
          <div
            className="rounded-2xl border p-8 shadow-sm"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DE' }}
          >
            <form onSubmit={handleBrandSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="brandName"
                  className="block text-sm font-semibold mb-2"
                  style={{ color: '#4A4139' }}
                >
                  What&apos;s your brand name?
                </label>
                <input
                  id="brandName"
                  type="text"
                  value={brandName}
                  onChange={(e) => {
                    setBrandName(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="e.g., Acme Store"
                  maxLength={100}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border text-base outline-none transition-all focus:ring-2"
                  style={{
                    borderColor: error ? '#EF4444' : '#E8E4DE',
                    color: '#4A4139',
                    backgroundColor: '#FAF9F6',
                  }}
                />
                {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={loading || brandName.trim().length < 2}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{ backgroundColor: '#D4A574' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Continue
                  </>
                )}
              </button>
            </form>

            <p className="mt-4 text-center text-xs" style={{ color: '#8B7F76' }}>
              You can change this later in Settings
            </p>
          </div>
        )}

        {/* ── Step 2: Connect Shopify ─────────────────────────────────── */}
        {step === 2 && !shopifyConnected && (
          <div
            className="rounded-2xl border p-8 shadow-sm"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DE' }}
          >
            <div className="space-y-6">
              {/* How it works */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#FAF9F6', borderColor: '#E8E4DE' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: '#4A4139' }}>
                  How it works:
                </p>
                <div className="space-y-2">
                  {[
                    'Enter your Shopify store name',
                    'Authorize on Shopify (secure)',
                    'Automatically connected — done!',
                  ].map((text, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: '#D4A574' }}
                      >
                        {i + 1}
                      </div>
                      <span className="text-sm" style={{ color: '#4A4139' }}>
                        {text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shop domain input */}
              <div>
                <label
                  htmlFor="shopDomain"
                  className="block text-sm font-semibold mb-2"
                  style={{ color: '#4A4139' }}
                >
                  Shopify Store Domain
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      id="shopDomain"
                      type="text"
                      value={shopDomain}
                      onChange={(e) => {
                        setShopDomain(e.target.value);
                        if (error) setError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleShopifyConnect()}
                      placeholder="yourstore"
                      disabled={shopifyConnecting}
                      autoFocus
                      className="w-full px-4 py-3 rounded-xl border text-base outline-none transition-all focus:ring-2"
                      style={{
                        borderColor: error ? '#EF4444' : '#E8E4DE',
                        color: '#4A4139',
                        backgroundColor: '#FAF9F6',
                      }}
                    />
                  </div>
                </div>
                <p className="mt-1.5 text-xs" style={{ color: '#8B7F76' }}>
                  Enter your store name (e.g., <strong>yourstore</strong>) or full domain (<strong>yourstore.myshopify.com</strong>)
                </p>
                {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
              </div>

              {/* Connect button */}
              <button
                onClick={handleShopifyConnect}
                disabled={shopifyConnecting || !shopDomain.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-white font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{ backgroundColor: '#96BF48' }}
              >
                {shopifyConnecting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Redirecting to Shopify...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-5 w-5" />
                    Connect Your Shopify Store
                  </>
                )}
              </button>

              {/* Skip */}
              <button
                onClick={handleSkip}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm transition-colors hover:opacity-70"
                style={{ color: '#8B7F76' }}
              >
                <SkipForward className="h-4 w-4" />
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Connected Success ───────────────────────────────── */}
        {step === 2 && shopifyConnected && (
          <div
            className="rounded-2xl border p-8 shadow-sm"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DE' }}
          >
            <div className="space-y-6">
              {/* Success card */}
              <div className="p-5 rounded-xl border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-100">
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-900">Successfully Connected</p>
                    <p className="text-sm text-green-700">{connectedStoreName || connectedDomain}</p>
                    {connectedDomain && connectedDomain !== connectedStoreName && (
                      <p className="text-xs text-green-600">{connectedDomain}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Continue button */}
              <button
                onClick={handleContinue}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90"
                style={{ backgroundColor: '#D4A574' }}
              >
                Continue to Dashboard
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
