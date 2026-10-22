import test from 'node:test';
import assert from 'node:assert/strict';
import { selectNutritionModel } from '../lib/chatgpt/modelSelection.mjs';
import { readChatGPTConnection } from '../lib/chatgpt/connectionOutcome.mjs';
const models = ['gpt-6-astra','gpt-6.1-sol','gpt-5.6-terra','gpt-6-luna'].map(slug=>({slug}));

test('available user choice wins, even over a lighter model',()=>{
  assert.equal(selectNutritionModel(models,'gpt-6-astra'),'gpt-6-astra');
});
test('missing or unset choice falls back to Luna regardless of catalog order',()=>{
  assert.equal(selectNutritionModel(models,'retired'),'gpt-6-luna');
  assert.equal(selectNutritionModel(models,null),'gpt-6-luna');
});
test('degrades through known lightweight families when Luna is absent',()=>{
  assert.equal(selectNutritionModel(models.slice(0,3)),'gpt-5.6-terra');
  assert.equal(selectNutritionModel(models.slice(0,2)),'gpt-6.1-sol');
  assert.equal(selectNutritionModel(models.slice(0,1)),'gpt-6-astra');
});
test('future versions and snapshot suffixes do not need exact-ID updates',()=>{
  assert.equal(selectNutritionModel([{slug:'gpt-9.2-sol'},{slug:'gpt-9-luna-2028-01-01'}]),'gpt-9-luna-2028-01-01');
});
test('display family survives an opaque ID rename; a recognized ID remains authoritative',()=>{
  assert.equal(selectNutritionModel([{slug:'gpt-6-sol'},{slug:'model-123',display_name:'GPT 7 Luna'}]),'model-123');
  assert.equal(selectNutritionModel([{slug:'gpt-6-astra',display_name:'Luna'},{slug:'gpt-6-sol'}]),'gpt-6-sol');
});
test('unknown names and equal-rank models retain catalog order without mutating it',()=>{
  const catalog=Object.freeze([Object.freeze({slug:'opaque-a'}),Object.freeze({slug:'opaque-b'})]);
  assert.equal(selectNutritionModel(catalog),'opaque-a');
  assert.equal(selectNutritionModel([{slug:'gpt-7-luna'},{slug:'gpt-6-luna'}]),'gpt-7-luna');
  assert.equal(selectNutritionModel([{slug:'lunatic'},{slug:'gpt-6-sol'}]),'gpt-6-sol');
});
test('empty or invalid catalog provides no model to invoke',()=>{
  assert.equal(selectNutritionModel([]),undefined);
  assert.equal(selectNutritionModel([null,{slug:''},{}]),undefined);
});
test('Settings shows the same lightweight fallback without overwriting user preference',async()=>{
  const result=await readChatGPTConnection({connected:async()=>true,models:async()=>models,
    getSelectedModel:async()=>'retired',setSelectedModel:async()=>assert.fail('must not write preference')});
  assert.equal(result.selected,'gpt-6-luna');
  assert.equal(result.choices,models);
});
