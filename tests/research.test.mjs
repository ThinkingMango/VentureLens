import test from 'node:test';
import assert from 'node:assert/strict';
import { scoringWeights, weightedScore, safeSourceUrl, groundedClassifications, eligibleEvidence, requireExactIds, errorCode } from '../lib/research-core.ts';
import { projectSchema, emptyBrief } from '../lib/workspace-schema.ts';
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
test('source URLs reject executable protocols, credentials and local addresses',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,a','http://localhost/x','http://127.0.0.1/x','http://[::1]/','https://user:pass@buyers.org/','https://foo.local']) assert.equal(safeSourceUrl(url),null);
  assert.equal(safeSourceUrl('https://buyers.org/report#part'),'https://buyers.org/report');
});
test('stage IDs reject omissions, additions and duplicate candidate outputs',()=>{
  assert.doesNotThrow(()=>requireExactIds(['c1','c2'],['c2','c1']));
  for(const ids of [['c1'],['c1','c1'],['c1','c3']]) assert.throws(()=>requireExactIds(['c1','c2'],ids));
});
test('failures expose stable codes rather than provider details',()=>{
  assert.equal(errorCode(new Error('BUDGET_EXCEEDED')),'BUDGET_EXCEEDED');
  assert.equal(errorCode({statusCode:429}),'TRANSIENT_PROVIDER');
  assert.equal(errorCode(new Error('fetch failed')),'TRANSIENT_PROVIDER');
  assert.equal(errorCode({statusCode:401}),'PROVIDER_CONFIGURATION');
});
