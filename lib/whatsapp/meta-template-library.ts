/**
 * Curated Meta WhatsApp "Template Library" — a catalog of ready-made templates
 * modelled on the ones Meta offers in WhatsApp Manager → Template library.
 *
 * Meta does not expose the full library over a public list API, so we bundle a
 * curated set of the most-used Utility/Authentication templates. Users browse
 * these and click "Use this template" to open the builder pre-filled.
 */

export interface LibraryButton {
  type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface LibraryTemplate {
  id: string;
  /** Suggested template name (snake_case, lowercase) */
  name: string;
  /** Human-friendly title shown on the card */
  title: string;
  category: 'UTILITY' | 'AUTHENTICATION' | 'MARKETING';
  language: string;
  /** Grouping shown as a small label, e.g. "Order management" */
  useCase: string;
  header?: { type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'; content: string };
  body: string;
  footer?: string;
  buttons?: LibraryButton[];
  sampleValues?: Record<string, string>;
}

export const META_TEMPLATE_LIBRARY: LibraryTemplate[] = [
  // ───────────────── Order management (UTILITY) ─────────────────
  {
    id: 'order_confirmation',
    name: 'order_confirmation',
    title: 'Order confirmation',
    category: 'UTILITY',
    language: 'en_US',
    useCase: 'Order management',
    body: 'Hi {{1}}, thanks for your order! 🎉\n\nYour order *{{2}}* has been confirmed and is being processed. Total: {{3}}.\n\nWe\'ll let you know once it ships.',
    footer: 'Thank you for shopping with us',
    buttons: [{ type: 'URL', text: 'View order', url: 'https://example.com/orders/{{1}}' }],
    sampleValues: { '1': 'Aarav', '2': '#10245', '3': '₹1,299' },
  },
  {
    id: 'order_shipped',
    name: 'order_shipped',
    title: 'Order shipped',
    category: 'UTILITY',
    language: 'en_US',
    useCase: 'Order management',
    body: 'Good news {{1}}! 📦\n\nYour order *{{2}}* has shipped via {{3}}. Tracking number: {{4}}.\n\nExpected delivery: {{5}}.',
    footer: 'Track anytime from the link below',
    buttons: [{ type: 'URL', text: 'Track order', url: 'https://example.com/track/{{1}}' }],
    sampleValues: { '1': 'Aarav', '2': '#10245', '3': 'BlueDart', '4': 'BD123456789', '5': 'Tomorrow' },
  },
  {
    id: 'order_delivered',
    name: 'order_delivered',
    title: 'Order delivered',
    category: 'UTILITY',
    language: 'en_US',
    useCase: 'Order management',
    body: 'Hi {{1}}, your order *{{2}}* has been delivered. 🛍️\n\nWe hope you love it! If anything\'s not right, just reply to this message.',
    footer: 'We\'re here to help',
    buttons: [{ type: 'QUICK_REPLY', text: 'Leave a review' }, { type: 'QUICK_REPLY', text: 'Report an issue' }],
    sampleValues: { '1': 'Aarav', '2': '#10245' },
  },
  {
    id: 'order_cancelled',
    name: 'order_cancelled',
    title: 'Order cancelled',
    category: 'UTILITY',
    language: 'en_US',
    useCase: 'Order management',
    body: 'Hi {{1}}, your order *{{2}}* has been cancelled and a refund of {{3}} has been initiated.\n\nIt may take 5-7 business days to reflect in your account.',
    footer: 'Sorry to see you go',
    sampleValues: { '1': 'Aarav', '2': '#10245', '3': '₹1,299' },
  },

  // ───────────────── Account updates (UTILITY) ─────────────────
  {
    id: 'account_creation_confirmation',
    name: 'account_creation_confirmation',
    title: 'Finalize account set-up',
    category: 'UTILITY',
    language: 'en_US',
    useCase: 'Account updates',
    body: 'Hi {{1}},\n\nYour new account has been created successfully.\n\nPlease verify {{2}} to complete your profile.',
    buttons: [{ type: 'URL', text: 'Verify account', url: 'https://example.com/verify/{{1}}' }],
    sampleValues: { '1': 'Aarav', '2': 'your email' },
  },
  {
    id: 'address_update',
    name: 'address_update',
    title: 'Address update',
    category: 'UTILITY',
    language: 'en_US',
    useCase: 'Account updates',
    body: 'Hi {{1}}, your delivery address has been successfully updated to {{2}}.\n\nContact {{3}} for any inquiries.',
    sampleValues: { '1': 'Aarav', '2': '12 MG Road, Bengaluru', '3': 'support' },
  },
  {
    id: 'password_reset',
    name: 'password_reset_request',
    title: 'Password reset',
    category: 'UTILITY',
    language: 'en_US',
    useCase: 'Account updates',
    body: 'Hi {{1}}, we received a request to reset your password.\n\nUse the button below to set a new one. If you didn\'t request this, you can ignore this message.',
    footer: 'This link expires in 30 minutes',
    buttons: [{ type: 'URL', text: 'Reset password', url: 'https://example.com/reset/{{1}}' }],
    sampleValues: { '1': 'Aarav' },
  },

  // ───────────────── Appointments (UTILITY) ─────────────────
  {
    id: 'appointment_reminder',
    name: 'appointment_reminder',
    title: 'Appointment reminder',
    category: 'UTILITY',
    language: 'en_US',
    useCase: 'Event reminder',
    body: 'Hi {{1}}, this is a reminder of your appointment with {{2}} on {{3}} at {{4}}.\n\nReply to confirm or reschedule.',
    buttons: [{ type: 'QUICK_REPLY', text: 'Confirm' }, { type: 'QUICK_REPLY', text: 'Reschedule' }],
    sampleValues: { '1': 'Aarav', '2': 'Dr. Mehta', '3': 'Jun 12', '4': '4:30 PM' },
  },
  {
    id: 'appointment_cancelled',
    name: 'appointment_cancelled',
    title: 'Appointment cancelled',
    category: 'UTILITY',
    language: 'en_US',
    useCase: 'Event reminder',
    body: 'Hi {{1}},\n\nYour appointment on {{2}} has been cancelled. We hope to see you another time.\n\nLet us know if you have any questions.',
    sampleValues: { '1': 'Aarav', '2': 'Jun 12, 4:30 PM' },
  },

  // ───────────────── Payments (UTILITY) ─────────────────
  {
    id: 'payment_received',
    name: 'payment_received',
    title: 'Payment received',
    category: 'UTILITY',
    language: 'en_US',
    useCase: 'Payments',
    body: 'Hi {{1}}, we\'ve received your payment of {{2}} for order *{{3}}*. ✅\n\nThank you!',
    footer: 'A receipt has been emailed to you',
    sampleValues: { '1': 'Aarav', '2': '₹1,299', '3': '#10245' },
  },
  {
    id: 'payment_due_reminder',
    name: 'payment_due_reminder',
    title: 'Payment due reminder',
    category: 'UTILITY',
    language: 'en_US',
    useCase: 'Payments',
    body: 'Hi {{1}}, a friendly reminder that your payment of {{2}} for invoice {{3}} is due on {{4}}.',
    buttons: [{ type: 'URL', text: 'Pay now', url: 'https://example.com/pay/{{1}}' }],
    sampleValues: { '1': 'Aarav', '2': '₹2,499', '3': 'INV-882', '4': 'Jun 15' },
  },

  // ───────────────── Feedback (MARKETING / UTILITY) ─────────────────
  {
    id: 'feedback_request',
    name: 'feedback_request',
    title: 'Feedback request',
    category: 'MARKETING',
    language: 'en_US',
    useCase: 'Customer Feedback',
    body: 'Hi {{1}}, how was your experience with {{2}}? ⭐\n\nWe\'d love your feedback — it helps us serve you better.',
    buttons: [{ type: 'QUICK_REPLY', text: '😍 Great' }, { type: 'QUICK_REPLY', text: '😐 Okay' }, { type: 'QUICK_REPLY', text: '😞 Poor' }],
    sampleValues: { '1': 'Aarav', '2': 'your recent order' },
  },
  {
    id: 'back_in_stock',
    name: 'back_in_stock',
    title: 'Back in stock',
    category: 'MARKETING',
    language: 'en_US',
    useCase: 'Offers',
    body: 'Good news {{1}}! 🎉\n\n*{{2}}* is back in stock. Grab it before it sells out again.',
    buttons: [{ type: 'URL', text: 'Shop now', url: 'https://example.com/product/{{1}}' }],
    sampleValues: { '1': 'Aarav', '2': 'Classic White Sneakers' },
  },
  {
    id: 'abandoned_cart',
    name: 'abandoned_cart_reminder',
    title: 'Abandoned cart reminder',
    category: 'MARKETING',
    language: 'en_US',
    useCase: 'Offers',
    body: 'Hi {{1}}, you left {{2}} in your cart! 🛒\n\nComplete your purchase now and it\'s yours.',
    footer: 'Items may sell out soon',
    buttons: [{ type: 'URL', text: 'Complete order', url: 'https://example.com/cart' }],
    sampleValues: { '1': 'Aarav', '2': 'Classic White Sneakers' },
  },

  // ───────────────── Authentication (AUTHENTICATION) ─────────────────
  {
    id: 'otp_verification',
    name: 'otp_verification_code',
    title: 'One-time passcode',
    category: 'AUTHENTICATION',
    language: 'en_US',
    useCase: 'Authentication',
    body: '{{1}} is your verification code. For your security, do not share this code.',
    footer: 'This code expires in 10 minutes',
    buttons: [{ type: 'QUICK_REPLY', text: 'Copy code' }],
    sampleValues: { '1': '482913' },
  },
  {
    id: 'login_alert',
    name: 'login_alert',
    title: 'New login alert',
    category: 'AUTHENTICATION',
    language: 'en_US',
    useCase: 'Authentication',
    body: 'Hi {{1}}, we detected a new login to your account from {{2}} at {{3}}.\n\nIf this wasn\'t you, secure your account immediately.',
    buttons: [{ type: 'URL', text: 'Secure account', url: 'https://example.com/security' }],
    sampleValues: { '1': 'Aarav', '2': 'Bengaluru, India', '3': '6:48 AM' },
  },
];

export const LIBRARY_CATEGORIES = ['ALL', 'UTILITY', 'AUTHENTICATION', 'MARKETING'] as const;
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];
