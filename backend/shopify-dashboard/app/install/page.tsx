'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingBag, Check, ArrowRight, Shield, Zap, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

export default function InstallPage() {
  const router = useRouter();
  const [shop, setShop] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInstall = async () => {
    if (!shop.trim()) {
      setError('Please enter your Shopify store domain');
      return;
    }

    // Normalize shop domain
    let shopDomain = shop.trim().toLowerCase();
    if (!shopDomain.includes('.')) {
      shopDomain = `${shopDomain}.myshopify.com`;
    }
    if (!shopDomain.endsWith('.myshopify.com')) {
      setError('Please enter a valid Shopify store domain (e.g., yourstore.myshopify.com)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/auth/shopify?shop=${encodeURIComponent(shopDomain)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate install URL');
      }

      const data = await response.json();
      
      // Redirect to Shopify OAuth
      window.location.href = data.installUrl;
    } catch (error: any) {
      console.error('Install error:', error);
      setError(error.message || 'Failed to start installation');
      toast.error(error.message || 'Failed to start installation');
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Zap,
      title: 'Automated Journeys',
      description: 'Create powerful customer journeys with WhatsApp automation',
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Track performance and optimize your marketing campaigns',
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Enterprise-grade security and 99.9% uptime guarantee',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mb-4">
            <ShoppingBag className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Connect Your Shopify Store
          </h1>
          <p className="text-lg text-gray-600">
            Install the app to start automating customer engagement
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Installation Form */}
          <Card>
            <CardHeader>
              <CardTitle>Connect Your Store</CardTitle>
              <CardDescription>
                Enter your Shopify store domain to begin installation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shop">Shopify Store Domain</Label>
                <Input
                  id="shop"
                  placeholder="yourstore.myshopify.com"
                  value={shop}
                  onChange={(e) => setShop(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleInstall()}
                  disabled={loading}
                />
                <p className="text-xs text-gray-500">
                  Enter your store domain (e.g., yourstore.myshopify.com)
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <Button
                onClick={handleInstall}
                disabled={loading || !shop.trim()}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>Installing...</>
                ) : (
                  <>
                    Install App
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="pt-4 border-t">
                <p className="text-xs text-gray-500 text-center">
                  By installing, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle>What You'll Get</CardTitle>
              <CardDescription>
                Powerful features to grow your business
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <feature.icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                      <p className="text-sm text-gray-600">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 text-green-800">
                  <Check className="h-5 w-5" />
                  <span className="font-semibold">Free 14-day trial</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  No credit card required. Cancel anytime.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Already have an account? <a href="/auth/signin" className="text-blue-600 hover:underline">Sign in</a></p>
        </div>
      </div>
    </div>
  );
}

