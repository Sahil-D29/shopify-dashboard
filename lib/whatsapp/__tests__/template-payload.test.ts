import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTemplatePayload, resolveValues, type MetaTemplateDefinition } from '../template-payload';
import { SendValidationError, providerIssue } from '../issues';
import { nextDeliveryStatus } from '../delivery-status';
import { campaignTemplateInput } from '../campaign-config';
import { whatsappNodeConfig } from '../node-config';
import { legacyIssues, issueHref } from '../issue-records';
import { templateView } from '../template-view';

const definition = (components: MetaTemplateDefinition['components'], extra = {}): MetaTemplateDefinition => ({ id: '123', name: 'sahil_test', language: 'en_US', status: 'APPROVED', components, ...extra });
function rejects(fn: () => unknown, field: string) {
  assert.throws(fn, (error: unknown) => error instanceof SendValidationError && error.issues.some(item => item.field === field));
}

test('variable-free templates omit runtime components', () => {
  assert.deepEqual(buildTemplatePayload(definition([{ type: 'BODY', text: 'Hello!' }]), {}), { name: 'sahil_test', language: { code: 'en_US' } });
});
test('live Meta template details retain required header and dynamic button fields for the editor', () => {
  const view = templateView(definition([{ type: 'HEADER', format: 'TEXT', text: '{{name}}' }, { type: 'BODY', text: 'Hello' }, { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Shop Now', url: 'https://mymaatram.com/{{1}}' }] }]));
  assert.equal(view.id, 'meta_123');
  assert.equal(view.header?.content, '{{name}}');
  assert.equal(view.buttons?.[0].id, 'url_Shop Now');
  assert.equal(view.buttons?.[0].url, 'https://mymaatram.com/{{1}}');
});
test('positional variables use numeric order, deduplicate placeholders and ignore object insertion order', () => {
  const payload = buildTemplatePayload(definition([{ type: 'BODY', text: '{{2}} {{1}} {{2}} {{10}}' }]), { variables: { '10': 'ten', '2': 'two', '1': 'one' } });
  assert.deepEqual(payload.components?.[0].parameters.map((p: any) => p.text), ['one', 'two', 'ten']);
});
test('named parameters include parameter_name and preserve template order', () => {
  const payload = buildTemplatePayload(definition([{ type: 'BODY', text: '{{name}} {{order}}' }], { parameter_format: 'NAMED' }), { variables: { order: '42', name: 'Sahil' } });
  assert.deepEqual(payload.components?.[0].parameters, [{ type: 'text', text: 'Sahil', parameter_name: 'name' }, { type: 'text', text: '42', parameter_name: 'order' }]);
});
test('header and body variables with the same number can have distinct values', () => {
  const payload = buildTemplatePayload(definition([{ type: 'HEADER', format: 'TEXT', text: '{{1}}' }, { type: 'BODY', text: '{{1}}' }]), { variables: { 'header.1': 'Header', '1': 'Body' } });
  assert.equal(payload.components?.[0].parameters[0].text, 'Header');
  assert.equal(payload.components?.[1].parameters[0].text, 'Body');
});
for (const type of ['IMAGE', 'VIDEO', 'DOCUMENT']) test(`${type} headers require runtime media and accept matching media`, () => {
  const template = definition([{ type: 'HEADER', format: type }]);
  rejects(() => buildTemplatePayload(template, {}), 'mediaUrl');
  const payload = buildTemplatePayload(template, { mediaUrl: 'https://cdn.example.com/asset' });
  assert.deepEqual(payload.components?.[0].parameters, [{ type: type.toLowerCase(), [type.toLowerCase()]: { link: 'https://cdn.example.com/asset' } }]);
});
test('dynamic URL buttons retain original button index; static URLs send no parameter', () => {
  const template = definition([{ type: 'BUTTONS', buttons: [{ type: 'URL', url: 'https://example.com' }, { type: 'URL', text: 'Track', url: 'https://example.com/{{1}}' }] }]);
  rejects(() => buildTemplatePayload(template, {}), 'buttonActions.1');
  const payload = buildTemplatePayload(template, { buttonActions: { url_Track: 'https://example.com/order42' } });
  assert.deepEqual(payload.components, [{ type: 'button', sub_type: 'url', index: '1', parameters: [{ type: 'text', text: 'order42' }] }]);
  rejects(() => buildTemplatePayload(template, { buttonActions: { '1': '{{1}}' } }), 'buttonActions.1');
});
test('customer mappings use recipient values, camel/snake aliases, explicit static values and configured fallbacks', () => {
  assert.deepEqual(resolveValues({ variableMappings: [
    { variable: '{{1}}', dataSource: 'customer', property: 'firstName', fallbackValue: 'Guest' },
    { variable: '2', dataSource: 'order', property: 'number', fallbackValue: 'Not available' },
    { variable: '3', dataSource: 'static', fallbackValue: 'WELCOME' },
  ] }, { customer: { first_name: 'Sahil' } }), { '1': 'Sahil', '2': 'Not available', '3': 'WELCOME' });
});
test('preflight accepts configured recipient mappings but runtime fails for missing recipient data', () => {
  const template = definition([{ type: 'BODY', text: '{{1}}' }]);
  const input = { variableMappings: [{ variable: '1', dataSource: 'customer', property: 'firstName' }] };
  assert.doesNotThrow(() => buildTemplatePayload(template, input, {}, true));
  rejects(() => buildTemplatePayload(template, input), 'body.1');
});
test('dynamic media resolves only from actual product context', () => {
  const template = definition([{ type: 'HEADER', format: 'IMAGE' }]);
  assert.doesNotThrow(() => buildTemplatePayload(template, { useDynamicMedia: true }, {}, true));
  rejects(() => buildTemplatePayload(template, { useDynamicMedia: true }), 'mediaUrl');
  const payload = buildTemplatePayload(template, { useDynamicMedia: true }, { product: { image: { src: 'https://example.com/p.jpg' } } });
  assert.equal(payload.components?.[0].parameters[0].image.link, 'https://example.com/p.jpg');
});
test('non-approved and unsupported templates are rejected before sending', () => {
  rejects(() => buildTemplatePayload(definition([], { status: 'PENDING' }), {}), 'templateId');
  rejects(() => buildTemplatePayload(definition([{ type: 'HEADER', format: 'LOCATION' }]), {}), 'templateId');
});
test('campaign and nested journey configurations produce the same payload', () => {
  const config = { templateName: 'sahil_test', templateLanguage: 'en_US', variableMappings: [{ variable: '1', dataSource: 'customer', property: 'firstName' }], mediaUrl: 'https://example.com/image.jpg' };
  const template = definition([{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: '{{1}}' }]);
  const context = { customer: { first_name: 'Sahil' } };
  assert.deepEqual(buildTemplatePayload(template, campaignTemplateInput({ whatsappConfig: config }), context), buildTemplatePayload(template, whatsappNodeConfig({ data: { meta: { whatsappActionConfig: config } } }), context));
});
test('provider error preserves missing parameter detail and trace ID with useful customer action', () => {
  const result = providerIssue({ code: 131008, error_data: { details: 'header: image is required' }, fbtrace_id: 'trace123' });
  assert.equal(result.details, 'header: image is required');
  assert.equal(result.referenceId, 'trace123');
  assert.equal(result.customerFixable, true);
  assert.equal(providerIssue({ code: 131047 }).message, 'The customer service window is closed.');
  assert.equal(providerIssue({ code: 131026 }).message, 'WhatsApp could not deliver this message.');
  assert.equal(providerIssue({ message: 'private database stack' }).customerFixable, false);
});
test('duplicate and out-of-order delivery receipts do not regress status', () => {
  assert.equal(nextDeliveryStatus('SENT', 'delivered'), 'DELIVERED');
  assert.equal(nextDeliveryStatus('SENT', 'read'), 'READ');
  assert.equal(nextDeliveryStatus('DELIVERED', 'delivered'), null);
  assert.equal(nextDeliveryStatus('READ', 'delivered'), null);
  assert.equal(nextDeliveryStatus('DELIVERED', 'sent'), null);
  assert.equal(nextDeliveryStatus('SENT', 'failed'), 'FAILED');
  assert.equal(nextDeliveryStatus('FAILED', 'failed'), null);
});
test('legacy errors are described conservatively and fixes link to the affected resource', () => {
  assert.equal(legacyIssues('Unknown old error')[0].customerFixable, false);
  assert.equal(legacyIssues('(#131008) Required parameter is missing')[0].code, '131008');
  assert.equal(issueHref({ kind: 'campaign', resourceId: 'c1' }, providerIssue({ code: 132000 })), '/campaigns/c1/edit?step=3');
});
