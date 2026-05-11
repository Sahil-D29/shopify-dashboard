import { ArrowRightLeft } from 'lucide-react';
import { ComingSoon } from '@/components/email/ComingSoon';

export default function EmailCrossSellPage() {
  return (
    <ComingSoon
      title="Cross-Sell Rules"
      icon={ArrowRightLeft}
      description="Recommend related products to customers after purchase via email."
      features={[
        'Per-product cross-sell rules (e.g. "if X purchased, suggest Y")',
        'Automatic post-purchase email triggers',
        'Curated product picks based on order history',
        'Performance tracking: opens, clicks, revenue attributed',
        'Bulk rule import from collection tags',
      ]}
    />
  );
}
