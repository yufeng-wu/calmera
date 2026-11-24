import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';
import vm from 'node:vm';
import * as protocol from '../src/lib/chatgpt/protocol.mjs';
import * as connectionStatus from '../src/lib/chatgpt/connectionStatus.mjs';
import * as mealEstimator from '../src/lib/ai/mealEstimator.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const compiled = transformSync(readFileSync(new URL('../src/lib/chatgpt/planClient.js', import.meta.url), 'utf8'), {
  babelrc: false, configFile: false, plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
}).code;
const owner = 'synthetic-account-switch-owner';
const key = `calmera.chatgpt.${owner}`;
const identity = name => ({ iss: protocol.ISSUER, sub: `synthetic-subject-${name}` });
const record = name => ({ client_id: `oaiapp_synthetic_${name}`, identity: identity(name),
  access_token: `synthetic-access-${name}`, refresh_token: `synthetic-refresh-${name}`, id_token: `synthetic-id-${name}`,
  expires_at: Date.now() + 3600000, scope: protocol.PLAN_SCOPE });

function fixture({ prior = record('old'), registration = prior?.client_id, cancel = false, exchangeError = false,
  invalidIdentity = false, planPermission = true, writeFailure = false, mirrorFailure = false,
  wrongCallbackState = false, returnedIdentity = 'new', modelError = null, revokeError = false, revokeEndpoint = 'https://auth.openai.com/synthetic-revoke' } = {}) {
  const values = new Map([['calmera.chatgpt.host', 'urn:uuid:synthetic-stable-host']]);
  if (prior) values.set(key, JSON.stringify(prior));
  if (registration) values.set(`${key}.registration`, registration);
  const authorizations = [], validations = [], requests = [];
  let failurePending = writeFailure;
  const native = {
    startCallback: async () => 'http://127.0.0.1:1455/auth/callback',
    cancelCallback: () => {},
    validateIdentity: async (token, clientId, nonce, expectedSubject) => {
      validations.push({ token, clientId, nonce, expectedSubject });
      if (invalidIdentity || (expectedSubject && expectedSubject !== identity(returnedIdentity).sub)) throw new Error('invalid_chatgpt_identity');
      return identity(returnedIdentity);
    },
  };
  const mocks = {
    'react-native': { Platform: { OS: 'ios' } },
    'expo-constants': { __esModule: true, default: { expoConfig: { extra: {} } } },
    '../../../modules/calmera-chatgpt': { requireCalmeraNativeModule: () => native },
    'expo-secure-store': { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'synthetic-device-only',
      getItemAsync: async name => values.get(name) ?? null,
      setItemAsync: async (name, value) => {
        if (name === key && failurePending) { failurePending = false; throw new Error('synthetic_keychain_failure'); }
        if (name === `${key}.registration` && mirrorFailure) throw new Error('synthetic_mirror_failure');
        values.set(name, value);
      },
      deleteItemAsync: async name => { values.delete(name); },
    },
    'expo-crypto': { getRandomBytes: size => randomBytes(size), randomUUID: () => 'synthetic-host',
      CryptoDigestAlgorithm: { SHA256: 'sha256' }, CryptoEncoding: { BASE64: 'base64' },
      digestStringAsync: async (_, text) => createHash('sha256').update(text).digest('base64') },
    'expo-web-browser': {},
    'expo/fetch': { fetch: async (url, options) => {
      requests.push({ url, options });
      if (url === `${protocol.ISSUER}/.well-known/openid-configuration`) return Response.json({ revocation_endpoint: revokeEndpoint });
      if (url === revokeEndpoint) return revokeError ? new Response('', { status: 503 }) : new Response('', { status: 200 });
      if (url.endsWith('/models') && modelError) return Response.json({ error: { code: modelError.code } }, { status: modelError.status });
      if (url.endsWith('/models')) return Response.json({ models: [{ slug: 'synthetic-new-model', visibility: 'list', display_name: 'Synthetic' }] });
      assert.equal(url, `${protocol.ISSUER}/api/accounts/oauth/token`);
      if (exchangeError) return new Response('', { status: 400 });
      return Response.json({ access_token: 'synthetic-access-new', refresh_token: 'synthetic-refresh-new', id_token: 'synthetic-id-new',
        scope: planPermission ? protocol.PLAN_SCOPE : 'openid', token_type: 'Bearer', expires_in: 3600 });
    } },
    './connectionStatus.mjs': connectionStatus, './protocol.mjs': protocol, '../ai/mealEstimator.mjs': mealEstimator,
    './browserCallback.mjs': { waitForBrowserCallback: async ({ url }) => {
      const auth = new URL(url); authorizations.push(auth);
      if (cancel) throw new Error('authorization_cancelled');
      const callback = new URL(auth.searchParams.get('redirect_uri'));
      callback.search = new URLSearchParams({ state: wrongCallbackState ? 'wrong-state' : auth.searchParams.get('state'),
        code: 'synthetic-code', client_id: auth.searchParams.get('client_id') === 'dynamic_agent_client'
          ? 'oaiapp_synthetic_new' : auth.searchParams.get('client_id') }).toString();
      return callback.toString();
    } },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, __DEV__: false,
    require: name => { assert.ok(Object.hasOwn(mocks, name), `unexpected dependency ${name}`); return mocks[name]; },
    URL, URLSearchParams, Date, AbortController, setTimeout, clearTimeout });
  return { client: module.exports.createPlanClient(owner), values, authorizations, validations, requests,
    active: () => JSON.parse(values.get(key)) };
}

test('changing ChatGPT account creates a new workspace registration and uses only its validated token set', async () => {
  const f = fixture();
  await f.client.models({ useCache: true });
  await f.client.connect({ newAccount: true });
  assert.equal(f.authorizations[0].searchParams.get('client_id'), 'dynamic_agent_client');
  assert.equal(f.authorizations[0].searchParams.get('agent_name_hint'), 'calmera.');
  assert.equal(f.authorizations[0].searchParams.get('ext_agent_host_id'), 'urn:uuid:synthetic-stable-host');
  assert.equal(f.authorizations[0].searchParams.has('id_token_hint'), false);
  assert.equal(f.validations[0].expectedSubject, '');
  assert.equal(f.validations[0].clientId, 'oaiapp_synthetic_new');
  assert.equal(f.validations[0].nonce, f.authorizations[0].searchParams.get('nonce'));
  assert.equal(f.active().identity.sub, identity('new').sub);
  assert.equal(f.active().client_id, 'oaiapp_synthetic_new');
  assert.equal(f.active().access_token, 'synthetic-access-new');
  assert.equal(f.active().refresh_token, 'synthetic-refresh-new');
  assert.equal(f.values.get(`${key}.registration`), 'oaiapp_synthetic_new');
  assert.equal(f.values.has(`${key}.pending-registration`), false);
  const exchange = f.requests.find(r => r.url.endsWith('/oauth/token'));
  assert.equal(new URLSearchParams(exchange.options.body).get('client_id'), 'oaiapp_synthetic_new');
  await f.client.models({ useCache: true });
  assert.deepEqual(f.requests.filter(r => r.url.endsWith('/models')).map(r => r.options.headers.Authorization),
    ['Bearer synthetic-access-old', 'Bearer synthetic-access-new']);
});

test('ordinary reconnect retains the original registration and rejects another account identity', async () => {
  const f = fixture();
  const before = f.values.get(key);
  await assert.rejects(f.client.connect(), /invalid_chatgpt_identity/);
  assert.equal(f.authorizations[0].searchParams.get('client_id'), 'oaiapp_synthetic_old');
  assert.equal(f.authorizations[0].searchParams.has('agent_name_hint'), false);
  assert.equal(f.validations[0].expectedSubject, identity('old').sub);
  assert.equal(f.values.get(key), before);
});

test('reconnecting the same account keeps its issued client and validates its original subject', async () => {
  const f = fixture({ returnedIdentity: 'old' });
  await f.client.connect();
  assert.equal(f.authorizations[0].searchParams.get('client_id'), 'oaiapp_synthetic_old');
  assert.equal(f.active().client_id, 'oaiapp_synthetic_old');
  assert.equal(f.validations[0].expectedSubject, identity('old').sub);
});

for (const [name, options, message] of [
  ['browser cancellation', { cancel: true }, /authorization_cancelled/],
  ['wrong callback state', { wrongCallbackState: true }, /invalid_oauth_state/],
  ['failed token exchange', { exchangeError: true }, /openai_http_400/],
  ['invalid signed identity', { invalidIdentity: true }, /invalid_chatgpt_identity/],
  ['missing ChatGPT plan permission', { planPermission: false }, /plan_permission_required/],
  ['credential storage failure', { writeFailure: true }, /synthetic_keychain_failure/],
]) {
  test(`a new-account ${name} preserves the previous connection and registration`, async () => {
    const f = fixture(options);
    const before = f.values.get(key);
    await assert.rejects(f.client.connect({ newAccount: true }), message);
    assert.equal(f.values.get(key), before);
    assert.equal(f.values.get(`${key}.registration`), 'oaiapp_synthetic_old');
    assert.equal(await f.client.connected(), true);
    await f.client.models();
    assert.equal(f.requests.at(-1).options.headers.Authorization, 'Bearer synthetic-access-old');
  });
}

test('the complete active record wins over stale legacy registration bookkeeping on the next reconnect', async () => {
  const f = fixture({ mirrorFailure: true });
  await f.client.connect({ newAccount: true });
  assert.equal(f.active().client_id, 'oaiapp_synthetic_new');
  await f.client.connect();
  assert.equal(f.authorizations[1].searchParams.get('client_id'), 'oaiapp_synthetic_new');
  assert.equal(f.validations[1].expectedSubject, identity('new').sub);
  assert.equal(f.active().client_id, 'oaiapp_synthetic_new');
});

test('first-time sign-in retains the issued ID if token exchange fails without inventing a connected session', async () => {
  const f = fixture({ prior: null, registration: null, exchangeError: true });
  await assert.rejects(f.client.connect(), /openai_http_400/);
  assert.equal(f.authorizations[0].searchParams.get('client_id'), 'dynamic_agent_client');
  assert.equal(f.values.get(`${key}.registration`), 'oaiapp_synthetic_new');
  assert.equal(await f.client.connected(), false);
});


test('the real model request preserves expired-session codes for contextual sign-in recovery', async () => {
  const f = fixture({ modelError: { code: 'invalid_grant', status: 400 } });
  await assert.rejects(f.client.models(), error => error.status === 400 && error.apiCode === 'invalid_grant');
  assert.equal(f.active().client_id, 'oaiapp_synthetic_old');
});

test('Automatic clears only an explicit model preference and keeps the current account', async () => {
  const f = fixture();
  const previous = f.values.get(key);
  await f.client.setSelectedModel('synthetic-new-model');
  assert.equal(await f.client.getSelectedModel(), 'synthetic-new-model');
  await f.client.setSelectedModel(null);
  assert.equal(await f.client.getSelectedModel(), null);
  assert.equal(f.values.get(key), previous);
});

test('Disconnect revokes the renewable session at the issuer before removing local credentials', async () => {
  const f = fixture();
  await f.client.disconnect();
  const revoke = f.requests.find(r => r.url.endsWith('/synthetic-revoke'));
  const body = new URLSearchParams(revoke.options.body);
  assert.equal(body.get('token'), 'synthetic-refresh-old');
  assert.equal(body.get('client_id'), 'oaiapp_synthetic_old');
  assert.equal(body.get('token_type_hint'), 'refresh_token');
  assert.equal(await f.client.connected(), false);
});

for (const options of [{ revokeError: true }, { revokeEndpoint: 'https://example.com/synthetic-revoke' }]) {
  test('a failed or untrusted revocation cannot silently erase the existing connection', async () => {
    const f = fixture(options);
    const previous = f.values.get(key);
    await assert.rejects(f.client.disconnect());
    assert.equal(f.values.get(key), previous);
    if (options.revokeEndpoint) assert.equal(f.requests.some(r => r.url.startsWith('https://example.com')), false);
  });
}
