// backend/services/emailService.js
import { SESClient, SendEmailCommand, SendBulkTemplatedEmailCommand } from '@aws-sdk/client-ses';
import { EMAIL_CONFIG } from '../config/email.config.js';

let sesClient = null;

function getSESClient() {
  if (!sesClient) {
    const config = {
      region: EMAIL_CONFIG.ses.region,
    };
    if (EMAIL_CONFIG.ses.accessKeyId && EMAIL_CONFIG.ses.secretAccessKey) {
      config.credentials = {
        accessKeyId: EMAIL_CONFIG.ses.accessKeyId,
        secretAccessKey: EMAIL_CONFIG.ses.secretAccessKey,
      };
    }
    sesClient = new SESClient(config);
  }
  return sesClient;
}

function stripHtmlToText(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '  - ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function sendEmail({ to, subject, htmlBody, textBody, fromName, fromEmail, replyTo, headers }) {
  const client = getSESClient();
  const from = `${fromName || EMAIL_CONFIG.defaults.fromName} <${fromEmail || EMAIL_CONFIG.defaults.fromEmail}>`;
  const finalReplyTo = replyTo || EMAIL_CONFIG.defaults.replyTo || fromEmail || EMAIL_CONFIG.defaults.fromEmail;
  const finalTextBody = textBody || stripHtmlToText(htmlBody);

  const params = {
    Source: from,
    Destination: {
      ToAddresses: Array.isArray(to) ? to : [to],
    },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: htmlBody, Charset: 'UTF-8' },
        Text: { Data: finalTextBody, Charset: 'UTF-8' },
      },
    },
    ReplyToAddresses: [finalReplyTo],
  };

  if (headers && headers['List-Unsubscribe']) {
    params.Tags = [
      { Name: 'list-unsubscribe', Value: 'true' },
    ];
  }

  const command = new SendEmailCommand(params);
  const result = await client.send(command);

  return {
    success: true,
    messageId: result.MessageId,
    provider: 'ses',
  };
}

export async function sendBulkEmails(recipients, { subject, htmlBodyTemplate, textBodyTemplate, fromName, fromEmail, replyTo, headers }) {
  const results = [];
  const rateDelay = Math.ceil(1000 / EMAIL_CONFIG.sending.ratePerSecond);

  for (let i = 0; i < recipients.length; i += EMAIL_CONFIG.sending.batchSize) {
    const batch = recipients.slice(i, i + EMAIL_CONFIG.sending.batchSize);

    const batchPromises = batch.map(async (recipient, idx) => {
      if (idx > 0) {
        await new Promise(r => setTimeout(r, rateDelay * idx));
      }

      try {
        const result = await sendEmail({
          to: recipient.email,
          subject: recipient.subject || subject,
          htmlBody: recipient.htmlBody || htmlBodyTemplate,
          textBody: recipient.textBody || textBodyTemplate,
          fromName,
          fromEmail,
          replyTo,
          headers,
        });
        results.push({ email: recipient.email, ...result });
      } catch (err) {
        results.push({ email: recipient.email, success: false, error: err.message });
      }
    });

    await Promise.all(batchPromises);
  }

  return results;
}

export async function sendTestEmail({ to, subject, htmlBody, fromName, fromEmail }) {
  return sendEmail({
    to,
    subject: `[TEST] ${subject}`,
    htmlBody,
    fromName: fromName || EMAIL_CONFIG.defaults.fromName,
    fromEmail: fromEmail || EMAIL_CONFIG.defaults.fromEmail,
  });
}
