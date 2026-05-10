// backend/config/email.config.js
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

export const EMAIL_CONFIG = {
  provider: process.env.EMAIL_PROVIDER || 'ses',

  ses: {
    region: process.env.AWS_SES_REGION || 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },

  defaults: {
    fromName: process.env.EMAIL_FROM_NAME || 'My Store',
    fromEmail: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
    replyTo: process.env.EMAIL_REPLY_TO || '',
  },

  sending: {
    ratePerSecond: parseInt(process.env.EMAIL_RATE_PER_SECOND || '10'),
    batchSize: parseInt(process.env.EMAIL_BATCH_SIZE || '50'),
    retryAttempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS || '3'),
    retryDelayMs: parseInt(process.env.EMAIL_RETRY_DELAY_MS || '60000'),
  },

  tracking: {
    baseUrl: process.env.EMAIL_TRACKING_BASE_URL || `http://localhost:${process.env.PORT || 5000}`,
    pixelPath: '/api/email/track/open',
    clickPath: '/api/email/track/click',
    unsubscribePath: '/api/email/unsubscribe',
  },

  compliance: {
    physicalAddress: process.env.EMAIL_PHYSICAL_ADDRESS || '',
    companyName: process.env.EMAIL_COMPANY_NAME || '',
    doubleOptIn: process.env.EMAIL_DOUBLE_OPT_IN === 'true',
  },
};
