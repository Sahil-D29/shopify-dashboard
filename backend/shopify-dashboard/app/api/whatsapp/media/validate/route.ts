import { NextRequest, NextResponse } from 'next/server';

export interface MediaValidationRequest {
  url: string;
  expectedType?: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
}

export interface MediaValidationResponse {
  valid: boolean;
  reachable: boolean;
  contentType?: string;
  contentLength?: number;
  error?: string;
  warning?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MediaValidationRequest;
    const { url, expectedType } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { valid: false, reachable: false, error: 'URL is required.' },
        { status: 400 },
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { valid: false, reachable: false, error: 'Invalid URL format.' },
        { status: 400 },
      );
    }

    // Enforce HTTPS for production
    if (parsedUrl.protocol !== 'https:') {
      return NextResponse.json({
        valid: false,
        reachable: false,
        error: 'Media URLs must use HTTPS protocol.',
      });
    }

    // Perform HEAD request to validate reachability and content type
    try {
      const headResponse = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'WhatsApp-Template-Validator/1.0',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!headResponse.ok) {
        return NextResponse.json({
          valid: false,
          reachable: false,
          error: `Media URL returned status ${headResponse.status}.`,
        });
      }

      const contentType = headResponse.headers.get('content-type') || '';
      const contentLength = headResponse.headers.get('content-length');

      // Validate content type if expected type is provided
      let typeValid = true;
      let warning: string | undefined;

      if (expectedType) {
        const typeMap: Record<string, string[]> = {
          IMAGE: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
          VIDEO: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
          DOCUMENT: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
          ],
        };

        const allowedTypes = typeMap[expectedType] || [];
        typeValid = allowedTypes.some(type => contentType.toLowerCase().includes(type.toLowerCase()));

        if (!typeValid) {
          warning = `Content type "${contentType}" may not match expected type "${expectedType}".`;
        }
      }

      return NextResponse.json({
        valid: typeValid,
        reachable: true,
        contentType,
        contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
        warning,
      });
    } catch (fetchError) {
      return NextResponse.json({
        valid: false,
        reachable: false,
        error:
          fetchError instanceof Error
            ? `Failed to reach media URL: ${fetchError.message}`
            : 'Failed to reach media URL.',
      });
    }
  } catch (error) {
    console.error('[media/validate]', error);
    return NextResponse.json(
      {
        valid: false,
        reachable: false,
        error: error instanceof Error ? error.message : 'Media validation failed.',
      },
      { status: 500 },
    );
  }
}

