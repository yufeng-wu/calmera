import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { connectionIssue, openAIResponseError, savedChatGPTAccount, isAuthorizationCancelled } from '../lib/chatgpt/connectionStatus.mjs';

const apiError = (status, apiCode) => Object.assign(new Error(`openai_http_${status}`), { status, apiCode });

test('expired or revoked authorization requires sign-in, while temporary errors require only retry', () => {
  for (const code of ['invalid_grant', 'refresh_token_expired', 'refresh_token_reused', 'subscription_sharing_invalid_user']) {
    assert.equal(connectionIssue(apiError(400, code)).action, 'sign-in');
  }
  assert.equal(connectionIssue(apiError(401)).kind, 'sign-in');
  for (const error of [new TypeError('synthetic offline'), apiError(503), apiError(503, 'subscription_sharing_usage_unavailable')]) {
    const issue = connectionIssue(error);
    assert.equal(issue.action, 'retry');
    assert.equal(issue.kind, 'temporary');
  }
});

test('only an actual usage-limit code offers usage management; generic throttling does not claim an exhausted plan', () => {
  assert.equal(connectionIssue(apiError(429, 'subscription_sharing_usage_limit_exceeded')).action, 'usage');
  assert.equal(connectionIssue(apiError(429)).action, 'retry');
  assert.equal(connectionIssue(apiError(429)).kind, 'temporary');
});

test('policy and integration restrictions do not advertise a meaningless retry or reauthorization', () => {
  for (const error of [apiError(403, 'subscription_sharing_user_not_eligible'), apiError(400, 'invalid_client'), apiError(400)]) {
    const issue = connectionIssue(error);
    assert.equal(issue.action, null);
    assert.notEqual(issue.kind, 'sign-in');
  }
  assert.equal(connectionIssue(new Error('plan_permission_required')).action, 'sign-in');
});

test('provider diagnostics retain safe status and code without passing raw messages or credentials to the UI', async () => {
  const error = await openAIResponseError(Response.json({ error: { code: 'invalid_grant', message: 'synthetic-private-response' }, access_token: 'synthetic-private-token' }, { status: 400 }));
  assert.equal(error.status, 400);
  assert.equal(error.apiCode, 'invalid_grant');
  assert.equal(connectionIssue(error).kind, 'sign-in');
  assert.doesNotMatch(error.message + JSON.stringify(error) + JSON.stringify(connectionIssue(error)), /synthetic-private/);
  const invalid = await openAIResponseError(Response.json({ error: { code: 'synthetic untrusted text' } }, { status: 503 }));
  assert.equal(invalid.apiCode, undefined);
  const empty = await openAIResponseError(new Response('', { status: 401 }));
  assert.equal(connectionIssue(empty).action, 'sign-in');
});

const claims = { iss: 'https://auth.openai.com', sub: 'synthetic-person', aud: 'oaiapp_synthetic', email: 'person@example.com' };
const record = (overrides = {}) => ({ client_id: claims.aud, identity: { iss: claims.iss, sub: claims.sub },
  id_token: `synthetic.${Buffer.from(JSON.stringify({ ...claims, ...overrides })).toString('base64url')}.synthetic` });

test('retained account display requires matching validated identity and client audience', () => {
  assert.equal(savedChatGPTAccount(record()).email, 'person@example.com');
  assert.equal(savedChatGPTAccount(record({ aud: ['another', claims.aud] })).email, 'person@example.com');
  for (const overrides of [{ sub: 'other-person' }, { iss: 'https://example.com' }, { aud: 'oaiapp_other' }, { email: 'not an email' }, { email: 'bad\n@example.com' }]) {
    assert.equal(savedChatGPTAccount(record(overrides)).email, null);
  }
  assert.equal(savedChatGPTAccount({ client_id: claims.aud, id_token: 'malformed' }).email, null);
  assert.equal(savedChatGPTAccount(null), null);
});

test('retained email display handles UTF-8 and expired tokens without using display decoding as authentication', () => {
  assert.equal(savedChatGPTAccount(record({ email: 'person+你好@example.com', exp: 1 })).email, 'person+你好@example.com');
  assert.equal(savedChatGPTAccount(record({ email: 'a'.repeat(321) + '@example.com' })).email, null);
});

test('a cancelled browser closes quietly, while real timeouts and failures remain visible', () => {
  assert.equal(isAuthorizationCancelled(new Error('authorization_cancelled')), true);
  assert.equal(isAuthorizationCancelled({ code: 'ERR_CANCELED' }), true);
  assert.equal(isAuthorizationCancelled(new Error('authorization_timeout')), false);
  assert.equal(isAuthorizationCancelled(apiError(503)), false);
});
