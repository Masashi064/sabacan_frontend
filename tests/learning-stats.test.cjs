/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test runner */
// Dependency-free hook harness: execute the actual provider against deferred
// Supabase responses and browser events, without writing to a real account.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');

function compile(file, imports, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: (name) => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  }, ...globals });
  return exports;
}
const utils = compile('src/lib/learning/stats.ts', {});
const tick = () => new Promise((resolve) => setImmediate(resolve));

function mount(userId = 'alice') {
  const slots = [];
  let cursor = 0;
  let first = true;
  const effects = [];
  const requests = [];
  const events = new Map();
  const timers = [];
  const broadcasts = [];
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useContext: () => null,
    useState: (initial) => {
      const i = cursor++;
      if (first) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (next) => { slots[i] = next; }];
    },
    useRef: (initial) => {
      const i = cursor++;
      if (first) slots[i] = { current: initial };
      return slots[i];
    },
    useMemo: (fn) => {
      const i = cursor++;
      if (first) slots[i] = fn();
      return slots[i];
    },
    useCallback: (fn) => fn,
    useEffect: (fn) => { if (first) effects.push(fn); },
  };
  const target = {
    visibilityState: 'visible',
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: (name) => events.delete(name),
  };
  const supabase = { from: (view) => {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    const request = { view, resolve };
    requests.push(request);
    const query = {
      select: () => query,
      eq: (_, uid) => { request.userId = uid; return query; },
      order: () => promise,
      maybeSingle: () => promise,
    };
    return query;
  } };
  class Channel {
    constructor() { broadcasts.push(this); }
    postMessage(value) { this.sent = value; }
    close() { this.closed = true; }
  }
  const provider = compile('src/lib/learning/LearningStatsProvider.tsx', {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'next/navigation': { usePathname: () => '/quiz' },
    '@/lib/auth/AuthProvider': { useAuth: () => ({ user: userId ? { id: userId } : null }) },
    '@/lib/supabase/client': { supabaseBrowser: () => supabase },
    './stats': utils,
  }, {
    window: target, document: target, BroadcastChannel: Channel,
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
    clearTimeout: () => {},
  });
  const element = provider.LearningStatsProvider({ children: null });
  function render() {
    cursor = 0;
    const output = element.type(element.props);
    first = false;
    return output.props.value;
  }
  render();
  const rewards = [];
  render().subscribeToRewards((reward) => rewards.push(reward));
  const cleanups = effects.map((effect) => effect());
  function respond(count, streak, error = null, offset = requests.length - 2) {
    requests[offset].resolve({ data: [{ day: '2026-10-31', attempts_count: count }], error });
    requests[offset + 1].resolve({ data: { current_streak: streak, longest_streak: streak }, error });
  }
  return { render, requests, respond, events, timers, broadcasts, rewards, visibility: target,
    unmount: () => cleanups.forEach((cleanup) => cleanup?.()) };
}

test('Account semantics: latest ordered row, including genuine zero and no history', () => {
  assert.equal(utils.getTodayAttempts([]), 0);
  assert.equal(utils.getTodayAttempts([{ attempts_count: 9 }, { attempts_count: 0 }]), 0);
  assert.equal(utils.getTodayAttempts([{ attempts_count: 9 }, { attempts_count: 3 }]), 3);
});

test('initial loading, successful save refresh, shared values and reload', async () => {
  const app = mount();
  assert.equal(app.render().todayCount, null);
  assert.equal(app.render().currentStreak, null);
  assert.equal(app.requests.length, 2);
  app.respond(2, 4);
  await tick();
  assert.equal(app.render().todayCount, 2);
  assert.equal(app.render().currentStreak, 4);
  app.render().notifySaved('alice');
  assert.equal(app.requests.length, 4);
  assert.equal(app.render().todayCount, 2); // no optimistic increment
  app.respond(3, 5);
  await tick();
  assert.equal(app.render().todayCount, 3);
  assert.equal(app.render().currentStreak, 5);
  assert.equal(app.broadcasts[0].sent, 'alice');
  const reloaded = mount();
  reloaded.respond(3, 5);
  await tick();
  assert.equal(reloaded.render().todayCount, 3);
  app.unmount(); reloaded.unmount();
});

test('save during an in-flight fetch discards stale results and reads after commit', async () => {
  const app = mount();
  app.render().notifySaved('alice');
  app.respond(0, 0);
  await tick();
  assert.equal(app.requests.length, 4);
  assert.equal(app.render().todayCount, null);
  app.respond(1, 1);
  await tick();
  assert.equal(app.render().todayCount, 1);
  app.unmount();
});

test('focus/visibility requests are deduplicated; tab save and midnight refresh', async () => {
  const app = mount();
  app.events.get('focus')();
  app.events.get('visibilitychange')();
  assert.equal(app.requests.length, 2);
  app.respond(1, 1);
  await tick();
  app.broadcasts[0].onmessage({ data: 'bob' });
  assert.equal(app.requests.length, 2);
  app.broadcasts[0].onmessage({ data: 'alice' });
  app.respond(2, 1);
  await tick();
  assert.equal(app.render().todayCount, 2);
  app.timers[0].fn();
  app.respond(0, 1);
  await tick();
  assert.equal(app.render().todayCount, 0);
  app.unmount();
});

test('logout/account switch isolate pending responses and save notifications', async () => {
  const alice = mount();
  alice.unmount();
  const guest = mount(null);
  assert.equal(guest.requests.length, 0);
  assert.equal(guest.render().todayCount, null);
  const bob = mount('bob');
  bob.render().notifySaved('alice');
  assert.equal(bob.requests.length, 2);
  alice.respond(99, 99);
  bob.respond(0, 0);
  await tick();
  assert.equal(bob.render().todayCount, 0);
  assert.equal(bob.requests[0].userId, 'bob');
  assert.equal(guest.render().todayCount, null);
  bob.unmount(); guest.unmount();
});

test('query failure is unknown, not zero; successful retry recovers', async () => {
  const app = mount();
  app.respond(0, 0, { message: 'network error' });
  await tick();
  assert.equal(app.render().todayCount, null);
  assert.equal(app.render().currentStreak, null);
  assert.equal(app.render().attemptsDaily.error, 'network error');
  const done = app.render().refresh();
  app.respond(0, 0);
  await done;
  assert.equal(app.render().todayCount, 0);
  app.unmount();
});

test('day refresh targets UTC and JST boundaries without changing aggregation', () => {
  assert.equal(utils.nextDayRefresh(new Date('2026-10-31T14:59:59Z')), 1100);
  assert.equal(utils.nextDayRefresh(new Date('2026-10-31T23:59:59Z')), 1100);
});

test('actual quiz persistence notifies only after successful insert; failed saves do not update stats', async () => {
  for (const fail of [true, false]) {
    const notifications = [];
    let committed = false;
    const effects = [];
    const supabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'alice' } } }) },
      from: (table) => {
        if (table === 'quiz_attempts') return {
          insert: async () => {
            committed = !fail;
            return { error: fail ? { message: 'write failed' } : null };
          },
        };
        assert.equal(table, 'learning_events');
        const query = {
          select: () => query, eq: () => query, order: () => query,
          limit: async () => ({ data: [], error: null }),
        };
        return query;
      },
      rpc: async () => ({ data: [], error: null }),
    };
    const quiz = compile('src/components/quiz/QuizSection.tsx', {
      react: {
        useMemo: (fn) => fn(),
        useState: (initial) => [typeof initial === 'object' ? { 0: 'A' } : initial, () => {}],
        useRef: (initial) => ({ current: initial }),
        useEffect: (fn) => effects.push(fn),
      },
      'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
      '@/components/ui/button': { Button: 'button' },
      '@/lib/supabase/client': { supabaseBrowser: () => supabase },
      '@/lib/learning/LearningStatsProvider': { useLearningStats: () => ({ notifySaved: (uid, eventId) => {
        assert.equal(committed, true);
        assert.equal(typeof eventId, "string");
        assert.ok(eventId.startsWith("test:"));
        notifications.push(uid);
      } }) },
      '@/lib/ga': { gaEvent: () => {} },
      '@/lib/achievements/AchievementProvider': { useAchievements: () => ({ notifyAchievements: () => {} }) },
    });
    quiz.QuizSection({ quiz: [{ question: 'Q', choices: ['A'], answer: 'A' }], slug: 'test', videoId: null });
    effects.forEach((effect) => effect());
    await tick();
    assert.deepEqual(notifications, fail ? [] : ['alice']);
  }
});

test('local quiz success rewards only increased fields, exactly once per completion', async () => {
  const app = mount();
  app.respond(1, 4);
  await tick();
  assert.equal(app.rewards.length, 0);
  app.render().notifySaved('alice', 'quiz-1');
  assert.equal(app.rewards.length, 0); // Wait for confirmed data, never delay that data for animation.
  app.respond(2, 4);
  await tick();
  assert.equal(app.render().todayCount, 2);
  assert.equal(app.rewards.length, 1);
  assert.equal(app.rewards[0].id, 'quiz-1');
  assert.equal(app.rewards[0].attempts, true);
  assert.equal(app.rewards[0].streak, false);
  const reads = app.requests.length;
  app.render().notifySaved('alice', 'quiz-1');
  assert.equal(app.requests.length, reads);
  assert.equal(app.rewards.length, 1);
  app.render().notifySaved('alice', 'quiz-2');
  app.respond(3, 5);
  await tick();
  assert.equal(app.rewards.length, 2);
  assert.equal(app.rewards[1].attempts, true);
  assert.equal(app.rewards[1].streak, true);
  app.unmount();
});

test('initial load, refetch, favorites, cross-tab changes and re-login never reward', async () => {
  const app = mount();
  app.respond(1, 1);
  await tick();
  let done = app.render().refresh();
  app.respond(2, 2);
  await done;
  app.render().notifySaved('alice');
  app.respond(3, 3);
  await tick();
  app.broadcasts[0].onmessage({ data: 'alice' });
  app.respond(4, 4);
  await tick();
  assert.equal(app.render().todayCount, 4);
  assert.equal(app.rewards.length, 0);
  app.unmount();
  const login = mount();
  login.respond(4, 4);
  await tick();
  assert.equal(login.rewards.length, 0);
  login.unmount();
});

test('unchanged, reduced, reset or unavailable stats do not earn a reward', async () => {
  const app = mount();
  app.render().notifySaved('alice', 'initially-unknown');
  app.respond(1, 1, null, 0);
  await tick();
  app.respond(1, 1);
  await tick();
  assert.equal(app.rewards.length, 0);
  for (const [event, count, streak] of [['unchanged', 1, 1], ['reduced', 0, 0], ['reset', 0, 0]]) {
    app.render().notifySaved('alice', event);
    app.respond(count, streak);
    await tick();
    assert.equal(app.rewards.length, 0);
  }
  app.unmount();
});

test('failed fetch consumes reward so a later ordinary refetch cannot replay it', async () => {
  const app = mount();
  app.respond(1, 1);
  await tick();
  app.render().notifySaved('alice', 'quiz-read-failed');
  app.respond(0, 0, { message: 'unavailable' });
  await tick();
  assert.equal(app.rewards.length, 0);
  const done = app.render().refresh();
  app.respond(2, 2);
  await done;
  assert.equal(app.rewards.length, 0);
  assert.equal(app.render().todayCount, 2);
  app.unmount();
});

test('save concurrent with an older request rewards once after the fresh response', async () => {
  const app = mount();
  app.respond(1, 1);
  await tick();
  void app.render().refresh();
  app.render().notifySaved('alice', 'quiz-in-flight');
  app.respond(1, 1);
  await tick();
  assert.equal(app.rewards.length, 0);
  app.respond(2, 2);
  await tick();
  assert.equal(app.rewards.length, 1);
  assert.equal(app.rewards[0].attempts, true);
  app.unmount();
});

test('a cross-tab update cancels ambiguous local reward attribution', async () => {
  const app = mount();
  app.respond(1, 1);
  await tick();
  app.render().notifySaved('alice', 'local-quiz');
  app.broadcasts[0].onmessage({ data: 'alice' });
  app.respond(2, 2);
  await tick();
  app.respond(3, 3);
  await tick();
  assert.equal(app.render().todayCount, 3);
  assert.equal(app.rewards.length, 0);
  app.unmount();
});


test('a completion resolved in a hidden tab is not replayed on return', async () => {
  const app = mount();
  app.respond(1, 1);
  await tick();
  app.visibility.visibilityState = 'hidden';
  app.render().notifySaved('alice', 'hidden-completion');
  app.respond(2, 2);
  await tick();
  assert.equal(app.render().todayCount, 2);
  assert.equal(app.rewards.length, 0);
  app.visibility.visibilityState = 'visible';
  app.events.get('visibilitychange')();
  app.respond(2, 2);
  await tick();
  assert.equal(app.rewards.length, 0);
  app.unmount();
});
