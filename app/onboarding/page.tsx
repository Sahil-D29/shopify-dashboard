'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, Sparkles, Store } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const { status } = useSession();
  const [brandName, setBrandName] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      fetch('/api/onboarding')
        .then(r => r.json())
        .then(data => {
          if (data.onboardingComplete) {
            router.replace('/settings?setup=true');
          } else {
            setChecking(false);
          }
        })
        .catch(() => setChecking(false));
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
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

      router.push('/settings?setup=true');
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAF9F6' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#D4A574' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#FAF9F6' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: '#D4A574' }}
          >
            <Store className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold" style={{ color: '#4A4139' }}>
            Welcome!
          </h1>
          <p className="mt-2 text-base" style={{ color: '#8B7F76' }}>
            Let&apos;s get your brand set up in just a moment.
          </p>
        </div>

        <div
          className="rounded-2xl border p-8 shadow-sm"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DE' }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
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
                onChange={e => {
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
      </div>
    </div>
  );
}
