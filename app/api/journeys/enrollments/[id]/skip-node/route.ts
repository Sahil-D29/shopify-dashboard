export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { getJourneyById, appendJourneyActivity } from '@/lib/journey-engine/storage';
import { getEnrollment, moveToNextNode } from '@/lib/journey-engine/executor';
import { generateId } from '@/lib/journey-engine/utils';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await params;
    const enrollment = getEnrollment(resolved.id);
    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const journey = getJourneyById(enrollment.journeyId);
    if (!journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    const currentNodeId = enrollment.currentNodeId;
    const currentNode = currentNodeId
      ? journey.nodes.find(node => node.id === currentNodeId)
      : journey.nodes.find(node => node.type === 'trigger');

    if (!currentNode) {
      return NextResponse.json(
        { error: 'Unable to determine current node' },
        { status: 400 }
      );
    }

    appendJourneyActivity({
      id: generateId('log'),
      enrollmentId: enrollment.id,
      timestamp: new Date().toISOString(),
      eventType: 'node_skipped',
      data: {
        nodeId: currentNode.id,
        nodeType: currentNode.type,
      },
    });

    await moveToNextNode(journey, enrollment, currentNode);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) || 'Failed to skip node' }, { status: 500 });
  }
}

