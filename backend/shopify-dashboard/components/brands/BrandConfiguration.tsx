"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, CheckCircle2, XCircle, Palette, Building2, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useTenant } from '@/lib/tenant/tenant-context';

interface BrandData {
  brandName: string;
  brandLogo: string | null;
  brandColor: string;
  brandSecondaryColor: string | null;
  timezone: string;
  industryType: string;
  emailSignature: string | null;
  socialLinks: {
    website?: string;
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
}

interface BrandConfigurationProps {
  storeId: string;
  onSuccess?: () => void;
}

const INDUSTRY_TYPES = [
  'Retail',
  'Fashion',
  'Electronics',
  'Food & Beverage',
  'Health & Beauty',
  'Home & Garden',
  'Sports & Outdoors',
  'Automotive',
  'Other'
];

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney'
];

export function BrandConfiguration({ storeId, onSuccess }: BrandConfigurationProps) {
  const { currentStore } = useTenant();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [brandData, setBrandData] = useState<BrandData>({
    brandName: '',
    brandLogo: null,
    brandColor: '#000000',
    brandSecondaryColor: null,
    timezone: 'UTC',
    industryType: '',
    emailSignature: null,
    socialLinks: {}
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing brand data
  useEffect(() => {
    const loadBrand = async () => {
      try {
        const res = await fetch(`/api/brands?storeId=${storeId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.brands && data.brands.length > 0) {
            const brand = data.brands[0];
            setBrandData({
              brandName: brand.brandName || '',
              brandLogo: brand.brandLogo || null,
              brandColor: brand.brandColor || '#000000',
              brandSecondaryColor: brand.brandSecondaryColor || null,
              timezone: brand.timezone || 'UTC',
              industryType: brand.industryType || '',
              emailSignature: brand.emailSignature || null,
              socialLinks: brand.socialLinks || {}
            });
          }
        }
      } catch (error) {
        console.error('Failed to load brand:', error);
      }
    };

    if (storeId) {
      loadBrand();
    }
  }, [storeId]);

  const validateStep = (stepNum: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNum === 1) {
      if (!brandData.brandName.trim()) {
        newErrors.brandName = 'Brand name is required';
      }
      if (!brandData.industryType) {
        newErrors.industryType = 'Industry type is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      // In production, upload to S3/Cloudinary
      // For now, convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setBrandData(prev => ({ ...prev, brandLogo: base64String }));
        setUploading(false);
        toast.success('Logo uploaded successfully');
      };
      reader.onerror = () => {
        setUploading(false);
        toast.error('Failed to upload logo');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setUploading(false);
      toast.error('Failed to upload logo');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    } else {
      toast.error('Please upload an image file');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleSave = async () => {
    if (!validateStep(step)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/brands/stores/${storeId}/brand`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save brand configuration');
      }

      const data = await res.json();
      toast.success('Brand configuration saved successfully!');
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save brand configuration';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center flex-1">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step >= s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
            </div>
            {s < 3 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  step > s ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Basic Information */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Basic Information
            </CardTitle>
            <CardDescription>Enter your brand's basic details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brandName">Brand Name *</Label>
              <Input
                id="brandName"
                value={brandData.brandName}
                onChange={(e) =>
                  setBrandData(prev => ({ ...prev, brandName: e.target.value }))
                }
                placeholder="Enter brand name"
              />
              {errors.brandName && (
                <p className="text-sm text-destructive">{errors.brandName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="industryType">Industry Type *</Label>
              <Select
                value={brandData.industryType}
                onValueChange={(value) =>
                  setBrandData(prev => ({ ...prev, industryType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.industryType && (
                <p className="text-sm text-destructive">{errors.industryType}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={brandData.timezone}
                onValueChange={(value) =>
                  setBrandData(prev => ({ ...prev, timezone: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Brand Identity */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Brand Identity
            </CardTitle>
            <CardDescription>Customize your brand's visual identity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Brand Logo</Label>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              >
                {uploading ? (
                  <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                ) : brandData.brandLogo ? (
                  <div className="space-y-2">
                    <img
                      src={brandData.brandLogo}
                      alt="Brand logo"
                      className="max-h-32 mx-auto"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBrandData(prev => ({ ...prev, brandLogo: null }))}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drag and drop or click to upload
                    </p>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('logo-upload')?.click()}
                    >
                      Select Image
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brandColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="brandColor"
                    type="color"
                    value={brandData.brandColor}
                    onChange={(e) =>
                      setBrandData(prev => ({ ...prev, brandColor: e.target.value }))
                    }
                    className="w-20 h-10"
                  />
                  <Input
                    value={brandData.brandColor}
                    onChange={(e) =>
                      setBrandData(prev => ({ ...prev, brandColor: e.target.value }))
                    }
                    placeholder="#000000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Color (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={brandData.brandSecondaryColor || '#ffffff'}
                    onChange={(e) =>
                      setBrandData(prev => ({ ...prev, brandSecondaryColor: e.target.value }))
                    }
                    className="w-20 h-10"
                  />
                  <Input
                    value={brandData.brandSecondaryColor || ''}
                    onChange={(e) =>
                      setBrandData(prev => ({ ...prev, brandSecondaryColor: e.target.value || null }))
                    }
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div className="mt-6 p-4 border rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-2">Preview</p>
              <div
                className="p-4 rounded"
                style={{
                  backgroundColor: brandData.brandSecondaryColor || '#ffffff',
                  color: brandData.brandColor
                }}
              >
                <div className="flex items-center gap-3">
                  {brandData.brandLogo && (
                    <img
                      src={brandData.brandLogo}
                      alt="Brand"
                      className="w-12 h-12 rounded"
                    />
                  )}
                  <div>
                    <p className="font-semibold">{brandData.brandName || 'Brand Name'}</p>
                    <p className="text-sm opacity-80">Sample message preview</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Additional Settings */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Additional Settings
            </CardTitle>
            <CardDescription>Optional brand settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailSignature">Email Signature</Label>
              <Textarea
                id="emailSignature"
                value={brandData.emailSignature || ''}
                onChange={(e) =>
                  setBrandData(prev => ({ ...prev, emailSignature: e.target.value || null }))
                }
                placeholder="Enter email signature"
                rows={4}
              />
            </div>

            <div className="space-y-4">
              <Label>Social Links</Label>
              <div className="space-y-2">
                <Input
                  placeholder="Website URL"
                  value={brandData.socialLinks.website || ''}
                  onChange={(e) =>
                    setBrandData(prev => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, website: e.target.value }
                    }))
                  }
                />
                <Input
                  placeholder="Facebook URL"
                  value={brandData.socialLinks.facebook || ''}
                  onChange={(e) =>
                    setBrandData(prev => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, facebook: e.target.value }
                    }))
                  }
                />
                <Input
                  placeholder="Instagram URL"
                  value={brandData.socialLinks.instagram || ''}
                  onChange={(e) =>
                    setBrandData(prev => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, instagram: e.target.value }
                    }))
                  }
                />
                <Input
                  placeholder="Twitter URL"
                  value={brandData.socialLinks.twitter || ''}
                  onChange={(e) =>
                    setBrandData(prev => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, twitter: e.target.value }
                    }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={step === 1}
        >
          Previous
        </Button>
        <div className="flex gap-2">
          {step < 3 ? (
            <Button onClick={nextStep}>Next</Button>
          ) : (
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Configuration
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

