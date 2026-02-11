import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Validate request body against schema
 */
export async function validateRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: NextResponse.json(
          {
            error: 'Validation failed',
            details: (error as any).errors?.map((e: any) => ({
              field: e.path?.join('.') || 'unknown',
              message: e.message || 'Validation error',
            })) || [],
          },
          { status: 400 }
        ),
      };
    }
    
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(
  query: Record<string, string | string[] | undefined>,
  schema: z.ZodSchema<T>
): { data: T; error: null } | { data: null; error: NextResponse } {
  try {
    const data = schema.parse(query);
    return { data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: NextResponse.json(
          {
            error: 'Invalid query parameters',
            details: (error as any).errors?.map((e: any) => ({
              field: e.path?.join('.') || 'unknown',
              message: e.message || 'Validation error',
            })) || [],
          },
          { status: 400 }
        ),
      };
    }
    
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      ),
    };
  }
}


