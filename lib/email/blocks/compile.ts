/**
 * Compile an EmailDocument (block tree) to an email-safe HTML string.
 *
 * "Email-safe" here means table-based layout, inline styles, no
 * <script>, no flexbox/grid — the lowest common denominator that
 * Gmail/Outlook/Apple Mail all render consistently.
 *
 * The compiler is pure: same input → same output. Merge tags
 * (e.g. {{first_name}}) are left as-is; lib/email/send-campaign.ts
 * personalizes them per-recipient at send time.
 */

import type {
  Block,
  ButtonBlock,
  DividerBlock,
  EmailDocument,
  FooterBlock,
  HeadingBlock,
  ImageBlock,
  ProductBlock,
  SocialBlock,
  SpacerBlock,
  TextBlock,
} from './types';

/** HTML-encode a string for use as text content. Preserves merge tags. */
function escapeText(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape an attribute value (URLs, alt text). Strips javascript: hrefs. */
function escapeAttr(value: string): string {
  const trimmed = String(value ?? '').trim();
  if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed)) return '#';
  return trimmed
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sanitize a fragment of inline HTML for the text block.
 * Allowed: <b>, <strong>, <i>, <em>, <u>, <br>, <a href="...">. Everything else
 * is escaped. Merge tags ({{first_name}}) pass through untouched.
 */
function sanitizeInlineHtml(input: string): string {
  const ALLOWED_VOID = new Set(['br']);
  const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'a']);
  let out = '';
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch !== '<') {
      out += ch === '&' ? '&amp;' : ch;
      i++;
      continue;
    }
    // Tag start
    const end = input.indexOf('>', i);
    if (end === -1) {
      out += '&lt;';
      i++;
      continue;
    }
    const raw = input.slice(i + 1, end);
    const isClosing = raw.startsWith('/');
    const body = isClosing ? raw.slice(1) : raw;
    const spaceIdx = body.search(/\s/);
    const tagName = (spaceIdx === -1 ? body : body.slice(0, spaceIdx)).toLowerCase();
    if (ALLOWED_VOID.has(tagName)) {
      out += `<${tagName}>`;
      i = end + 1;
      continue;
    }
    if (ALLOWED_TAGS.has(tagName)) {
      if (isClosing) {
        out += `</${tagName}>`;
      } else if (tagName === 'a') {
        // Only allow href attribute, drop others
        const hrefMatch = body.match(/href\s*=\s*["']([^"']*)["']/i);
        const href = hrefMatch ? escapeAttr(hrefMatch[1]) : '#';
        out += `<a href="${href}" style="color:#e94560;text-decoration:underline;">`;
      } else {
        out += `<${tagName}>`;
      }
      i = end + 1;
      continue;
    }
    // Disallowed tag: escape the whole thing
    out += '&lt;' + escapeText(raw) + '&gt;';
    i = end + 1;
  }
  // Convert literal newlines to <br>
  return out.replace(/\n/g, '<br>');
}

function renderHeading(b: HeadingBlock): string {
  const tag = `h${b.level}`;
  const size = b.level === 1 ? 28 : b.level === 2 ? 22 : 18;
  return `<tr><td style="padding:0 32px 12px;text-align:${b.align};">
    <${tag} style="margin:0;font-size:${size}px;line-height:1.3;color:${escapeAttr(b.color)};font-weight:700;">
      ${escapeText(b.text)}
    </${tag}>
  </td></tr>`;
}

function renderText(b: TextBlock): string {
  return `<tr><td style="padding:0 32px 12px;text-align:${b.align};">
    <div style="margin:0;font-size:${b.fontSize}px;line-height:1.6;color:${escapeAttr(b.color)};">
      ${sanitizeInlineHtml(b.html)}
    </div>
  </td></tr>`;
}

function renderImage(b: ImageBlock): string {
  const width = Math.min(Math.max(b.width, 1), 600);
  const img = `<img src="${escapeAttr(b.src)}" alt="${escapeAttr(b.alt)}" width="${width}" style="display:block;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;${b.align === 'center' ? 'margin:0 auto;' : ''}" />`;
  const wrapped = b.href ? `<a href="${escapeAttr(b.href)}" style="display:inline-block;">${img}</a>` : img;
  return `<tr><td style="padding:8px 32px;text-align:${b.align};">${wrapped}</td></tr>`;
}

function renderButton(b: ButtonBlock): string {
  const pad = b.fullWidth ? '14px 0' : '14px 32px';
  const widthAttr = b.fullWidth ? 'display:block;width:100%;box-sizing:border-box;' : 'display:inline-block;';
  return `<tr><td style="padding:16px 32px;text-align:${b.align};">
    <a href="${escapeAttr(b.href)}" style="${widthAttr}background-color:${escapeAttr(b.backgroundColor)};color:${escapeAttr(b.textColor)};text-decoration:none;font-weight:600;font-size:16px;padding:${pad};border-radius:6px;text-align:center;">
      ${escapeText(b.text)}
    </a>
  </td></tr>`;
}

function renderDivider(b: DividerBlock): string {
  return `<tr><td style="padding:8px 32px;">
    <hr style="border:0;border-top:${b.thickness}px solid ${escapeAttr(b.color)};margin:0;" />
  </td></tr>`;
}

function renderSpacer(b: SpacerBlock): string {
  const h = Math.max(0, Math.min(b.height, 200));
  return `<tr><td style="line-height:0;font-size:0;">
    <div style="height:${h}px;line-height:${h}px;">&nbsp;</div>
  </td></tr>`;
}

function renderProduct(b: ProductBlock): string {
  return `<tr><td style="padding:16px 32px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #eee;border-radius:8px;">
      <tr><td style="padding:16px;text-align:center;">
        <img src="${escapeAttr(b.imageSrc)}" alt="${escapeAttr(b.title)}" width="200" style="max-width:200px;border-radius:4px;display:inline-block;border:0;" />
        <h3 style="color:#1a1a2e;margin:12px 0 4px;font-size:18px;">${escapeText(b.title)}</h3>
        <p style="color:#e94560;font-size:18px;font-weight:700;margin:0 0 12px;">${escapeText(b.price)}</p>
        <a href="${escapeAttr(b.buttonHref)}" style="display:inline-block;background-color:${escapeAttr(b.buttonColor)};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 24px;border-radius:6px;">
          ${escapeText(b.buttonText)}
        </a>
      </td></tr>
    </table>
  </td></tr>`;
}

function renderSocial(b: SocialBlock): string {
  const links: Array<[string, string, string]> = [];
  if (b.facebook) links.push(['Facebook', b.facebook, 'f']);
  if (b.instagram) links.push(['Instagram', b.instagram, 'IG']);
  if (b.twitter) links.push(['X', b.twitter, 'X']);
  if (b.youtube) links.push(['YouTube', b.youtube, 'YT']);
  if (b.linkedin) links.push(['LinkedIn', b.linkedin, 'in']);
  if (links.length === 0) {
    return `<tr><td style="padding:16px 32px;text-align:${b.align};color:#999;font-size:12px;">
      [No social links configured]
    </td></tr>`;
  }
  const icons = links
    .map(
      ([name, url, label]) => `
    <a href="${escapeAttr(url)}" style="display:inline-block;margin:0 6px;width:36px;height:36px;line-height:36px;text-align:center;background-color:#1a1a2e;color:#ffffff;text-decoration:none;border-radius:50%;font-weight:700;font-size:14px;" title="${escapeAttr(name)}">${escapeText(label)}</a>`,
    )
    .join('');
  return `<tr><td style="padding:16px 32px;text-align:${b.align};">${icons}</td></tr>`;
}

function renderFooter(b: FooterBlock): string {
  return `<tr><td style="padding:24px 32px;background-color:#f8f8f8;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee;">
    <p style="margin:0 0 4px;">${escapeText(b.companyName)}</p>
    ${b.address ? `<p style="margin:0 0 8px;">${escapeText(b.address)}</p>` : ''}
    <p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#999;text-decoration:underline;">${escapeText(b.unsubscribeText)}</a></p>
    <p style="margin:8px 0 0;">&copy; {{current_year}} ${escapeText(b.companyName)}. All rights reserved.</p>
  </td></tr>`;
}

function renderBlock(block: Block): string {
  switch (block.type) {
    case 'heading':
      return renderHeading(block);
    case 'text':
      return renderText(block);
    case 'image':
      return renderImage(block);
    case 'button':
      return renderButton(block);
    case 'divider':
      return renderDivider(block);
    case 'spacer':
      return renderSpacer(block);
    case 'product':
      return renderProduct(block);
    case 'social':
      return renderSocial(block);
    case 'footer':
      return renderFooter(block);
    default: {
      const exhaustive: never = block;
      void exhaustive;
      return '';
    }
  }
}

export function compileEmailDocument(doc: EmailDocument): string {
  const s = doc.settings;
  const inner = doc.blocks.map(renderBlock).join('\n');
  const preheader = s.preheaderText
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${escapeAttr(s.contentBackgroundColor)};">${escapeText(s.preheaderText)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Email</title>
<style>
  body { margin:0; padding:0; background-color:${escapeAttr(s.backgroundColor)}; font-family:${escapeAttr(s.fontFamily)}; }
  table { border-collapse:collapse; }
  @media only screen and (max-width:${s.contentWidth}px) {
    .email-container { width:100% !important; }
    td.padded { padding-left:16px !important; padding-right:16px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${escapeAttr(s.backgroundColor)};font-family:${escapeAttr(s.fontFamily)};">
${preheader}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${escapeAttr(s.backgroundColor)};padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${s.contentWidth}" class="email-container" style="max-width:${s.contentWidth}px;background-color:${escapeAttr(s.contentBackgroundColor)};border-radius:8px;overflow:hidden;">
      ${inner}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Try to parse an EmailDocument from arbitrary JSON. Returns null if it doesn't look right. */
export function parseEmailDocument(input: unknown): EmailDocument | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as any;
  if (obj.version !== 1 || !Array.isArray(obj.blocks)) return null;
  return obj as EmailDocument;
}
