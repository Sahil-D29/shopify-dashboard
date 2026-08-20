import { redirect } from 'next/navigation';

export default function WhatsAppRedirectPage() {
  redirect('/settings?tab=whatsapp');
}
