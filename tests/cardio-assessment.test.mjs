import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const section = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
const source = section('const cardioVo2Norms =', 'const strengthNormDefinitions =')
  + section('function ageBand(', 'function percentileFromTable(')
  + section('function classifyCardioVo2(', 'function renderAssessment()');
const api = new Function('document', 'sexLabels', source + '; return { evaluateCardio, classifyCardioVo2, cardioVo2Norms, renderCardioAssessment };');
const { evaluateCardio, classifyCardioVo2, cardioVo2Norms } = api({}, {});

test('example and weight-dependent estimate', () => {
  const data = { age: 35, sex: 'male', weight: 70, minutes: 12 };
  const result = evaluateCardio(data);
  assert.ok(Math.abs(result.vo2 - 47.024) < 1e-9);
  assert.equal(result.vo2.toFixed(1), '47.0');
  assert.equal(result.level, '良好');
  assert.equal(result.band, '30-39');
  assert.ok(Math.abs(evaluateCardio({ ...data, weight: 60 }).vo2 - 48.68) < 1e-9);
  assert.equal(evaluateCardio({ ...data, weight: 50 }).level, '优秀');
  assert.equal(evaluateCardio({ ...data, weight: 90 }).level, '良好');
  assert.ok(Math.abs(evaluateCardio({ ...data, minutes: 12.5 }).vo2 - 45.644) < 1e-9);
});

test('all supplied demographic cutoffs and inclusive boundaries', () => {
  const expected = {
    male: [[35.2,46.5,54.5],[29.8,39.7,50],[26.7,35.3,45.2],[22.2,29.2,38.3],[18.5,24.6,32],[15.9,20.6,25.9]],
    female: [[27.2,36.6,44.8],[21.9,28.3,37],[19.7,25.7,33],[18.5,22.9,28.4],[15.4,19.6,24.3],[14,17.2,20.8]]
  };
  for (const sex of ['male', 'female']) {
    assert.deepEqual(Object.values(cardioVo2Norms[sex]), expected[sex]);
    for (const [band, cutoffs] of Object.entries(cardioVo2Norms[sex])) {
      for (const age of band.split('-').map(Number)) {
        assert.equal(evaluateCardio({ age, sex, weight: 60, minutes: 12 }).band, band);
      }
      cutoffs.forEach((cutoff, index) => {
        assert.equal(classifyCardioVo2(cutoff - 0.00001, cutoffs).index, index);
        assert.equal(classifyCardioVo2(cutoff, cutoffs).index, index + 1);
      });
    }
  }
});

test('invalid values do not receive a population rating', () => {
  const data = { age: 35, sex: 'female', weight: 70, minutes: 12 };
  for (const changes of [{ age: 0 },{ age: 19 },{ age: 80 },{ age: 35.5 },{ sex: '' },{ weight: 0 },{ weight: NaN },{ minutes: 0 },{ minutes: Infinity },{ minutes: 60 }]) {
    assert.ok(evaluateCardio({ ...data, ...changes }).error);
  }
});

test('result rendering uses entered data and remains unchanged until explicitly calculated', () => {
  const nodes = Object.fromEntries(['cardioSex','cardioAge','cardioWeight','runMinutes','cardioNorms','cardioVo2','cardioTitle','cardioText'].map(id => [id, { replaceChildren() { this.innerHTML = ''; } }]));
  Object.assign(nodes.cardioSex, { value: 'male' });
  Object.assign(nodes.cardioAge, { value: '35' });
  Object.assign(nodes.cardioWeight, { value: '70' });
  Object.assign(nodes.runMinutes, { value: '12' });
  const { renderCardioAssessment } = api({ querySelector: selector => nodes[selector.slice(1)] }, { male: '男', female: '女' });
  renderCardioAssessment();
  assert.equal(nodes.cardioTitle.textContent, '良好');
  assert.match(nodes.cardioVo2.textContent, /47\.0/);
  assert.match(nodes.cardioNorms.innerHTML, /class="is-current"><td>良好/);
  nodes.cardioWeight.value = '50';
  assert.equal(nodes.cardioTitle.textContent, '良好');
  renderCardioAssessment();
  assert.equal(nodes.cardioTitle.textContent, '优秀');
  nodes.cardioWeight.value = '';
  renderCardioAssessment();
  assert.equal(nodes.cardioTitle.textContent, '请检查输入');
  assert.equal(nodes.cardioNorms.hidden, true);
  assert.equal(nodes.cardioVo2.textContent, '');
});

test('page JavaScript parses and strength calculation is independent', () => {
  new Function(html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>')));
  const strength = section('function renderAssessment()', 'function getFitnessHistory()');
  assert.doesNotMatch(strength, /renderCardioAssessment|cardioTitle/);
});
