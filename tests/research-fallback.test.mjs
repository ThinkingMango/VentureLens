import test from 'node:test';
import assert from 'node:assert/strict';
import { withResearchFallback, requestWasRejected, parseGeminiSearch, geminiPricing, GEMINI_SEARCH_INPUT_ALLOWANCE, GEMINI_SEARCH_QUERY_ALLOWANCE } from '../lib/research-fallback-core.ts';
import { errorCode } from '../lib/research-core.ts';

const fail = code => async () => { throw new Error(code); };

test('Qwen success does not contact Gemini', async () => {
  let called = false;
  assert.equal(await withResearchFallback(async () => 'qwen', async () => { called = true; return 'gemini'; }, errorCode), 'qwen');
  assert.equal(called, false);
});

test('provider outages, configuration, credit and native search failures fall back once', async () => {
  for (const code of ['TRANSIENT_PROVIDER', 'PROVIDER_CONFIGURATION', 'PROVIDER_CREDITS_REQUIRED', 'RETRIEVAL_UNAVAILABLE']) {
    let attempts = 0;
    assert.equal(await withResearchFallback(fail(code), async () => { attempts++; return 'gemini'; }, errorCode), 'gemini');
    assert.equal(attempts, 1);
  }
});

test('validation, evidence, database and budget failures never trigger more spending', async () => {
  for (const code of ['INVALID_OUTPUT', 'INSUFFICIENT_EVIDENCE', 'WORKFLOW_INTERRUPTED', 'BUDGET_EXCEEDED']) {
    let attempts = 0;
    await assert.rejects(withResearchFallback(fail(code), async () => { attempts++; }, errorCode), new RegExp(code));
    assert.equal(attempts, 0);
  }
});

test('absent fallback preserves the original error and Gemini failure is not retried', async () => {
  const original = new Error('TRANSIENT_PROVIDER');
  await assert.rejects(withResearchFallback(async () => { throw original; }, undefined, errorCode), error => error === original);
  let attempts = 0;
  await assert.rejects(withResearchFallback(fail('TRANSIENT_PROVIDER'), async () => { attempts++; throw new Error('PROVIDER_CREDITS_REQUIRED'); }, errorCode), /PROVIDER_CREDITS_REQUIRED/);
  assert.equal(attempts, 1);
});

test('only explicit pre-generation rejections release an uncertain reservation', () => {
  for (const statusCode of [401, 402, 403, 404, 429]) assert.equal(requestWasRejected({ statusCode }), true);
  for (const error of [new Error('Timeout'), new Error('fetch failed'), { statusCode: 500 }, { statusCode: 503 }, new Error('INVALID_OUTPUT')]) assert.equal(requestWasRejected(error), false);
  assert.equal(requestWasRejected({ requestNotSent: true }), true);
  assert.equal(requestWasRejected({ cause: { statusCode: 429 } }), true);
  const cycle = {}; cycle.cause = cycle;
  assert.equal(requestWasRejected(cycle), false);
});

const grounded = {
  sources: [{ sourceType: 'url', url: 'https://buyers.org/report', title: 'Buyer survey' }],
  providerMetadata: { google: {
    groundingMetadata: { webSearchQueries: ['buyer pain', 'competing offers'] },
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, thoughtsTokenCount: 20, toolUsePromptTokenCount: 15 },
  } },
};

test('Gemini accepts only native grounded URLs and counts every search query and billable token', () => {
  const result = parseGeminiSearch(grounded);
  assert.equal(result.searchRequests, 2);
  assert.deepEqual(result.tokens, { inputTokens: 115, outputTokens: 70 });
  assert.equal(result.sources[0].url, 'https://buyers.org/report');
  assert.equal(result.sources[0].title, 'Buyer survey');
});

test('Gemini prose, missing search metadata and non-web sources are not evidence', () => {
  for (const value of [
    { text: 'https://invented.org' },
    { ...grounded, sources: [] },
    { ...grounded, sources: [{ sourceType: 'document', url: 'https://invented.org' }] },
    { ...grounded, providerMetadata: { google: { groundingMetadata: { webSearchQueries: [] } } } },
  ]) assert.throws(() => parseGeminiSearch(value), /RETRIEVAL_UNAVAILABLE/);
});

test('missing Gemini usage remains unknown rather than fabricating zero usage', () => {
  const value = structuredClone(grounded);
  delete value.providerMetadata.google.usageMetadata;
  assert.equal(parseGeminiSearch(value).tokens, undefined);
  value.providerMetadata.google.usageMetadata = { promptTokenCount: 10 };
  assert.equal(parseGeminiSearch(value).tokens, undefined);
});

test('Gemini search reservation includes context and multiple paid queries within the unchanged estimate cap', () => {
  const reserved = GEMINI_SEARCH_INPUT_ALLOWANCE * geminiPricing.input + 512 * geminiPricing.output + GEMINI_SEARCH_QUERY_ALLOWANCE * geminiPricing.search;
  assert.ok(reserved > 0.07 && reserved < 0.25);
  assert.equal(geminiPricing.search, 0.014);
});
