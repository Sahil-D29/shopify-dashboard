/**
 * Block-based email document model.
 *
 * An email template is a tree of blocks (currently flat — columns can
 * be added later). Each block has a `type` discriminator and properties
 * specific to that type. The compiler in ./compile.ts walks the tree
 * and emits email-safe HTML (tables + inline styles).
 *
 * Persisted in EmailTemplate.jsonDesign and EmailCampaign.jsonDesign
 * fields. The corresponding htmlBody is regenerated from the JSON on
 * every save so the rendered email always matches the design.
 */

export type BlockType =
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'product'
  | 'social'
  | 'footer';

export type TextAlign = 'left' | 'center' | 'right';

export interface BlockBase<T extends BlockType> {
  id: string;
  type: T;
}

export interface HeadingBlock extends BlockBase<'heading'> {
  text: string;
  level: 1 | 2 | 3;
  align: TextAlign;
  color: string;
}

export interface TextBlock extends BlockBase<'text'> {
  /** Allows a very limited subset of inline HTML: <b>, <i>, <a>, <br>. Other tags are stripped on render. */
  html: string;
  align: TextAlign;
  color: string;
  fontSize: number; // px
}

export interface ImageBlock extends BlockBase<'image'> {
  src: string;
  alt: string;
  width: number; // px, max 600
  href?: string; // optional click-through
  align: TextAlign;
}

export interface ButtonBlock extends BlockBase<'button'> {
  text: string;
  href: string;
  backgroundColor: string;
  textColor: string;
  align: TextAlign;
  fullWidth: boolean;
}

export interface DividerBlock extends BlockBase<'divider'> {
  color: string;
  thickness: number; // px
}

export interface SpacerBlock extends BlockBase<'spacer'> {
  height: number; // px
}

export interface ProductBlock extends BlockBase<'product'> {
  imageSrc: string;
  title: string;
  price: string;
  buttonText: string;
  buttonHref: string;
  buttonColor: string;
}

export interface SocialBlock extends BlockBase<'social'> {
  align: TextAlign;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
}

export interface FooterBlock extends BlockBase<'footer'> {
  companyName: string;
  address: string;
  unsubscribeText: string;
}

export type Block =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | ProductBlock
  | SocialBlock
  | FooterBlock;

export interface EmailDocumentSettings {
  backgroundColor: string;
  contentBackgroundColor: string;
  contentWidth: number; // px, default 600
  fontFamily: string;
  preheaderText: string;
}

export interface EmailDocument {
  version: 1;
  settings: EmailDocumentSettings;
  blocks: Block[];
}

export const DEFAULT_SETTINGS: EmailDocumentSettings = {
  backgroundColor: '#f4f4f4',
  contentBackgroundColor: '#ffffff',
  contentWidth: 600,
  fontFamily: 'Arial, Helvetica, sans-serif',
  preheaderText: '',
};

export function createEmptyDocument(): EmailDocument {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    blocks: [],
  };
}

let idCounter = 0;
export function generateBlockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `blk_${crypto.randomUUID().slice(0, 8)}`;
  }
  idCounter += 1;
  return `blk_${Date.now().toString(36)}_${idCounter}`;
}

export function createBlock<T extends BlockType>(type: T): Block {
  const id = generateBlockId();
  switch (type) {
    case 'heading':
      return {
        id,
        type: 'heading',
        text: 'Hi {{first_name}},',
        level: 1,
        align: 'left',
        color: '#1a1a2e',
      };
    case 'text':
      return {
        id,
        type: 'text',
        html: 'Your message goes here. Use merge tags like {{first_name}} or {{shop_name}} to personalize.',
        align: 'left',
        color: '#555555',
        fontSize: 16,
      };
    case 'image':
      return {
        id,
        type: 'image',
        src: 'https://via.placeholder.com/600x300?text=Your+Image',
        alt: 'Image',
        width: 600,
        align: 'center',
      };
    case 'button':
      return {
        id,
        type: 'button',
        text: 'Shop Now',
        href: '{{shop_url}}',
        backgroundColor: '#e94560',
        textColor: '#ffffff',
        align: 'center',
        fullWidth: false,
      };
    case 'divider':
      return { id, type: 'divider', color: '#e5e7eb', thickness: 1 };
    case 'spacer':
      return { id, type: 'spacer', height: 24 };
    case 'product':
      return {
        id,
        type: 'product',
        imageSrc: 'https://via.placeholder.com/300x300?text=Product',
        title: 'Product Name',
        price: '$0.00',
        buttonText: 'View Product',
        buttonHref: '{{shop_url}}',
        buttonColor: '#e94560',
      };
    case 'social':
      return {
        id,
        type: 'social',
        align: 'center',
        facebook: '',
        instagram: '',
        twitter: '',
        youtube: '',
        linkedin: '',
      };
    case 'footer':
      return {
        id,
        type: 'footer',
        companyName: '{{shop_name}}',
        address: '',
        unsubscribeText: 'Unsubscribe',
      };
    default:
      throw new Error(`Unknown block type: ${type}`);
  }
}
