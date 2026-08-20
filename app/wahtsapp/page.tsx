import { redirect } from 'next/navigation';

export default function MisspelledWhatsAppRedirectPage() {
  redirect('/settings?tab=whatsapp');
}
