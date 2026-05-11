'use client';

import { useMemo, useState, type ComponentType } from 'react';
import {
  Type,
  AlignLeft,
  Image as ImageIcon,
  Square,
  Minus,
  Move,
  ShoppingBag,
  Share2,
  FileText,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Settings2,
  X,
} from 'lucide-react';
import {
  type Block,
  type BlockType,
  type EmailDocument,
  type TextAlign,
  createBlock,
  createEmptyDocument,
} from '@/lib/email/blocks/types';
import { compileEmailDocument } from '@/lib/email/blocks/compile';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BlockEditorProps {
  value: EmailDocument;
  onChange: (next: EmailDocument) => void;
}

interface PaletteItem {
  type: BlockType;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const PALETTE: PaletteItem[] = [
  { type: 'heading', label: 'Heading', icon: Type },
  { type: 'text', label: 'Text', icon: AlignLeft },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'button', label: 'Button', icon: Square },
  { type: 'divider', label: 'Divider', icon: Minus },
  { type: 'spacer', label: 'Spacer', icon: Move },
  { type: 'product', label: 'Product', icon: ShoppingBag },
  { type: 'social', label: 'Social', icon: Share2 },
  { type: 'footer', label: 'Footer', icon: FileText },
];

const ALIGN_OPTIONS: TextAlign[] = ['left', 'center', 'right'];

export function BlockEditor({ value, onChange }: BlockEditorProps) {
  const doc = value ?? createEmptyDocument();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const selectedBlock = useMemo(
    () => doc.blocks.find(b => b.id === selectedId) ?? null,
    [doc.blocks, selectedId],
  );

  function update(next: Partial<EmailDocument>) {
    onChange({ ...doc, ...next });
  }

  function updateBlock(id: string, patch: Partial<Block>) {
    onChange({
      ...doc,
      blocks: doc.blocks.map(b => (b.id === id ? ({ ...b, ...patch } as Block) : b)),
    });
  }

  function addBlock(type: BlockType) {
    const block = createBlock(type);
    onChange({ ...doc, blocks: [...doc.blocks, block] });
    setSelectedId(block.id);
  }

  function removeBlock(id: string) {
    onChange({ ...doc, blocks: doc.blocks.filter(b => b.id !== id) });
    if (selectedId === id) setSelectedId(null);
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const idx = doc.blocks.findIndex(b => b.id === id);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= doc.blocks.length) return;
    const blocks = [...doc.blocks];
    const [removed] = blocks.splice(idx, 1);
    blocks.splice(newIdx, 0, removed);
    onChange({ ...doc, blocks });
  }

  const previewHtml = useMemo(() => compileEmailDocument(doc), [doc]);

  return (
    <div className="grid grid-cols-12 gap-4 min-h-[600px]">
      {/* Block palette */}
      <div className="col-span-12 md:col-span-3 lg:col-span-2">
        <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-1 sticky top-4">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Add Block
            </span>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-1 gap-1">
            {PALETTE.map(p => {
              const Icon = p.icon;
              return (
                <button
                  key={p.type}
                  type="button"
                  onClick={() => addBlock(p.type)}
                  className="flex items-center gap-2 px-2 py-2 rounded-md text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{p.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50 mt-2 border-t pt-3"
          >
            <Settings2 className="h-4 w-4" />
            Email Settings
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="col-span-12 md:col-span-9 lg:col-span-6">
        <div
          className="rounded-xl border border-gray-200 overflow-hidden"
          style={{ backgroundColor: doc.settings.backgroundColor }}
        >
          <div className="p-2 bg-white/50 border-b border-gray-200 text-xs text-gray-500 text-center">
            Preview ({doc.settings.contentWidth}px)
          </div>
          <div className="p-6 flex justify-center">
            <div
              className="rounded-lg overflow-hidden shadow-sm"
              style={{
                width: `${doc.settings.contentWidth}px`,
                maxWidth: '100%',
                backgroundColor: doc.settings.contentBackgroundColor,
              }}
            >
              {doc.blocks.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-400">
                  <p className="mb-2">Empty canvas.</p>
                  <p>Click a block on the left to add it.</p>
                </div>
              ) : (
                doc.blocks.map(block => (
                  <BlockCanvasRow
                    key={block.id}
                    block={block}
                    selected={selectedId === block.id}
                    onSelect={() => setSelectedId(block.id)}
                    onMoveUp={() => moveBlock(block.id, -1)}
                    onMoveDown={() => moveBlock(block.id, 1)}
                    onRemove={() => removeBlock(block.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Properties panel */}
      <div className="col-span-12 md:col-span-12 lg:col-span-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-4 min-h-[300px]">
          {selectedBlock ? (
            <BlockProperties
              block={selectedBlock}
              onChange={patch => updateBlock(selectedBlock.id, patch)}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div className="text-center py-8 text-sm text-gray-400">
              <p className="mb-1">No block selected.</p>
              <p>Click a block in the canvas to edit its properties.</p>
            </div>
          )}
        </div>
      </div>

      {/* Settings modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Email Settings</h3>
              <button
                onClick={() => setSettingsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div>
              <Label htmlFor="bg">Outer Background Color</Label>
              <Input
                id="bg"
                type="text"
                value={doc.settings.backgroundColor}
                onChange={e =>
                  update({ settings: { ...doc.settings, backgroundColor: e.target.value } })
                }
              />
            </div>
            <div>
              <Label htmlFor="cbg">Content Background</Label>
              <Input
                id="cbg"
                type="text"
                value={doc.settings.contentBackgroundColor}
                onChange={e =>
                  update({
                    settings: { ...doc.settings, contentBackgroundColor: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="cw">Content Width (px)</Label>
              <Input
                id="cw"
                type="number"
                min={400}
                max={800}
                value={doc.settings.contentWidth}
                onChange={e =>
                  update({
                    settings: {
                      ...doc.settings,
                      contentWidth: Number(e.target.value) || 600,
                    },
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="font">Font Family</Label>
              <Input
                id="font"
                value={doc.settings.fontFamily}
                onChange={e =>
                  update({ settings: { ...doc.settings, fontFamily: e.target.value } })
                }
              />
            </div>
            <div>
              <Label htmlFor="preheader">Preheader Text</Label>
              <Input
                id="preheader"
                value={doc.settings.preheaderText}
                onChange={e =>
                  update({ settings: { ...doc.settings, preheaderText: e.target.value } })
                }
                placeholder="Shown after subject line in most inboxes"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setSettingsOpen(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BlockCanvasRow({
  block,
  selected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  block: Block;
  selected: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  // Render a thumbnail iframe per block so users see what each block looks like
  const html = useMemo(() => {
    // Wrap in a minimal table so the block renders standalone
    const doc = createEmptyDocument();
    return compileEmailDocument({ ...doc, blocks: [block] });
  }, [block]);

  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative group cursor-pointer border-2 transition-all',
        selected ? 'border-indigo-500' : 'border-transparent hover:border-indigo-200',
      )}
    >
      <iframe
        srcDoc={html}
        title={block.type}
        sandbox="allow-same-origin"
        className="w-full border-0 pointer-events-none"
        style={{ height: blockApproxHeight(block) }}
      />
      <div
        className={cn(
          'absolute top-1 right-1 flex items-center gap-1 bg-white shadow rounded-md p-0.5',
          'transition-opacity',
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <BlockActionButton onClick={e => { e.stopPropagation(); onMoveUp(); }} title="Move up">
          <ChevronUp className="h-3.5 w-3.5" />
        </BlockActionButton>
        <BlockActionButton onClick={e => { e.stopPropagation(); onMoveDown(); }} title="Move down">
          <ChevronDown className="h-3.5 w-3.5" />
        </BlockActionButton>
        <BlockActionButton
          onClick={e => { e.stopPropagation(); onRemove(); }}
          title="Delete"
          variant="danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </BlockActionButton>
      </div>
      <div
        className={cn(
          'absolute top-1 left-1 bg-white shadow rounded px-1.5 py-0.5 text-xs font-medium text-gray-600 transition-opacity',
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        {block.type}
      </div>
    </div>
  );
}

function BlockActionButton({
  onClick,
  children,
  title,
  variant = 'default',
}: {
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  title: string;
  variant?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1 rounded hover:bg-gray-100',
        variant === 'danger' ? 'text-red-600 hover:bg-red-50' : 'text-gray-600',
      )}
    >
      {children}
    </button>
  );
}

function blockApproxHeight(block: Block): number {
  switch (block.type) {
    case 'heading':
      return 80;
    case 'text':
      return 120;
    case 'image':
      return 280;
    case 'button':
      return 90;
    case 'divider':
      return 40;
    case 'spacer':
      return Math.max(60, (block as any).height + 20);
    case 'product':
      return 380;
    case 'social':
      return 80;
    case 'footer':
      return 140;
  }
}

function BlockProperties({
  block,
  onChange,
  onClose,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold capitalize">{block.type} block</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Deselect"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {block.type === 'heading' && (
        <>
          <div>
            <Label>Text</Label>
            <Input value={block.text} onChange={e => onChange({ text: e.target.value } as any)} />
          </div>
          <div>
            <Label>Level</Label>
            <div className="flex gap-1">
              {[1, 2, 3].map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onChange({ level: lvl } as any)}
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded border text-sm',
                    block.level === lvl
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                      : 'bg-white border-gray-200 text-gray-600',
                  )}
                >
                  H{lvl}
                </button>
              ))}
            </div>
          </div>
          <AlignControl value={block.align} onChange={align => onChange({ align } as any)} />
          <ColorControl label="Color" value={block.color} onChange={color => onChange({ color } as any)} />
        </>
      )}

      {block.type === 'text' && (
        <>
          <div>
            <Label>Content</Label>
            <textarea
              value={block.html}
              onChange={e => onChange({ html: e.target.value } as any)}
              rows={6}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-gray-500 mt-1">
              Allowed inline tags: &lt;b&gt; &lt;i&gt; &lt;u&gt; &lt;br&gt; &lt;a href="..."&gt;
            </p>
          </div>
          <AlignControl value={block.align} onChange={align => onChange({ align } as any)} />
          <ColorControl label="Color" value={block.color} onChange={color => onChange({ color } as any)} />
          <div>
            <Label>Font Size (px)</Label>
            <Input
              type="number"
              min={10}
              max={48}
              value={block.fontSize}
              onChange={e => onChange({ fontSize: Number(e.target.value) || 16 } as any)}
            />
          </div>
        </>
      )}

      {block.type === 'image' && (
        <>
          <div>
            <Label>Image URL</Label>
            <Input value={block.src} onChange={e => onChange({ src: e.target.value } as any)} />
          </div>
          <div>
            <Label>Alt Text</Label>
            <Input value={block.alt} onChange={e => onChange({ alt: e.target.value } as any)} />
          </div>
          <div>
            <Label>Link (optional)</Label>
            <Input
              value={block.href ?? ''}
              onChange={e => onChange({ href: e.target.value || undefined } as any)}
              placeholder="{{shop_url}}"
            />
          </div>
          <div>
            <Label>Width (px)</Label>
            <Input
              type="number"
              min={100}
              max={600}
              value={block.width}
              onChange={e => onChange({ width: Number(e.target.value) || 600 } as any)}
            />
          </div>
          <AlignControl value={block.align} onChange={align => onChange({ align } as any)} />
        </>
      )}

      {block.type === 'button' && (
        <>
          <div>
            <Label>Text</Label>
            <Input value={block.text} onChange={e => onChange({ text: e.target.value } as any)} />
          </div>
          <div>
            <Label>URL</Label>
            <Input value={block.href} onChange={e => onChange({ href: e.target.value } as any)} />
          </div>
          <ColorControl
            label="Background"
            value={block.backgroundColor}
            onChange={backgroundColor => onChange({ backgroundColor } as any)}
          />
          <ColorControl
            label="Text Color"
            value={block.textColor}
            onChange={textColor => onChange({ textColor } as any)}
          />
          <AlignControl value={block.align} onChange={align => onChange({ align } as any)} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.fullWidth}
              onChange={e => onChange({ fullWidth: e.target.checked } as any)}
            />
            Full width
          </label>
        </>
      )}

      {block.type === 'divider' && (
        <>
          <ColorControl label="Color" value={block.color} onChange={color => onChange({ color } as any)} />
          <div>
            <Label>Thickness (px)</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={block.thickness}
              onChange={e => onChange({ thickness: Number(e.target.value) || 1 } as any)}
            />
          </div>
        </>
      )}

      {block.type === 'spacer' && (
        <div>
          <Label>Height (px)</Label>
          <Input
            type="number"
            min={4}
            max={200}
            value={block.height}
            onChange={e => onChange({ height: Number(e.target.value) || 24 } as any)}
          />
        </div>
      )}

      {block.type === 'product' && (
        <>
          <div>
            <Label>Image URL</Label>
            <Input value={block.imageSrc} onChange={e => onChange({ imageSrc: e.target.value } as any)} />
          </div>
          <div>
            <Label>Title</Label>
            <Input value={block.title} onChange={e => onChange({ title: e.target.value } as any)} />
          </div>
          <div>
            <Label>Price</Label>
            <Input value={block.price} onChange={e => onChange({ price: e.target.value } as any)} />
          </div>
          <div>
            <Label>Button Text</Label>
            <Input
              value={block.buttonText}
              onChange={e => onChange({ buttonText: e.target.value } as any)}
            />
          </div>
          <div>
            <Label>Button URL</Label>
            <Input
              value={block.buttonHref}
              onChange={e => onChange({ buttonHref: e.target.value } as any)}
            />
          </div>
          <ColorControl
            label="Button Color"
            value={block.buttonColor}
            onChange={buttonColor => onChange({ buttonColor } as any)}
          />
        </>
      )}

      {block.type === 'social' && (
        <>
          <AlignControl value={block.align} onChange={align => onChange({ align } as any)} />
          <SocialInput
            label="Facebook URL"
            value={block.facebook ?? ''}
            onChange={facebook => onChange({ facebook } as any)}
          />
          <SocialInput
            label="Instagram URL"
            value={block.instagram ?? ''}
            onChange={instagram => onChange({ instagram } as any)}
          />
          <SocialInput
            label="X / Twitter URL"
            value={block.twitter ?? ''}
            onChange={twitter => onChange({ twitter } as any)}
          />
          <SocialInput
            label="YouTube URL"
            value={block.youtube ?? ''}
            onChange={youtube => onChange({ youtube } as any)}
          />
          <SocialInput
            label="LinkedIn URL"
            value={block.linkedin ?? ''}
            onChange={linkedin => onChange({ linkedin } as any)}
          />
        </>
      )}

      {block.type === 'footer' && (
        <>
          <div>
            <Label>Company Name</Label>
            <Input
              value={block.companyName}
              onChange={e => onChange({ companyName: e.target.value } as any)}
            />
          </div>
          <div>
            <Label>Address</Label>
            <Input
              value={block.address}
              onChange={e => onChange({ address: e.target.value } as any)}
            />
          </div>
          <div>
            <Label>Unsubscribe Text</Label>
            <Input
              value={block.unsubscribeText}
              onChange={e => onChange({ unsubscribeText: e.target.value } as any)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function AlignControl({
  value,
  onChange,
}: {
  value: TextAlign;
  onChange: (next: TextAlign) => void;
}) {
  return (
    <div>
      <Label>Alignment</Label>
      <div className="flex gap-1">
        {ALIGN_OPTIONS.map(a => (
          <button
            key={a}
            type="button"
            onClick={() => onChange(a)}
            className={cn(
              'flex-1 px-3 py-1.5 rounded border text-sm capitalize',
              value === a
                ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                : 'bg-white border-gray-200 text-gray-600',
            )}
          >
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={e => onChange(e.target.value)}
          className="h-9 w-12 rounded border border-gray-200 cursor-pointer"
        />
        <Input value={value} onChange={e => onChange(e.target.value)} className="flex-1" />
      </div>
    </div>
  );
}

function SocialInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="url"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="https://"
      />
    </div>
  );
}
