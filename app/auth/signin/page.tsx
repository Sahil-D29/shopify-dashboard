'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FcGoogle } from 'react-icons/fc';
import { Eye, EyeOff, Mail, Lock, ShoppingBag, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { StoreConfigManager } from '@/lib/store-config';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  // Default post-auth destination: Settings (WhatsApp, Shopify, team). Never use sign-in path.
  const rawCallback = searchParams.get('callbackUrl') || '/settings?setup=true';
  const isSignInPath =
    !rawCallback ||
    rawCallback === '/' ||
    rawCallback.startsWith('/auth') ||
    (typeof rawCallback === 'string' && rawCallback.includes('/auth/signin'));
  const callbackUrl = isSignInPath ? '/settings?setup=true' : rawCallback.startsWith('/') ? rawCallback : `/${rawCallback.replace(/^\//, '')}`;
  const error = searchParams.get('error');
  const resetSuccess = searchParams.get('reset');

  const [googleCallbackUrl, setGoogleCallbackUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/providers')
      .then((r) => r.json())
      .then((data) => {
        setGoogleEnabled(!!data?.googleEnabled);
        if (data?.googleCallbackUrl) setGoogleCallbackUrl(data.googleCallbackUrl);
      })
      .catch(() => setGoogleEnabled(false));
  }, []);

  useEffect(() => {
    if (resetSuccess === 'success') {
      toast.success('Password reset successfully! Please sign in with your new password.');
    }
  }, [resetSuccess]);

  useEffect(() => {
    if (status === 'authenticated') {
      const go = async () => {
        let targetUrl = '/onboarding';
        try {
          // Check onboarding first
          const onboardingRes = await fetch('/api/onboarding');
          const onboardingData = await onboardingRes.json();

          if (!onboardingData.onboardingComplete) {
            targetUrl = '/onboarding';
          } else {
            // User onboarded — check settings setup
            const statusResponse = await fetch('/api/settings/status');
            const statusData = await statusResponse.json();
            const setupCompleted = statusData.success && statusData.status?.settingsCompleted;
            if (setupCompleted) {
              const validCallback =
                callbackUrl &&
                callbackUrl !== '/settings?setup=true' &&
                callbackUrl !== '/onboarding' &&
                !callbackUrl.startsWith('/auth') &&
                callbackUrl.startsWith('/');
              targetUrl = validCallback ? callbackUrl : '/';
            } else {
              targetUrl = '/settings?setup=true';
            }
          }
        } catch {
          targetUrl = '/onboarding';
        }
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 100);
      };
      go();
    }
  }, [status, callbackUrl]);

  useEffect(() => {
    if (error) {
      const errorMessages: Record<string, string> = {
        'Configuration': 'Server configuration error. Please contact support.',
        'AccessDenied': 'Access denied. You may not have permission to sign in.',
        'Verification': 'The verification link may have expired or already been used.',
        'OAuthSignin': 'Google sign-in failed — the OAuth redirect URI may not be configured correctly. Check NEXTAUTH_URL in .env.local and the authorized redirect URIs in Google Cloud Console.',
        'OAuthCallback': 'Google sign-in callback failed. The redirect URI may not match Google Cloud Console settings. Check NEXTAUTH_URL and authorized redirect URIs.',
        'OAuthCreateAccount': 'Could not create account. Please try again.',
        'EmailCreateAccount': 'Could not create account. Please try again.',
        'Callback': 'Error during callback. Please try again.',
        'OAuthAccountNotLinked': 'This email is already associated with another sign-in method.',
        'CredentialsSignin': 'Invalid email or password. Please check your credentials.',
        'Default': 'An error occurred. Please try again.',
      };

      toast.error(errorMessages[error] || errorMessages['Default']);
    }
  }, [error]);

  const handleCredentialsSignIn = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const callbackUrl = baseUrl ? `${baseUrl}/settings?setup=true` : '/settings?setup=true';
      await signIn('credentials', {
        email,
        password,
        callbackUrl,
        redirect: true,
      });
      // If we get here, redirect didn't happen (e.g. error). Keep loading off.
    } catch (error) {
      console.error('Sign-in error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const callbackPath = '/settings?setup=true';
      const absoluteCallbackUrl = baseUrl ? `${baseUrl}${callbackPath}` : callbackPath;
      const result = await signIn('google', {
        callbackUrl: absoluteCallbackUrl,
        redirect: false,
      });
      if (result?.url) {
        window.location.href = result.url;
        return;
      }
      if (result?.error) {
        toast.error(result.error === 'OAuthCallback' ? 'Error completing sign-in. Please try again.' : String(result.error));
      } else {
        toast.error('Failed to start Google sign-in. Please try again.');
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      toast.error('Failed to sign in with Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      
      {/* Floating Shapes */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob" />
      <div className="absolute top-40 right-20 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-40 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl mb-4 shadow-lg shadow-purple-500/50">
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Shopify Dashboard
          </h1>
          <p className="text-gray-600">
            Manage your store with ease
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-8">
            {/* Welcome Text */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome Back
              </h2>
              <p className="text-gray-600 text-sm">
                Sign in to access your dashboard
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-800">
                    {error === 'CredentialsSignin' ? 'Invalid email or password' :
                     error === 'Configuration' ? 'Server configuration error. Please contact support.' :
                     error === 'AccessDenied' ? 'Access denied. You may not have permission to sign in.' :
                     error === 'OAuthSignin' ? 'Google sign-in failed. The OAuth redirect URI may not be configured correctly.' :
                     error === 'OAuthCallback' ? 'Google sign-in callback failed. Check that the redirect URI matches Google Cloud Console settings.' :
                     'An error occurred. Please try again.'}
                  </p>
                  {(error === 'OAuthSignin' || error === 'OAuthCallback') && googleCallbackUrl && (
                    <p className="text-xs text-red-600 mt-1">
                      Expected callback URL: <code className="bg-red-100 px-1 rounded">{googleCallbackUrl}</code>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCredentialsSignIn} className="space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-12 pr-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <Eye className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                  />
                  <span className="ml-2 text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                    Remember me
                  </span>
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-3.5 px-6 rounded-lg shadow-lg shadow-purple-500/30 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            {googleEnabled && (
              <>
                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">Or continue with</span>
                  </div>
                </div>

                {/* Social Sign In Buttons */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                    className="w-full flex items-center justify-center space-x-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {googleLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-medium text-gray-700">Signing in with Google...</span>
                      </>
                    ) : (
                      <>
                        <FcGoogle className="w-5 h-5" />
                        <span className="text-sm font-medium text-gray-700">Continue with Google</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Sign Up Link */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100">
            <p className="text-center text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <Link
                href="/auth/signup"
                className="font-semibold text-purple-600 hover:text-purple-700 transition-colors"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-8">
          By signing in, you agree to our{' '}
          <a href="/terms" className="underline hover:text-gray-700">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" className="underline hover:text-gray-700">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
