'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/lib/tenant/tenant-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Store, MessageSquare, Zap, BarChart3, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const steps = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Let\'s get your store set up in just a few steps',
    icon: Store,
  },
  {
    id: 'whatsapp',
    title: 'Connect WhatsApp',
    description: 'Set up your WhatsApp Business API credentials',
    icon: MessageSquare,
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start creating journeys and campaigns',
    icon: CheckCircle2,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { currentStore } = useTenant();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If no store, redirect to install
    if (!currentStore) {
      router.push('/install');
    }
  }, [currentStore, router]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      handleComplete();
    }
  };

  const handleSkip = () => {
    router.push('/');
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      // Mark onboarding as complete (could store in user preferences)
      const storage = typeof window !== 'undefined' ? localStorage : null;
      if (storage) {
        storage.setItem('onboarding_complete', 'true');
      }
      
      toast.success('Onboarding complete!');
      router.push('/');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error('Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  if (!currentStore) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const currentStepData = steps[currentStep];
  const StepIcon = currentStepData.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                      index <= currentStep
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                  >
                    {index < currentStep ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <span className="font-semibold">{index + 1}</span>
                    )}
                  </div>
                  <p className="text-xs mt-2 text-center max-w-[100px]">{step.title}</p>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 flex-1 mx-2 ${
                      index < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <StepIcon className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">{currentStepData.title}</CardTitle>
            <CardDescription className="text-base">
              {currentStepData.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold mb-2">Store Connected</h3>
                  <p className="text-sm text-gray-700">
                    <strong>{currentStore.name}</strong> ({currentStore.shopDomain})
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Automated Customer Journeys</h4>
                      <p className="text-sm text-gray-600">
                        Create powerful automation workflows for your customers
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <BarChart3 className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Advanced Analytics</h4>
                      <p className="text-sm text-gray-600">
                        Track performance and optimize your campaigns
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">WhatsApp Integration</h4>
                      <p className="text-sm text-gray-600">
                        Send personalized messages to your customers
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                <p className="text-gray-600">
                  Connect your WhatsApp Business API to start sending messages to customers.
                </p>
                <Button
                  onClick={() => router.push('/settings?tab=whatsapp')}
                  variant="outline"
                  className="w-full"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Go to WhatsApp Settings
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  You can set this up later from Settings
                </p>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4 text-center">
                <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">All Set!</h3>
                  <p className="text-gray-600">
                    Your store is connected and ready to use. Start creating journeys and campaigns to engage your customers.
                  </p>
                </div>
                <div className="pt-4">
                  <Button
                    onClick={handleComplete}
                    disabled={loading}
                    size="lg"
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      <>
                        Go to Dashboard
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              {currentStep > 0 ? (
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(currentStep - 1)}
                >
                  Previous
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                {currentStep < steps.length - 1 && (
                  <Button variant="ghost" onClick={handleSkip}>
                    Skip
                  </Button>
                )}
                <Button onClick={handleNext}>
                  {currentStep === steps.length - 1 ? 'Complete' : 'Next'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

