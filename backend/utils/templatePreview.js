// backend/utils/templatePreview.js
import nodeHtmlToImage from 'node-html-to-image';
import path from 'path';
import fs from 'fs/promises';

const PREVIEWS_DIR = path.join(process.cwd(), 'backend', 'data', 'email-previews');

async function ensurePreviewsDir() {
  try {
    await fs.mkdir(PREVIEWS_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

export async function generateTemplatePreview(templateId, htmlContent, { width = 600, type = 'png' } = {}) {
  await ensurePreviewsDir();

  const filename = `${templateId}-preview.${type}`;
  const outputPath = path.join(PREVIEWS_DIR, filename);

  try {
    await nodeHtmlToImage({
      output: outputPath,
      html: htmlContent,
      puppeteerArgs: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
      type,
      quality: type === 'jpeg' ? 80 : undefined,
      transparent: type === 'png',
      encoding: 'binary',
      selector: 'body',
      waitUntil: 'networkidle0',
      content: {},
      puppeteer: undefined,
    });

    return {
      path: outputPath,
      filename,
      url: `/api/email/templates/preview/${templateId}`,
    };
  } catch (err) {
    console.error('Template preview generation failed:', err.message);
    return null;
  }
}

export async function generateMobilePreview(templateId, htmlContent) {
  await ensurePreviewsDir();

  const filename = `${templateId}-mobile-preview.png`;
  const outputPath = path.join(PREVIEWS_DIR, filename);

  try {
    await nodeHtmlToImage({
      output: outputPath,
      html: htmlContent,
      puppeteerArgs: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 375, height: 800 },
      },
      type: 'png',
      transparent: true,
      encoding: 'binary',
    });

    return {
      path: outputPath,
      filename,
      url: `/api/email/templates/preview/${templateId}/mobile`,
    };
  } catch (err) {
    console.error('Mobile preview generation failed:', err.message);
    return null;
  }
}

export async function getPreviewPath(templateId, mobile = false) {
  const suffix = mobile ? '-mobile-preview.png' : '-preview.png';
  const filePath = path.join(PREVIEWS_DIR, `${templateId}${suffix}`);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}
