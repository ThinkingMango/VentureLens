import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { postJson, getJson, parseJsonObject, ApiNetworkError } from '../lib/api-client.ts';
import { normalizeEvaluation } from '../lib/research-core.ts';

const json = (status, body) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
// Safari reports a dropped connection as TypeError("Load failed"); Chrome as TypeError("Failed to fetch").
const dropped = () => { throw new TypeError('Load failed'); };

test('a dropped connection is re-sent with the same payload and returns the server answer', async () => {
  const bodies = [];
  let calls = 0;
  const fetcher = async (_url, init) => { bodies.push(init.body); if (++calls < 3) dropped(); return json(202, { id: 'run-1' }); };
  const result = await postJson('/api/research', { action: 'start', requestKey: 'k' }, { networkRetries: 2, fetcher });
  assert.deepEqual(result, { ok: true, status: 202, body: { id: 'run-1' } });
  assert.equal(calls, 3);
  assert.ok(bodies.every(body => body === bodies[0]), 'every attempt carries the same idempotency key');
});

test('non-idempotent requests are never re-sent, and the raw browser message is never surfaced', async () => {
  let calls = 0;
  await assert.rejects(postJson('/api/research', { action: 'retry' }, { fetcher: async () => { calls++; dropped(); } }), error => error instanceof ApiNetworkError && error.message === 'NETWORK_ERROR');
  assert.equal(calls, 1);
  await assert.rejects(getJson('/api/research/x', { fetcher: async () => dropped() }), ApiNetworkError);
});

test('HTML, empty and non-object responses parse to an empty body instead of throwing', async () => {
  const gateway = await postJson('/api/research', {}, { fetcher: async () => json(504, '<html>Gateway Timeout</html>') });
  assert.deepEqual(gateway, { ok: false, status: 504, body: {} });
  for (const text of ['', 'null', '[1]', '"x"', '{bad']) assert.deepEqual(parseJsonObject(text), {});
  assert.deepEqual(parseJsonObject('{"code":"RUN_ALREADY_ACTIVE"}'), { code: 'RUN_ALREADY_ACTIVE' });
});

test('the research form, run page and workspace saves use the resilient client, not raw fetch', () => {
  for (const file of ['../components/research-config.tsx', '../components/research-run.tsx', '../components/demo-provider.tsx']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /await fetch\(|response\.json\(\)/, file);
  }
});

test('market mode forces advantage to zero; other modes keep the scored value', () => {
  const item = { candidate_id: 'c1', description: 'd', category: 'Services', revenue: 'Unverified', cost: 'Unverified', risk: 'r', assumptions: ['a'], validation: ['v'], dimensions: { pain: 70, demand: 60, economics: 50, feasibility: 60, advantage: 55 }, rationale: 'r' };
  assert.equal(normalizeEvaluation({ items: [item] }, ['c1'], 'market').items[0].dimensions.advantage, 0);
  for (const mode of ['combined', 'founder', undefined]) assert.equal(normalizeEvaluation({ items: [item] }, ['c1'], mode).items[0].dimensions.advantage, 55);
});

test('the evaluation prompt asks for a zero advantage only in market mode', () => {
  const source = readFileSync(new URL('../lib/research-engine.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /In market mode advantage=0\./, 'the unconditional instruction made Flash-Lite zero advantage in combined runs');
  assert.match(source, /mode === "market" \? "This is market mode: set advantage to 0\."/);
});

test('an edited brief never reuses the idempotency key of an earlier start', () => {
  const source = readFileSync(new URL('../components/research-config.tsx', import.meta.url), 'utf8');
  assert.match(source, /requestKey\.current\?\.payload !== payload/);
  assert.doesNotMatch(source, /requestKey\.current \?\?=/);
});

test('run polling stops on auth and missing-run answers and the error page refreshes server data', () => {
  const run = readFileSync(new URL('../components/research-run.tsx', import.meta.url), 'utf8');
  assert.match(run, /shouldRetryOnError: retryStatus/);
  assert.match(run, /\[401, 403, 404\]/);
  assert.match(run, /login\?next=/);
  const errorPage = readFileSync(new URL('../app/error.tsx', import.meta.url), 'utf8');
  assert.match(errorPage, /onClick=\{retry \?\? reset\}/);
});
