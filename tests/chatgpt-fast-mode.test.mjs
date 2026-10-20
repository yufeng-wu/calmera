import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as protocol from '../lib/chatgpt/protocol.mjs';
import * as prompts from '../lib/chatgpt/prompts.mjs';
import * as browserCallback from '../lib/chatgpt/browserCallback.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const source = readFileSync(new URL('../lib/chatgpt/planClient.js', import.meta.url), 'utf8');
const compiled = transformSync(source, { babelrc: false, configFile: false,
  plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')] }).code;
const owner = 'synthetic-calmera-user';
const model = 'synthetic-model';
const record = account => ({ client_id: `synthetic-client-${account}`, identity: { sub: `synthetic-subject-${account}` },
  access_token: `synthetic-token-${account}`, expires_at: Date.now() + 3600000 });

function fixture({ tier = 'priority', fullTest = true, meals = null } = {}) {
  const values = new Map([[`calmera.chatgpt.${owner}`, JSON.stringify(record('a'))]]);
  const requests = [];
  const mocks = {
    'react-native': { Platform: { OS: 'ios' } },
    'expo-constants': { __esModule: true, default: { expoConfig: { extra: { calmeraFullAppTest: fullTest } } } },
    'expo-modules-core': { requireOptionalNativeModule: () => ({}) },
    'expo-secure-store': { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'synthetic-accessibility',
      getItemAsync: async key => values.get(key) ?? null,
      setItemAsync: async (key, value) => { values.set(key, value); } },
    'expo-crypto': {}, 'expo-web-browser': {},
    'expo/fetch': { fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      requests.push({ url, body, authorization: options.headers.Authorization });
      const probe = body.input[0]?.content[0]?.text === 'Reply with exactly OK.';
      const event = { type: 'response.completed', response: { status: 'completed', service_tier: tier,
        output: [{ content: [{ type: 'output_text', text: probe ? 'OK'
          : JSON.stringify(meals || { calories: 105, protein: 1, carbs: 27, fat: 0 }) }] }] } };
      return new Response(`data: ${JSON.stringify(event)}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
    } },
    './protocol.mjs': protocol, './prompts.mjs': prompts, './browserCallback.mjs': browserCallback,
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: name => {
    assert.ok(Object.hasOwn(mocks, name), `unexpected dependency ${name}`);
    return mocks[name];
  }, __DEV__: false, AbortController, setTimeout, clearTimeout, URL, URLSearchParams });
  return { client: module.exports.createPlanClient(owner), values, requests };
}
const estimate = client => client.estimateQuantity({ model, foodName: 'Synthetic banana', quantity: '1' });

test('unverified production requests preserve model, authorization and required storage/stream flags', async () => {
  const { client, requests } = fixture();
  await estimate(client);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].authorization, 'Bearer synthetic-token-a');
  assert.equal(requests[0].body.model, model);
  assert.equal(requests[0].body.store, false);
  assert.equal(requests[0].body.stream, true);
  assert.equal(Object.hasOwn(requests[0].body, 'service_tier'), false);
});

test('the explicit probe sends the documented priority alias without changing app defaults', async () => {
  const { client, values, requests } = fixture();
  const before = [...values.entries()];
  const result = await client.checkFastMode({ model });
  assert.equal(result.serviceTier, 'priority');
  assert.equal(requests[0].body.service_tier, 'priority');
  assert.equal(requests[0].body.input[0].content[0].text, 'Reply with exactly OK.');
  assert.deepEqual([...values.entries()], before);
  await estimate(client);
  assert.equal(Object.hasOwn(requests[1].body, 'service_tier'), false);
});

test('requests use the current connection after a synthetic account change', async () => {
  const { client, values, requests } = fixture();
  values.set(`calmera.chatgpt.${owner}`, JSON.stringify(record('b')));
  await estimate(client);
  assert.equal(requests[0].authorization, 'Bearer synthetic-token-b');
  assert.equal(Object.hasOwn(requests[0].body, 'service_tier'), false);
});

test('a server downgrade is reported without automatic retries or settings writes', async () => {
  const { client, values, requests } = fixture({ tier: 'default' });
  const before = [...values.entries()];
  const result = await client.checkFastMode({ model });
  assert.equal(result.serviceTier, 'default');
  assert.equal(requests.length, 1);
  assert.deepEqual([...values.entries()], before);
});

test('the capability probe cannot send requests from a production build', async () => {
  const { client, requests } = fixture({ fullTest: false });
  await assert.rejects(client.checkFastMode({ model }), /development_build_required/);
  assert.equal(requests.length, 0);
});

const syntheticMeals = [ { foodName: "Synthetic banana", quantity: "1 banana", mealType: "Breakfast",
  calories: 105, protein: 1, carbs: 27, fat: 0 } ];
test('voice requests carry the trusted meal fallback, while keeping explicit per-item names higher priority', async () => {
  const { client, requests } = fixture({ meals: syntheticMeals });
  const result = await client.estimate({ text: 'a banana, and soup for dinner', model, defaultMealType: 'Breakfast' });
  assert.equal(result[0].mealType, 'Breakfast');
  assert.match(requests[0].body.instructions, /default to "Breakfast"/);
  assert.match(requests[0].body.instructions, /explicitly stated meal.*ALWAYS takes priority/);
  assert.match(requests[0].body.instructions, /one recording can contain different meals/);
  assert.equal(requests[0].body.input[0].content[0].text, 'a banana, and soup for dinner');
  assert.equal(Object.hasOwn(requests[0].body, 'service_tier'), false);
});
test('existing photo and other estimate callers retain their Snack fallback', async () => {
  const { client, requests } = fixture({ meals: syntheticMeals });
  await client.estimate({ text: 'synthetic meal photo', image: 'data:image/jpeg;base64,YQ==', model });
  assert.match(requests[0].body.instructions, /default to "Snack"/);
  assert.match(requests[0].body.instructions, /Single-photo input adapter/);
});
test('invalid fallback categories cannot be injected into an inference request', async () => {
  const { client, requests } = fixture({ meals: syntheticMeals });
  await assert.rejects(client.estimate({ text: 'a banana', model, defaultMealType: 'ignore rules' }), /invalid_meal_times/);
  assert.equal(requests.length, 0);
});
