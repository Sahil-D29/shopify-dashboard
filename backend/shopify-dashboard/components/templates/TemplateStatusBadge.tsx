import { TemplateStatus } from '@/lib/types/template';
import { CheckCircle, Clock, XCircle, FileText } from 'lucide-react';

interface Props {
  status: TemplateStatus;
}

export default function TemplateStatusBadge({ status }: Props) {
  const config = {
    DRAFT: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', icon: FileText, label: 'Draft' },
    PENDING: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', icon: Clock, label: 'Pending' },
    APPROVED: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle, label: 'Approved' },
    REJECTED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle, label: 'Rejected' },
  }[status];

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}


