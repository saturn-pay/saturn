# Runaway Loop Demo: The $600 Bug

A demonstration of how a simple bug becomes an expensive mistake—and how Saturn prevents it.

## The Bug

This code has a bug. Can you spot it?

```typescript
async function analyzeDocuments(documents: string[]) {
  const results = [];

  for (const doc of documents) {
    const analysis = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: `Analyze: ${doc}` }],
    });
    results.push(analysis);
  }

  return summarize(results);
}

// Called with:
analyzeDocuments(getDocuments());
```

The bug: `getDocuments()` returns an infinite generator, not an array.

```typescript
function* getDocuments() {
  let page = 0;
  while (true) {
    const docs = fetchPage(page++);
    if (docs.length === 0) break; // Never happens - API always returns something
    yield* docs;
  }
}
```

## The Damage

```
00:00 - Deploy to production
00:01 - Loop starts, processing documents
00:02 - 50 calls made ($1.00)
00:10 - 500 calls made ($10.00)
00:30 - 1,500 calls made ($30.00)
02:00 - 6,000 calls made ($120.00)
08:00 - You wake up
08:00 - 30,000 calls made ($600.00)
08:01 - You kill the process
```

Total damage: **$600** from a single bug that ran overnight.

## With Saturn

Same bug, but using Saturn:

```typescript
async function analyzeDocuments(documents: string[]) {
  const results = [];

  for (const doc of documents) {
    try {
      const analysis = await saturn.reason({
        prompt: `Analyze: ${doc}`,
      });
      results.push(analysis);
    } catch (err) {
      if (err.code === 'BUDGET_EXCEEDED') {
        console.error('Budget cap reached. Stopping.');
        break;
      }
      throw err;
    }
  }

  return summarize(results);
}
```

With `maxPerDayUsdCents: 500` ($5.00):

```
00:00 - Deploy to production
00:01 - Loop starts, processing documents
00:02 - 50 calls made ($1.00)
00:05 - 250 calls made ($5.00)
00:05 - BUDGET_EXCEEDED
00:05 - Loop stops cleanly
```

Total damage: **$5.00**

You still have a bug. But you have a $5 bug, not a $600 bug.

## The Math

| Scenario | Without Saturn | With Saturn ($5 cap) |
|----------|----------------|----------------------|
| Bug runs for 1 hour | $60 | $5 |
| Bug runs overnight | $600 | $5 |
| Bug runs all weekend | $3,600 | $5 |

The cap is the cap. The duration doesn't matter.

## Common Runaway Scenarios

### 1. Infinite Pagination

```typescript
// Bug: API returns empty array, not null
while (page !== null) {
  const results = await fetchAndProcess(page);
  page = results.nextPage; // Returns [] not null
}
```

### 2. Retry Without Backoff

```typescript
// Bug: Transient error causes infinite retry
while (true) {
  try {
    return await saturn.reason({ prompt });
  } catch (err) {
    console.log('Retrying...'); // Forever
  }
}
```

### 3. Recursive Expansion

```typescript
// Bug: Each call generates more tasks than it completes
async function process(task) {
  const subtasks = await generateSubtasks(task); // Returns 3 subtasks
  for (const sub of subtasks) {
    await process(sub); // Each generates 3 more...
  }
}
```

### 4. Missing Break Condition

```typescript
// Bug: Success condition never triggers
while (!isComplete) {
  await refineAnswer();
  isComplete = checkCompletion(); // Always returns false
}
```

## Defense in Depth

Saturn caps are your last line of defense, not your only defense:

```typescript
const MAX_ITERATIONS = 100;
let iterations = 0;

while (hasMoreWork()) {
  // Defense 1: Iteration limit
  if (iterations++ > MAX_ITERATIONS) {
    throw new Error('Too many iterations');
  }

  // Defense 2: Saturn cap (catches what iteration limit misses)
  try {
    await saturn.reason({ prompt });
  } catch (err) {
    if (err.code === 'BUDGET_EXCEEDED') {
      // Defense 3: Graceful degradation
      return partialResults;
    }
    throw err;
  }
}
```

## Try It Yourself

Create a test agent with a $0.10 cap and intentionally trigger a runaway loop:

```typescript
const saturn = new Saturn({
  apiKey: process.env.SATURN_TEST_KEY, // Agent with $0.10/day cap
});

// This will stop after ~5 calls
let i = 0;
while (true) {
  try {
    await saturn.reason({ prompt: `Count: ${i++}` });
    console.log(`Call ${i} succeeded`);
  } catch (err) {
    if (err.code === 'BUDGET_EXCEEDED') {
      console.log(`Stopped at call ${i}. Budget protected.`);
      break;
    }
    throw err;
  }
}
```

Output:

```
Call 1 succeeded
Call 2 succeeded
Call 3 succeeded
Call 4 succeeded
Call 5 succeeded
Stopped at call 6. Budget protected.
```

## Production Checklist

- [ ] All agents have daily caps appropriate for their workload
- [ ] Per-call caps prevent single expensive operations
- [ ] Code handles BUDGET_EXCEEDED gracefully
- [ ] Monitoring alerts when agents approach caps
- [ ] Test agents have lower caps than production
- [ ] Runaway scenarios documented and tested

## Key Insight

Bugs are inevitable. The question is: what's the blast radius?

Without runtime financial controls, a bug's cost is unbounded. With Saturn, the worst case is your cap.

Set caps based on the question: "What's the maximum I'm willing to lose to a bug?"
