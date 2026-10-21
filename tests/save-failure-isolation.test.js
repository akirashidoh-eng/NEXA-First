const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function createHarness(initialData, shouldSave) {
  const elements = {
    taskInput: { value: "" },
    taskSummary: { textContent: "" },
    taskList: { innerHTML: "" },
    state: { value: "" },
    next: { value: "" },
    updateCandidate: { hidden: false }
  };

  const messages = [];

  const data = {
    tasks: (initialData.tasks || []).map(t => ({ ...t })),
    state: initialData.state || "元の現在地",
    next: initialData.next || "元の次の一手"
  };
  // 画面の初期表示を、保存失敗前のデータと一致させる
  elements.state.value = data.state;
  elements.next.value = data.next;
  const sandbox = {
    data,
    stateCandidate: null,
    $: id => elements[id],
    esc: value => String(value ?? ""),
    now: () => "テスト時刻",
    addMsg: (...args) => messages.push(args),
    persist: () => shouldSave(),
    Date,
    Math
  };

  const appPath = path.join(__dirname, "..", "app.js");
  const app = fs.readFileSync(appPath, "utf8");
  const start = app.indexOf("function snapshotTaskState()");
  const end = app.indexOf("function confidence(", start);

  assert.notEqual(start, -1, "タスク管理関数の開始位置が見つからない");
  assert.notEqual(end, -1, "タスク管理関数の終了位置が見つからない");

  const taskFunctions = app.slice(start, end);

  vm.runInNewContext(
    taskFunctions +
      "\nthis.api = { addTask, toggleTask, deleteTask, renderTasks };",
    sandbox
  );

  return {
    api: sandbox.api,
    data,
    elements,
    messages
  };
}

function sampleTask() {
  return { id: 1, text: "テスト用タスク", done: false };
}

test("追加：保存失敗ならタスクと入力を維持する", () => {
  const h = createHarness({
    tasks: [sampleTask()],
    state: "元の現在地",
    next: "元の次の一手"
  }, () => false);

  h.elements.taskInput.value = "追加テスト";

  h.api.addTask();

  assert.equal(h.data.tasks.length, 1);
  assert.equal(h.data.tasks[0].text, "テスト用タスク");
  assert.equal(h.data.state, "元の現在地");
  assert.equal(h.data.next, "元の次の一手");
  assert.equal(h.elements.taskInput.value, "追加テスト");
  assert.match(h.elements.taskSummary.textContent, /全1件/);
});


test("完了切替：保存失敗ならデータとチェック表示を元に戻す", () => {
  const h = createHarness({
    tasks: [sampleTask()],
    state: "元の現在地",
    next: "元の次の一手"
  }, () => false);

  h.api.toggleTask(1);

  assert.equal(h.data.tasks[0].done, false);
  assert.equal(h.data.state, "元の現在地");
  assert.equal(h.data.next, "元の次の一手");
  assert.equal(h.elements.state.value, "元の現在地");
  assert.equal(h.elements.next.value, "元の次の一手");
  assert.match(h.elements.taskSummary.textContent, /未完了1件/);
  assert.match(h.elements.taskList.innerHTML, /テスト用タスク/);
  assert.doesNotMatch(
    h.elements.taskList.innerHTML,
    /type="checkbox"[^>]*checked/,
    "保存失敗後のチェックボックスは未完了表示に戻る"
  );
});


test("削除：保存失敗ならタスクを復元する", () => {
  const h = createHarness({
    tasks: [sampleTask()],
    state: "元の現在地",
    next: "元の次の一手"
  }, () => false);

  h.api.deleteTask(1);

  assert.equal(h.data.tasks.length, 1);
  assert.equal(h.data.tasks[0].text, "テスト用タスク");
  assert.equal(h.data.state, "元の現在地");
  assert.equal(h.data.next, "元の次の一手");
  assert.match(h.elements.taskList.innerHTML, /テスト用タスク/);
});

test("追加：保存成功ならタスクを追加して入力を消す", () => {
  const h = createHarness({ tasks: [] }, () => true);

  h.elements.taskInput.value = "追加成功テスト";

  h.api.addTask();

  assert.equal(h.data.tasks.length, 1);
  assert.equal(h.data.tasks[0].text, "追加成功テスト");
  assert.equal(h.elements.taskInput.value, "");
});

test("完了切替：保存成功なら完了状態にする", () => {
  const h = createHarness({ tasks: [sampleTask()] }, () => true);

  h.api.toggleTask(1);

  assert.equal(h.data.tasks[0].done, true);
  assert.match(h.data.state, /1件完了/);
});

test("削除：保存成功ならタスクを削除する", () => {
  const h = createHarness({ tasks: [sampleTask()] }, () => true);

  h.api.deleteTask(1);

  assert.equal(h.data.tasks.length, 0);
  assert.match(h.elements.taskSummary.textContent, /全0件/);
});
function createPersistHarness(shouldThrow) {
  const KEY = "nexa_first_state_v3";
  const data = {
    goal: "テスト目的",
    state: "元の現在地",
    next: "元の次の一手",
    tasks: []
  };
  const originalValue = "既存の保存データ";
  const stored = new Map([[KEY, originalValue]]);
  const alerts = [];

  const sandbox = {
    KEY,
    data,
    localStorage: {
      setItem(key, value) {
        if (shouldThrow) throw new Error("quota exceeded");
        stored.set(key, value);
      }
    },
    alert: message => alerts.push(message),
    console: { error() {} }
  };

  const appPath = path.join(__dirname, "..", "app.js");
  const app = fs.readFileSync(appPath, "utf8");
  const start = app.indexOf("function persist()");
  const end = app.indexOf("function esc(", start);

  assert.notEqual(start, -1, "persist関数が見つからない");
  assert.notEqual(end, -1, "persist関数の終了位置が見つからない");

  vm.runInNewContext(
    app.slice(start, end) + "\nthis.persist = persist;",
    sandbox
  );

  return { persist: sandbox.persist, data, stored, alerts, KEY, originalValue };
}

test("persist：localStorage保存失敗ならfalseを返し、警告する", () => {
  const h = createPersistHarness(true);

  assert.equal(h.persist(), false);
  assert.equal(h.stored.get(h.KEY), h.originalValue);
  assert.equal(h.alerts.length, 1);
  assert.match(h.alerts[0], /保存できませんでした/);
});

test("persist：localStorage保存成功ならtrueを返してデータを書き込む", () => {
  const h = createPersistHarness(false);

  assert.equal(h.persist(), true);
  assert.equal(h.stored.get(h.KEY), JSON.stringify(h.data));
});
function createSaveStateHarness(shouldSave) {
  const elements = {
    goal: { value: "新しい目的" },
    state: { value: "新しい現在地" },
    next: { value: "新しい次の一手" }
  };
  const data = {
    goal: "元の目的",
    state: "元の現在地",
    next: "元の次の一手"
  };
  const messages = [];
  const sandbox = {
    data,
    $: id => elements[id],
    persist: () => shouldSave(),
    addMsg: (...args) => messages.push(args)
  };
  const appPath = path.join(__dirname, "..", "app.js");
  const app = fs.readFileSync(appPath, "utf8");
  const start = app.indexOf("function saveState()");
  const end = app.indexOf("function restart(", start);

  assert.notEqual(start, -1, "saveState関数が見つからない");
  assert.notEqual(end, -1, "saveState関数の終了位置が見つからない");

  vm.runInNewContext(
    app.slice(start, end) + "\nthis.saveState = saveState;",
    sandbox
  );

  return { saveState: sandbox.saveState, data, elements, messages };
}

test("状態保存：保存失敗なら内部データを維持し、入力と成功メッセージを残さない", () => {
  const h = createSaveStateHarness(() => false);

  h.saveState();

  assert.equal(h.data.goal, "元の目的");
  assert.equal(h.data.state, "元の現在地");
  assert.equal(h.data.next, "元の次の一手");
  assert.equal(h.elements.goal.value, "新しい目的", "入力内容は再試行できるよう画面に残す");
  assert.equal(h.elements.state.value, "新しい現在地");
  assert.equal(h.elements.next.value, "新しい次の一手");
  assert.equal(h.messages.length, 0, "保存失敗時に成功メッセージを出さない");
});
test("状態保存：保存成功なら新しいデータを保持し、成功メッセージを出す", () => {
  const h = createSaveStateHarness(() => true);

  h.saveState();

  assert.equal(h.data.goal, "新しい目的");
  assert.equal(h.data.state, "新しい現在地");
  assert.equal(h.data.next, "新しい次の一手");
  assert.equal(h.messages.length, 1);
  assert.equal(
    h.messages[0][1],
    "目的・現在地・次の一手を保存した。"
  );
});


