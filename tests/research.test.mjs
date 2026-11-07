import test from 'node:test';
import assert from 'node:assert/strict';
import { scoringWeights, weightedScore, safeSourceUrl, groundedClassifications, eligibleEvidence, errorCode } from '../lib/research-core.ts';
import { projectSchema, emptyBrief } from '../lib/workspace-schema.ts';
import { reportEvidenceCount, reportShortlist } from '../lib/report-presentation.ts';

test('report source counts deduplicate pages across opportunities without inflating endorsements', () => {
  assert.equal(reportEvidenceCount([
    { evidence: [{ url: 'https://buyers.org/page#one' }, { url: 'https://buyers.org/page#two' }] },
    { evidence: [{ url: 'https://buyers.org/page' }, { url: 'https://buyers.org/another' }, { url: 'invalid' }, { url: 'javascript:alert(1)' }] },
    {},
  ]), 2);
});

test('report sorting and saved filtering preserve original research and use unique page counts', () => {
  const opportunities = [
    { id: 'a', title: 'Alpha', score: 40, evidence: [{ url: 'https://a.org/1' }, { url: 'https://a.org/2' }] },
    { id: 'b', title: 'Beta', score: 68, evidence: [{ url: 'https://b.org/1' }, { url: 'https://b.org/1#repeat' }] },
    { id: 'c', title: 'Gamma', score: 66 },
  ];
  const original = structuredClone(opportunities);
  assert.deepEqual(reportShortlist(opportunities, [], false, 'score', 'en').map(o => o.id), ['b', 'c', 'a']);
  assert.deepEqual(reportShortlist(opportunities, [], false, 'evidence', 'en').map(o => o.id), ['a', 'b', 'c']);
  assert.deepEqual(reportShortlist(opportunities, [], false, 'title', 'en').map(o => o.id), ['a', 'b', 'c']);
  assert.deepEqual(reportShortlist(opportunities, ['c'], true, 'score', 'zh-Hant').map(o => o.id), ['c']);
  assert.deepEqual(reportShortlist(opportunities, [], true, 'score', 'en'), []);
  assert.deepEqual(opportunities, original);
});

const evidence = [
  { source_key:'c1-s1',candidate_id:'c1',url:'https://buyers.org/pain',excerpt:'Buyers report spending ten hours every week preparing proposals.' },
  { source_key:'c1-s2',candidate_id:'c1',url:'https://survey.org/analysis',excerpt:'Independent survey confirms proposal preparation delays sales.' },
];
const classes = evidence.map(e => ({source_key:e.source_key,relevant:true,kind:'pain',reliability:'primary',stance:'supports',quote:e.excerpt,claim:'Buyer workflow pain'}));
test('all three discovery modes validate and reject unknown modes',()=>{
  for(const discovery_mode of ['founder','market','combined']) assert.equal(projectSchema.parse({...emptyBrief,name:'Research',discovery_mode}).discovery_mode,discovery_mode);
  assert.equal(projectSchema.safeParse({...emptyBrief,name:'Research',discovery_mode:'admin'}).success,false);
});
test('weights sum to one and market scoring ignores founder advantage',()=>{
  for (const weights of Object.values(scoringWeights)) assert.ok(Math.abs(Object.values(weights).reduce((a,b)=>a+b,0)-1)<0.000001);
  const base={pain:40,demand:50,economics:60,feasibility:70,advantage:0};
  assert.equal(weightedScore(base,'market',3),weightedScore({...base,advantage:100},'market',3));
  assert.ok(weightedScore(base,'founder',3)<weightedScore({...base,advantage:100},'founder',3));
});
test('scores are bounded and review cannot raise a score',()=>{
  const all={pain:100,demand:100,economics:100,feasibility:100,advantage:100};
  assert.equal(weightedScore(all,'combined',2),70);
  assert.equal(weightedScore(all,'combined',4),85);
  assert.ok(weightedScore(all,'combined',4,30)<weightedScore(all,'combined',4));
});
test('citations must quote original excerpts and cannot invent source IDs',()=>{
  assert.equal(groundedClassifications(evidence,classes).length,2);
  assert.equal(groundedClassifications(evidence,[{...classes[0],quote:'Invented quote from nowhere'},{...classes[1],source_key:'unknown'}]).length,0);
  assert.equal(groundedClassifications(evidence,[classes[0],classes[0]]).length,1);
});
test('inclusion requires two independent domains and non-vendor demand evidence',()=>{
  assert.equal(eligibleEvidence('c1',evidence,classes).length,2);
  assert.equal(eligibleEvidence('c1',evidence.slice(0,1),classes).length,0);
  assert.equal(eligibleEvidence('c1',evidence,classes.map(c=>({...c,reliability:'vendor'}))).length,0);
  assert.equal(eligibleEvidence('c1',evidence,classes.map(c=>({...c,stance:'contradicts'}))).length,0);
  assert.equal(eligibleEvidence('c2',evidence,classes).length,0);
  assert.equal(eligibleEvidence('c1',[evidence[0],{...evidence[1],url:'https://www.buyers.org/another'}],classes).length,0);
});
test('subdomains and trailing dots do not create independent sources',()=>{
  for (const urls of [
    ['https://news.buyers.org/pain','https://research.buyers.org/report'],
    ['https://buyers.org/pain','https://buyers.org./report'],
    ['https://news.buyers.co.uk/pain','https://research.buyers.co.uk/report'],
  ]) {
    assert.equal(eligibleEvidence('c1', evidence.map((item,i)=>({...item,url:urls[i]})), classes).length, 0);
  }
  const independent = evidence.map((item,i)=>({...item,url:i ? 'https://survey.co.uk/report' : 'https://buyers.co.uk/pain'}));
  assert.equal(eligibleEvidence('c1', independent, classes).length, 2);
});
test('public suffix rules distinguish independently hosted publications',()=>{
  const hosted = evidence.map((item,i)=>({...item,url:i ? 'https://survey.github.io/report' : 'https://buyers.github.io/pain'}));
  assert.equal(eligibleEvidence('c1',hosted,classes).length,2);
  const samePublisher = hosted.map((item,i)=>({...item,url:i ? 'https://news.buyers.github.io/report' : 'https://buyers.github.io/pain'}));
  assert.equal(eligibleEvidence('c1',samePublisher,classes).length,0);
});
test('duplicate page fragments do not inflate the evidence count',()=>{
  const duplicate = {...evidence[0],source_key:'c1-s3',url:evidence[0].url+'#summary'};
  const classification = {...classes[0],source_key:duplicate.source_key};
  assert.equal(eligibleEvidence('c1',[...evidence,duplicate],[...classes,classification]).length,2);
});
test('inclusion independently rechecks quoted evidence and source URLs',()=>{
  assert.equal(eligibleEvidence('c1',evidence,classes.map(c=>({...c,quote:'A fabricated quotation that is not in either source.'}))).length,0);
  assert.equal(eligibleEvidence('c1',[evidence[0],{...evidence[1],url:'not a URL'}],classes).length,0);
  assert.equal(eligibleEvidence('c1',[evidence[0],{...evidence[1],url:'http://127.0.0.1/report'}],classes).length,0);
});
test('invalid duplicate classifications do not hide a later grounded quote',()=>{
  const output = groundedClassifications(evidence,[{...classes[0],quote:'An invented quotation from nowhere.'},classes[0],classes[1]]);
  assert.deepEqual(output,classes);
});
test('source URLs reject executable protocols, credentials and local addresses',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,a','http://localhost/x','http://127.0.0.1/x','http://[::1]/','https://user:pass@buyers.org/','https://foo.local']) assert.equal(safeSourceUrl(url),null);
  assert.equal(safeSourceUrl('https://buyers.org/report#part'),'https://buyers.org/report');
});
test('Gateway credit restrictions remain actionable across workflow serialization',()=>{
  const message = 'Free tier users do not have access to this model. Upgrade to paid credits.';
  const restricted = Object.assign(new Error(message), {statusCode:403});
  assert.equal(errorCode(restricted),'PROVIDER_CREDITS_REQUIRED');
  assert.equal(errorCode({message,statusCode:403}),'PROVIDER_CREDITS_REQUIRED');
  assert.equal(errorCode(new Error('Gateway failed',{cause:restricted})),'PROVIDER_CREDITS_REQUIRED');
  const normalized = new Error(errorCode(restricted));
  assert.equal(errorCode(JSON.parse(JSON.stringify({message:normalized.message}))),'PROVIDER_CREDITS_REQUIRED');
  assert.equal(errorCode(new Error('Gateway wrapper',{cause:{statusCode:503}})),'TRANSIENT_PROVIDER');
  assert.equal(errorCode({message:'Unauthorized',statusCode:401}),'PROVIDER_CONFIGURATION');
  const cyclic = {message:'Invalid JSON'}; cyclic.cause=cyclic;
  assert.equal(errorCode(cyclic),'INVALID_OUTPUT');
});
test('failures expose stable codes rather than provider details',()=>{
  assert.equal(errorCode(new Error('BUDGET_EXCEEDED')),'BUDGET_EXCEEDED');
  assert.equal(errorCode({statusCode:429}),'TRANSIENT_PROVIDER');
  assert.equal(errorCode(new Error('fetch failed')),'TRANSIENT_PROVIDER');
  assert.equal(errorCode({statusCode:401}),'PROVIDER_CONFIGURATION');
});

import { researchPolicy, reportLanguage, reportNarrative, confidenceLevel, LEGACY_REPORT_LANGUAGE } from '../lib/research-core.ts';
import { researchRequestSchema } from '../lib/workspace-schema.ts';
test('report language follows the request and falls back to the legacy language for old runs', () => {
  assert.equal(reportLanguage('en'), 'en');
  assert.equal(reportLanguage('zh-Hant'), 'zh-Hant');
  assert.equal(reportLanguage(undefined), LEGACY_REPORT_LANGUAGE);
  assert.equal(reportLanguage('fr'), LEGACY_REPORT_LANGUAGE);
  assert.equal(researchRequestSchema.parse({ ...emptyBrief, name: 'Research', language: 'en' }).language, 'en');
  assert.equal(researchRequestSchema.safeParse({ ...emptyBrief, name: 'Research', language: 'de' }).success, false);
});
test('the research policy names the output language and keeps quotes verbatim', () => {
  for (const [language, name] of [['en', 'English'], ['zh-Hans', '简体中文'], ['zh-Hant', '繁體中文']]) {
    const policy = researchPolicy(language);
    assert.ok(policy.includes(name), `${language} policy must name the language`);
    assert.match(policy, /verbatim/);
    assert.match(policy, /untrusted data/);
  }
});
test('report narratives are localized, count correctly, and flag short lists', () => {
  const full = reportNarrative('en', { candidates: 8, evidence: 20, opportunities: 6 });
  assert.match(full.summary, /8 candidates/);
  assert.match(full.summary, /6 opportunities/);
  assert.doesNotMatch(full.summary, /not padded/);
  assert.equal(full.limitations.length, 4);
  const short = reportNarrative('en', { candidates: 8, evidence: 9, opportunities: 1 });
  assert.match(short.summary, /1 opportunity /);
  assert.match(short.summary, /not padded/);
  assert.match(reportNarrative('zh-Hans', { candidates: 8, evidence: 9, opportunities: 2 }).summary, /没有凑数/);
  assert.match(reportNarrative('zh-Hant', { candidates: 8, evidence: 9, opportunities: 2 }).summary, /沒有湊數/);
  assert.equal(confidenceLevel(2), 'limited');
  assert.equal(confidenceLevel(3), 'moderate');
});

test('quotes are matched despite typographic changes and still returned verbatim from the source', async () => {
  const { locateQuote } = await import('../lib/research-core.ts');
  // Production run 31df1534, Family Wealth Report: the model appended "..." to an otherwise exact quote.
  const wealth = 'to cope. "Typical" fund managers incur $6 million of "avoidable" costs in onboarding customers, a study says. The figures come from a survey published yesterday by TABB Group, that was commissioned by Clarient Global, which is a joint venture';
  assert.equal(locateQuote(wealth, '"Typical" fund managers incur $6 million of "avoidable" costs in onboarding customers, a study says. The figures come from a survey published yesterday by TABB Group, that was commissioned by Clarient Global...'),
    '"Typical" fund managers incur $6 million of "avoidable" costs in onboarding customers, a study says. The figures come from a survey published yesterday by TABB Group, that was commissioned by Clarient Global');
  // Curly and straight quotes, dashes and whitespace may differ; the returned text is the source's own characters.
  const hr = 'HR as the “traffic controller.” “Being a ‘traffic controller’ means HR has quietly become the team responsible for moving all processes along,” she says. This is most noticeable—every week.';
  assert.equal(locateQuote(hr, `"Being a 'traffic controller' means HR has quietly   become the team responsible`), '“Being a ‘traffic controller’ means HR has quietly become the team responsible');
  assert.equal(locateQuote(hr, 'This is most noticeable - every week.'), null, 'a dash replaced by spaced hyphen changes the text');
  assert.equal(locateQuote(hr, 'This is most noticeable-every week.'), 'This is most noticeable—every week.');
  // An elided middle grounds on the longest verbatim fragment.
  assert.equal(locateQuote(hr, 'HR as the “traffic… has quietly become the team responsible for moving all processes along'), 'has quietly become the team responsible for moving all processes along');
  // Production run 31df1534, HRO Today: the model attached a clause that is not in the excerpt. Still rejected.
  assert.equal(locateQuote(hr, '“Being a ‘traffic controller’ means HR has quietly become the team responsible for moving all processes along,” she says—not by design, but by default.'), null);
  for (const invented of ['Invented quote from nowhere at all', 'too short', '...', '']) assert.equal(locateQuote(hr, invented), null);
});

test('grounded classifications store the verbatim source text, not the model copy', () => {
  const source = { source_key: 'c1-s1', candidate_id: 'c1', url: 'https://assoc.example.org/a', title: 'Survey', excerpt: 'Members said “intake paperwork takes nine hours a week” in the 2026 survey.', retrieved_at: '', published_at: null };
  const item = { source_key: 'c1-s1', relevant: true, kind: 'pain', reliability: 'secondary', stance: 'supports', quote: '"intake paperwork takes nine hours a week"...', claim: 'Real pain' };
  assert.deepEqual(groundedClassifications([source], [item]).map(c => c.quote), ['“intake paperwork takes nine hours a week”']);
});

test('the classifier is told that associations, trade press and news are independent, and who counts as a vendor', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../lib/research-engine.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /sells a product or service in this space/, 'the broad rule labelled a professional body, trade press and news as vendors');
  assert.match(source, /"secondary" = independent reporting or analysis \(news outlets, trade publications, professional bodies and industry associations/);
  assert.match(source, /"vendor" = a company marketing a product or service that solves this specific pain/);
});
