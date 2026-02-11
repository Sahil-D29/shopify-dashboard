import { NextRequest, NextResponse } from 'next/server';
import { getTemplates, setTemplates } from '@/lib/whatsapp/templates-store';
import type { WhatsAppTemplate } from '@/lib/types/whatsapp-config';

export async function POST(request: NextRequest) {
  try {
    // In a real implementation, this would call Meta's Graph API
    // For now, we'll simulate importing templates
    
    const existingTemplates = getTemplates();
    
    // Simulate importing from Meta
    // In production, this would:
    // 1. Call Meta Graph API: GET /{waba-id}/message_templates
    // 2. Parse response and map to our template format
    // 3. Merge with existing templates (update status, add new ones)
    
    const importedTemplates: WhatsAppTemplate[] = [
      // Example templates - in production these come from Meta API
      {
        id: 'template_1',
        name: 'Order Confirmation',
        status: 'APPROVED',
        category: 'TRANSACTIONAL',
        language: 'en',
        body: 'Hi {{1}}, your order {{2}} has been confirmed and will be delivered on {{3}}.',
        variables: ['{{1}}', '{{2}}', '{{3}}'],
        buttons: [
          { id: 'btn_1', type: 'quick_reply', text: 'Track Order' },
          { id: 'btn_2', type: 'url', text: 'View Order' },
        ],
        hasMediaHeader: false,
        hasButtons: true,
        content: 'Hi {{1}}, your order {{2}} has been confirmed and will be delivered on {{3}}.',
        updatedAt: new Date().toISOString(),
      },
    ];
    
    // Merge with existing templates
    const templateMap = new Map(existingTemplates.map(t => [t.id, t]));
    let imported = 0;
    let updated = 0;
    
    for (const template of importedTemplates) {
      const existing = templateMap.get(template.id);
      if (existing) {
        // Update existing template
        templateMap.set(template.id, {
          ...existing,
          ...template,
          updatedAt: new Date().toISOString(),
        });
        updated++;
      } else {
        // Add new template
        templateMap.set(template.id, template);
        imported++;
      }
    }
    
    const allTemplates = Array.from(templateMap.values());
    setTemplates(allTemplates);
    
    return NextResponse.json({
      success: true,
      imported,
      updated,
      failed: 0,
      total: allTemplates.length,
    });
  } catch (error) {
    console.error('[template-import]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import templates',
      },
      { status: 500 }
    );
  }
}

