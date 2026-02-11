'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, { title: string; message: string }> = {
    Configuration: {
      title: 'Configuration Error',
      message: 'There is a problem with the server configuration. Please contact support.',
    },
    AccessDenied: {
      title: 'Access Denied',
      message: 'You do not have permission to sign in.',
    },
    Verification: {
      title: 'Verification Error',
      message: 'The verification link has expired or has already been used.',
    },
    OAuthSignin: {
      title: 'OAuth Sign-In Error',
      message: 'Error in constructing an authorization URL. Please try again.',
    },
    OAuthCallback: {
      title: 'OAuth Callback Error',
      message: 'Error in handling the response from the OAuth provider. Please try again.',
    },
    OAuthCreateAccount: {
      title: 'Account Creation Error',
      message: 'Could not create OAuth provider user in the database. Please contact support.',
    },
    EmailCreateAccount: {
      title: 'Account Creation Error',
      message: 'Could not create email provider user in the database. Please contact support.',
    },
    Callback: {
      title: 'Callback Error',
      message: 'Error in the OAuth callback handler route. Please try again.',
    },
    OAuthAccountNotLinked: {
      title: 'Account Not Linked',
      message: 'This email is already associated with a different sign-in method. Please use the original sign-in method.',
    },
    CredentialsSignin: {
      title: 'Sign-In Error',
      message: 'Invalid email or password. Please check your credentials and try again.',
    },
    Default: {
      title: 'Authentication Error',
      message: 'Unable to sign in. Please try again or contact support if the problem persists.',
    },
  };

  const errorInfo = errorMessages[error || 'Default'] || errorMessages.Default;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{errorInfo.title}</h2>
            <p className="text-gray-600 mb-6">{errorInfo.message}</p>
            
            {error && error !== 'Default' && (
              <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 font-mono">{error}</p>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/auth/signin"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-semibold rounded-lg text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/30 transition-all transform hover:scale-105"
              >
                Try Again
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all"
              >
                Go Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}



