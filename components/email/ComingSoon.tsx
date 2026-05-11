import { LucideIcon, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ComingSoonProps {
  title: string;
  icon: LucideIcon;
  description: string;
  features: string[];
}

export function ComingSoon({ title, icon: Icon, description, features }: ComingSoonProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-5">
          <Icon className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Coming Soon</h2>
        <p className="text-gray-500 max-w-md mx-auto mb-6">
          This feature is being ported from the legacy email marketing system into the
          dashboard. It will be available in an upcoming release.
        </p>

        <div className="max-w-md mx-auto text-left bg-gray-50 rounded-lg p-5 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            What this page will include:
          </p>
          <ul className="space-y-1.5 text-sm text-gray-600">
            {features.map(feature => (
              <li key={feature} className="flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">•</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Link href="/email/templates">
            <Button variant="outline">Go to Email Templates</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
