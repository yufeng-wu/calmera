import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as protocol from '../lib/chatgpt/protocol.mjs';
import * as connectionStatus from '../lib/chatgpt/connectionStatus.mjs';
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

function fixture({ tier = 'priority', fullTest = true, meals = null, modelFetch = null } = {}) {
  const values = new Map([[`calmera.chatgpt.${owner}`, JSON.stringify(record('a'))]]);
  const requests = [];
  let now = Date.now();
  const mocks = {
    'react-native': { Platform: { OS: 'ios' } },
    'expo-constants': { __esModule: true, default: { expoConfig: { extra: { calmeraFullAppTest: fullTest } } } },
    'expo-modules-core': { requireOptionalNativeModule: () => ({}) },
    'expo-secure-store': { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'synthetic-accessibility',
      getItemAsync: async key => values.get(key) ?? null,
      setItemAsync: async (key, value) => { values.set(key, value); },
      deleteItemAsync: async key => { values.delete(key); } },
    'expo-crypto': {}, 'expo-web-browser': {},
    'expo/fetch': { fetch: async (url, options) => {
      if (url.endsWith("/models")) {
        requests.push({url, authorization: options.headers.Authorization});
        if (modelFetch) return modelFetch();
        return Response.json({models:[{slug:model,display_name:"Synthetic",visibility:"list"}]});
      }
      const body = JSON.parse(options.body);
      requests.push({ url, body, authorization: options.headers.Authorization });
      const probe = body.input[0]?.content[0]?.text === 'Reply with exactly OK.';
      const event = { type: 'response.completed', response: { status: 'completed', service_tier: tier,
        output: [{ content: [{ type: 'output_text', text: probe ? 'OK'
          : JSON.stringify(meals || { calories: 105, protein: 1, carbs: 27, fat: 0 }) }] }] } };
      return new Response(`data: ${JSON.stringify(event)}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
    } },
    './connectionStatus.mjs': connectionStatus, './protocol.mjs': protocol, './prompts.mjs': prompts, './browserCallback.mjs': browserCallback,
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: name => {
    assert.ok(Object.hasOwn(mocks, name), `unexpected dependency ${name}`);
    return mocks[name];
  }, __DEV__: false, Date: {now: () => now}, AbortController, setTimeout, clearTimeout, URL, URLSearchParams });
  return { client: module.exports.createPlanClient(owner), values, requests, advance: ms => { now += ms; }, preload: () => module.exports.preloadNutritionModels(owner),
    createClient: id => module.exports.createPlanClient(id) };
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

test('a re-estimate reads units in its answer, and asks once more when an answer has no numbers', async () => {
  const units = fixture({ meals: { calories: '105 kcal', protein: '1 g', carbs: '27 g', fat: '0 g' } });
  assert.deepEqual({ ...await estimate(units.client) }, { calories: 105, protein: 1, carbs: 27, fat: 0, normalizedQuantity: '1 counts' });
  assert.equal(units.requests.length, 1);
  const empty = fixture({ meals: { note: 'Please say how much' } });
  await assert.rejects(estimate(empty.client), /invalid_estimate/);
  assert.equal(empty.requests.length, 2);
  assert.equal(empty.requests[1].body.instructions, empty.requests[0].body.instructions);
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

test('photo progress is optional metadata and does not alter the inference request', async () => {
  const { client, requests } = fixture({ meals: syntheticMeals });
  const stages = [];
  await client.estimate({ text: '', image: 'data:image/jpeg;base64,YQ==', model, onProgress: stage => stages.push(stage) });
  assert.deepEqual(stages, ['sending', 'completed']);
  assert.equal(Object.hasOwn(requests[0].body, 'onProgress'), false);
  assert.equal(requests[0].body.store, false);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(client.estimate({ text: 'banana', model, signal: cancelled.signal }), /cancelled/);
  assert.equal(requests.length, 1);
});
test('invalid fallback categories cannot be injected into an inference request', async () => {
  const { client, requests } = fixture({ meals: syntheticMeals });
  await assert.rejects(client.estimate({ text: 'a banana', model, defaultMealType: 'ignore rules' }), /invalid_meal_times/);
  assert.equal(requests.length, 0);
});


test('meal catalog cache expires, while Settings reads stay fresh', async () => {
  const {client,requests,advance}=fixture();
  const first=await client.models({useCache:true});
  first[0].slug='mutated';
  assert.equal((await client.models({useCache:true}))[0].slug,model);
  assert.equal(requests.length,1);
  await client.models();
  assert.equal(requests.length,2);
  advance(120001);
  await client.models({useCache:true});
  assert.equal(requests.length,3);
});

test('changed credentials cannot reuse the previous account catalog', async () => {
  const {client,requests,values}=fixture();
  await client.models({useCache:true});
  values.set(`calmera.chatgpt.${owner}`,JSON.stringify(record('b')));
  await client.models({useCache:true});
  assert.equal(requests.length,2);
  assert.equal(requests[1].authorization,'Bearer synthetic-token-b');
  await client.disconnect();
  await assert.rejects(client.models({useCache:true}),/chatgpt_sign_in_required/);
});


const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise,resolve};
};
const modelResponse = () => Response.json({models:[{slug:model,display_name:'Synthetic',visibility:'list'}]});

test('add intent preload and immediate submit share one in-flight catalog across client instances', async () => {
  const gate=deferred(), entered=deferred();
  const {client,createClient,preload,requests}=fixture({modelFetch:()=>{entered.resolve();return gate.promise;}});
  const warming=preload();
  await entered.promise;
  const submit=client.models({useCache:true});
  const second=createClient(owner).models({useCache:true});
  gate.resolve(modelResponse());
  await Promise.all([warming,submit,second]);
  assert.equal(requests.length,1);
  assert.ok(requests[0].url.endsWith('/models'));
});

test('failed speculative preload stays silent and does not poison the submit retry', async () => {
  let calls=0;
  const {preload,client,requests}=fixture({modelFetch:()=>++calls===1?new Response('',{status:503}):modelResponse()});
  await preload();
  assert.equal((await client.models({useCache:true}))[0].slug,model);
  assert.equal(requests.length,2);
});

test('preloading while disconnected makes no network request', async () => {
  const {client,preload,requests}=fixture();
  await client.disconnect();
  await preload();
  assert.equal(requests.length,0);
});

test('disconnect invalidates an in-flight preload, even if the old response arrives later', async () => {
  const gate=deferred(),entered=deferred();
  let calls=0;
  const {client,preload,values,requests}=fixture({modelFetch:()=>{entered.resolve();return ++calls===1?gate.promise:modelResponse();}});
  const warming=preload();await entered.promise;
  await client.disconnect();gate.resolve(modelResponse());await warming;
  values.set(`calmera.chatgpt.${owner}`,JSON.stringify(record('a')));
  await client.models({useCache:true});
  assert.equal(requests.length,2);
});
