import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/whatsapp/normalize-phone';

interface JourneyRecipient {
  id: string;
  phone?: string | null;
  email?: string | null;
}

export async function resolveOptedInWhatsAppRecipient(storeId: string, recipient: JourneyRecipient) {
  const phone = normalizePhone(recipient.phone ?? '');
  const contact = await prisma.contact.findFirst({
    where: {
      storeId,
      optInStatus: 'OPTED_IN',
      OR: [
        { id: recipient.id },
        { shopifyCustomerId: recipient.id },
        ...(recipient.email ? [{ email: recipient.email }] : []),
        ...(phone ? [{ phone }, { phone: recipient.phone! }] : []),
      ],
    },
    select: { id: true, phone: true, email: true, name: true },
  });
  if (!contact?.phone) return null;
  return {
    id: contact.id,
    phone: contact.phone,
    email: contact.email,
    first_name: contact.name,
  };
}
