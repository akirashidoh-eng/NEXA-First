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

test("完了切替：保存失敗なら未完了に戻す", () => {
  const h = createHarness({
    tasks: [sampleTask()],
    state: "元の現在地",
    next: "元の次の一手"
  }, () => false);

  h.api.toggleTask(1);

  assert.equal(h.data.tasks[0].done, false);
  assert.equal(h.data.state, "元の現在地");
  assert.equal(h.data.next, "元の次の一手");
  assert.match(h.elements.taskSummary.textContent, /未完了1件/);
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
