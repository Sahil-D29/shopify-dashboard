import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeJourneyNodes } from '../../journeys/layout';

test('arrange journey keeps execution identity and produces a readable vertical route', () => {
  const nodes = [
    { id: 'action', position: { x: 900, y: 10 } },
    { id: 'goal', position: { x: 50, y: 40 } },
    { id: 'trigger', position: { x: 400, y: 900 } },
    { id: 'delay', position: { x: 20, y: 500 } },
  ];
  const edges = [
    { source: 'trigger', target: 'delay' },
    { source: 'delay', target: 'action' },
    { source: 'action', target: 'goal' },
  ];
  const arranged = arrangeJourneyNodes(nodes, edges);
  const positions = Object.fromEntries(arranged.map(node => [node.id, node.position]));
  assert.deepEqual(arranged.map(node => node.id), nodes.map(node => node.id));
  assert.ok(positions.trigger.y < positions.delay.y);
  assert.ok(positions.delay.y < positions.action.y);
  assert.ok(positions.action.y < positions.goal.y);
  assert.deepEqual(edges, [
    { source: 'trigger', target: 'delay' },
    { source: 'delay', target: 'action' },
    { source: 'action', target: 'goal' },
  ]);
});

test('arrange journey lays branch siblings side by side at the same depth', () => {
  const arranged = arrangeJourneyNodes([
    { id: 'trigger', position: { x: 0, y: 0 } },
    { id: 'yes', position: { x: 0, y: 0 } },
    { id: 'no', position: { x: 0, y: 0 } },
  ], [
    { source: 'trigger', target: 'yes' },
    { source: 'trigger', target: 'no' },
  ]);
  const yes = arranged.find(node => node.id === 'yes')!;
  const no = arranged.find(node => node.id === 'no')!;
  assert.equal(yes.position.y, no.position.y);
  assert.notEqual(yes.position.x, no.position.x);
});
