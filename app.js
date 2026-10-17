const KEY = "nexa_first_state_v3";
const OLD_KEY = "nexa_first_state_v2";
const $ = id => document.getElementById(id);
const now = () => new Date().toLocaleString("ja-JP");

function createEmptyState() {
  return {
    goal: "", state: "", next: "",
    assumptions: [], decisions: [], lastChoice: null,
    messages: [], unresolved: [], doNot: [],
    recommendations: [], priorities: [], notes: [],
    selfReviews: [], tasks: []
  };
}

const base = createEmptyState();

function load() {
  try {
    const current = JSON.parse(localStorage.getItem(KEY) || "null");
    const old = current ? null : JSON.parse(localStorage.getItem(OLD_KEY) || "null");
    const saved = current || old || {};
    return {
      ...base, ...saved,
      assumptions: saved.assumptions || [],
      decisions: saved.decisions || [],
      messages: saved.messages || [],
      unresolved: saved.unresolved || [],
      doNot: saved.doNot || [],
      recommendations: saved.recommendations || [],
      priorities: saved.priorities || [],
      notes: saved.notes || [],
      selfReviews: saved.selfReviews || [],
      tasks: saved.tasks || []
    };
  } catch {
    return createEmptyState();
  }
}

let data = load();
let stateCandidate = null;

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("NEXA save error:", e);
    alert("保存できませんでした。端末の空き容量やブラウザ設定を確認してください。");
    return false;
  }
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

function addMsg(role, text, save = true) {
  const el = document.createElement("div");
  el.className = "msg " + (role === "user" ? "user" : "nexa");
  el.textContent = text;
  $("chat").appendChild(el);
  $("chat").scrollTop = $("chat").scrollHeight;

  if (save) {
    data.messages.push({ role, text, time: now() });
    if (data.messages.length > 200) data.messages = data.messages.slice(-200);
    persist();
  }
}

function listHtml(items, empty) {
  if (!items.length) return empty;
  return items.slice(-8).map((x, i) =>
    `<div class="item"><b>${i + 1}.</b> ${esc(x.text || x.choice || "")}` +
    `<span class="small">${x.priority ? "｜優先度：" + esc(x.priority) : ""}` +
    `${x.time ? "｜" + esc(x.time) : ""}</span></div>`
  ).join("");
}

function render() {
  $("goal").value = data.goal || "";
  $("state").value = data.state || "";
  $("next").value = data.next || "";

  $("chat").innerHTML = "";
  (data.messages || []).slice(-30).forEach(m => addMsg(m.role, m.text, false));

  $("decisions").innerHTML = listHtml(data.decisions, "まだありません。");
  $("assumptions").innerHTML = listHtml(data.assumptions, "まだありません。");
  $("unresolved").innerHTML = listHtml(data.unresolved, "未解決事項はありません。");
  $("doNot").innerHTML = listHtml(data.doNot, "保留・非実装項目はありません。");
  $("priorities").innerHTML = listHtml(data.priorities, "まだありません。");
  $("notes").innerHTML = listHtml(data.notes, "作業メモはありません。");

  $("recommendations").innerHTML = data.recommendations.length
    ? data.recommendations.slice(-6).map((x, i) =>
      `<div class="item"><b>${i + 1}.</b> ${esc(x.text)}` +
      `<div class="small">理由：${esc(x.reason)}｜確信度：${esc(x.confidence)}｜${esc(x.time)}</div></div>`
    ).join("")
    : "まだありません。";

  renderTasks();
}

function saveState() {
  data.goal = $("goal").value.trim();
  data.state = $("state").value.trim();
  data.next = $("next").value.trim();
  if (persist()) addMsg("nexa", "目的・現在地・次の一手を保存した。");
}

function restart() {
  const d = data;
  $("restartBox").innerHTML =
    `<b>おかえり、AKIRA。</b><br>` +
    `目的：${esc(d.goal || "未設定")}<br>` +
    `現在地：${esc(d.state || "未設定")}<br>` +
    `次の一手：${esc(d.next || "未設定")}<br>` +
    `タスク：${d.tasks.filter(t => !t.done).length}件未完了｜` +
    `未解決：${d.unresolved.length}件｜判断：${d.decisions.length}件`;

  addMsg("nexa",
    `前回状態を確認した。\n目的：${d.goal || "未設定"}` +
    `\n現在地：${d.state || "未設定"}` +
    `\n次の一手：${d.next || "未設定"}` +
    `\n未完了タスク：${d.tasks.filter(t => !t.done).length}件` +
    `\n未解決事項：${d.unresolved.length}件\nここから続けよう。`
  );
}

function clearAll() {
  if (!confirm("NEXAの保存状態をすべて消します。よろしいですか？")) return;
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
    data = createEmptyState();
    stateCandidate = null;
    $("updateCandidate").hidden = true;
    $("restartBox").textContent = "保存状態を消去しました。";
    render();
  } catch (e) {
    alert("保存状態を消去できませんでした。");
  }
}

function saveNote() {
  const v = $("noteInput").value.trim();
  if (!v) return addMsg("nexa", "作業メモを入力してね。");
  data.notes.push({ text: v, time: now() });
  if (persist()) {
    $("noteInput").value = "";
    render();
    addMsg("nexa", "作業メモを保存した。");
  }
}

/* タスク管理 */
function addTask() {
  const input = $("taskInput");
  const text = input.value.trim();
  if (!text) return addMsg("nexa", "追加するタスクを入力してね。");

  data.tasks.push({ id: Date.now() + Math.random(), text, done: false, time: now() });
  if (persist()) {
    input.value = "";
    renderTasks();
    addMsg("nexa", "タスクを追加した：" + text);
  }
}

function toggleTask(id) {
  const task = data.tasks.find(t => String(t.id) === String(id));
  if (!task) return;
  task.done = !task.done;
  if (persist()) renderTasks();
}

function deleteTask(id) {
  data.tasks = data.tasks.filter(t => String(t.id) !== String(id));
  if (persist()) renderTasks();
}

function renderTasks() {
  const tasks = data.tasks || [];
  const done = tasks.filter(t => t.done).length;
  $("taskSummary").textContent =
    `全${tasks.length}件｜完了${done}件｜未完了${tasks.length - done}件`;

  $("taskList").innerHTML = tasks.length ? tasks.map(t =>
    `<div class="item" style="display:flex;gap:8px;align-items:center">` +
    `<input type="checkbox" style="width:auto" ${t.done ? "checked" : ""} ` +
    `aria-label="タスク完了" onchange="toggleTask('${t.id}')">` +
    `<span style="flex:1;${t.done ? "text-decoration:line-through;color:#6b7280" : ""}">${esc(t.text)}</span>` +
    `<button class="secondary" onclick="deleteTask('${t.id}')">削除</button></div>`
  ).join("") : "タスクはありません。";
}

function confidence(v) {
  if (/確実|確定|間違いない/.test(v)) return "高";
  if (/たぶん|おそらく|可能性|推測/.test(v)) return "中";
  return "未評価";
}

function priority(v) {
  if (/最優先|急ぎ|今すぐ|至急/.test(v)) return "高";
  if (/重要|先に|優先/.test(v)) return "中";
  return "低";
}

function contradiction(v) {
  const a = data.assumptions.map(x => x.text || "").join(" ");
  const checks = [
    [/無料|無課金|課金しない/, /有料|課金|有料API/,
      "無料という前提と今回の案が衝突する可能性がある"],
    [/iPhone|iOS|スマホ/, /Mac|macOS|Xcode/,
      "iPhone中心という前提を確認したい"],
    [/初号機|基本型|シンプル/, /全部入れ|大規模|機能追加/,
      "初号機はシンプルにする方針を確認したい"]
  ];
  for (const [yes, no, msg] of checks) {
    if (yes.test(a) && no.test(v)) return msg + "。前提を変えるか確認しよう。";
  }
  return null;
}

function decisionWords(v) {
  return /決めた|決定|選ぶ|選んだ|これでいく|これで行く|①|②|③|採用|却下/.test(v);
}

function showStateCandidate(type, text) {
  stateCandidate = { type, text };
  $("candidateText").textContent =
    (type === "state" ? "現在の状況" : "次にやること") + "：" + text;
  $("updateCandidate").hidden = false;
}

function acceptStateCandidate() {
  if (!stateCandidate) return;
  if (stateCandidate.type === "state") {
    data.state = stateCandidate.text;
    $("state").value = stateCandidate.text;
  } else {
    data.next = stateCandidate.text;
    $("next").value = stateCandidate.text;
  }
  if (persist()) {
    $("updateCandidate").hidden = true;
    addMsg("nexa", "状態更新候補を反映して保存した。");
    stateCandidate = null;
  }
}

function dismissStateCandidate() {
  stateCandidate = null;
  $("updateCandidate").hidden = true;
  addMsg("nexa", "更新候補を見送った。保存状態は変更していないよ。");
}

/* 自由質問へのルールベース回答 */
function buildContextReply(v) {
  const text = String(v || "").trim();
  const goal = data.goal || "未設定";
  const state = data.state || "未記録";
  const next = data.next || "未設定";
  const pending = data.tasks.filter(t => !t.done);
  let reply;

  if (/^(こんにちは|こんばんは|おはよう|おはようございます|やあ|やっほー|よろしく|ヨロシク)[！!。.\s]*$/i.test(text)) {
    return /おはよう/.test(text) ? "おはよう！今日は何から始めようか？"
      : /こんばんは/.test(text) ? "こんばんは！今日は何を進めようか？"
      : "了解！何を手伝おうか？";
  }

  if (/どこまで|進捗|進んだ|現状|現在地|今の状態|次に何|次は何|次の一手/.test(text)) {
    return `【目的】${goal}\n【現在地】${state}\n【次の一手】${next}` +
      `\n【未完了タスク】${pending.length}件` +
      (pending.length ? "\n" + pending.slice(0, 5).map((t, i) => `${i + 1}. ${t.text}`).join("\n") : "");
  }

  if (/3つ|三つ|アイデア|案を|提案|機能/.test(text)) {
    const ideas = [
      ["次の一手の自動整理", "目的と未完了タスクから、次の作業を明確にする"],
      ["判断理由の記録", "選択の理由と前提を保存し、後で判断を見直せる"],
      ["作業再開サマリー", "前回の状態・タスク・未解決事項を一画面で確認できる"]
    ];
    reply = "提案は3つ。\n" + ideas.map((x, i) =>
      `${i + 1}. ${x[0]}：${x[1]}`
    ).join("\n");

    if (/最も|一番|どれが|優先/.test(text)) {
      reply += "\n\n最優先の推奨：1. 次の一手の自動整理。" +
        "\n理由：毎回の再開で迷う時間を減らし、既存の目的・タスク管理と直接つながるため。";
    }
    return reply;
  }

  if (/最も必要|一番必要|最優先の機能|必要な機能/.test(text)) {
    return "NEXAに最も必要なのは「目的・現在地・次の一手をつないで、次の行動を具体化する機能」だと考える。\n" +
      "理由：情報を保存するだけでは軍師秘書として不十分。記録から次の一歩を示せれば、再開のしやすさと実用性が上がる。\n" +
      "まずは既存のタスク管理と連携させるのが現実的。";
  }

  if (/なぜ|どうして|理由/.test(text)) {
    if (/NEXA|初号機|開発|作る/.test(text)) {
      return `目的は「${goal}」。判断理由を明確にし、必要な機能から順に実装するためだよ。`;
    }
    return "理由を確認する対象が複数ありそう。何についての理由かを絞れば、直接答えられるよ。";
  }

  if (/困|問題|エラー|動かない|失敗|不具合/.test(text)) {
    return "まず問題を切り分けよう。\n1. 期待した動作\n2. 実際の動作\n3. エラー表示\nこの3点を比べ、原因を確認してから変更する。";
  }

  if (/説明|教えて|とは何|どういう意味|どうやって/.test(text)) {
    return `質問への回答：${text}\n\n保存された記録だけでは具体的な答えを確定できない場合がある。対象や条件が明確なら、そこに絞って説明するよ。`;
  }

  if (/タスク|作業/.test(text) && /何|残|未完了|次/.test(text)) {
    return pending.length
      ? "未完了タスク：\n" + pending.map((t, i) => `${i + 1}. ${t.text}`).join("\n")
      : "未完了タスクはないよ。次にやることを決めてタスクに追加しよう。";
  }

  reply = `入力を確認したよ：「${text}」`;
  reply += `\n\n現在の目的は「${goal}」。`;
  if (data.tasks.length) reply += `未完了タスクは${pending.length}件。`;
  reply += "\nこの内容をどう扱うか、提案・説明・判断・記録のどれを求めているかが分かれば、より直接的に答えられるよ。";
  return reply;
}

function handleSelfReview(v) {
  if (!/自己点検|改善記録|自己改善状況|答えになってない|的外れ|話が違う|そうじゃない|期待と違う|改善してほしい|意図と違う/.test(v)) return false;

  const reviews = data.selfReviews || [];
  if (/自己点検|改善記録|自己改善状況/.test(v) &&
      !/答えになってない|的外れ|話が違う|そうじゃない|期待と違う|改善してほしい|意図と違う/.test(v)) {
    addMsg("nexa", reviews.length
      ? reviews.slice(-5).map((x, i) => `${i + 1}. 指摘：${x.feedback}\n原因候補：${x.cause}\n改善案：${x.proposal}\n状態：${x.status}`).join("\n\n")
      : "自己点検記録はまだないよ。");
    return true;
  }

  const previous = [...data.messages].reverse().find(m => m.role === "nexa");
  const review = {
    feedback: v,
    previousReply: previous ? previous.text : "",
    cause: "回答が質問の要求に十分対応していない可能性",
    proposal: "質問の要求を特定し、最初に結論を答えてから理由を説明する",
    status: "原因候補を記録・改善未検証",
    time: now()
  };
  data.selfReviews.push(review);
  data.selfReviews = data.selfReviews.slice(-50);
  persist();
  addMsg("nexa", `指摘を記録した。\n原因候補：${review.cause}\n改善案：${review.proposal}\n※記録しただけで、コードの自動修正や動作テストをしたわけではないよ。`);
  return true;
}

function analyze(v) {
  if (handleSelfReview(v)) return;

  const conflict = contradiction(v);
  if (conflict) addMsg("nexa", "⚠️ 前提確認：" + conflict);

  if (/^(?:次は|次の一手は|次の一手[：:])\s*(.{2,100})[。.!！]*$/.test(v)) {
    showStateCandidate("next", v.match(/^(?:次は|次の一手は|次の一手[：:])\s*(.{2,100})[。.!！]*$/)[1].trim());
    addMsg("nexa", "次にやることの更新候補を表示したよ。確認して反映してね。");
    return;
  }

  if (/^(?:確認できた|確認済み|テストに成功|動作確認に成功|実装できた|追加できた|修正できた|コミットした|デプロイ成功)[：:、 ]/.test(v)) {
    showStateCandidate("state", v);
    addMsg("nexa", "進捗を検出したよ。現在の状況の更新候補を表示した。");
    return;
  }

  if (/^(今日はここまで|今日は終了|本日の作業は終了)/.test(v)) {
    data.notes.push({ text: "作業終了報告：" + v, time: now() });
    persist();
    render();
    addMsg("nexa", "了解。作業終了をメモに保存したよ。お疲れさま！");
    return;
  }

  if (/最優先|急ぎ|今すぐ|至急|重要|先に|優先/.test(v) && !decisionWords(v)) {
    data.priorities.push({ text: v, priority: priority(v), time: now() });
    persist();
    render();
    addMsg("nexa", `優先事項として記録した。優先度は「${priority(v)}」。`);
    return;
  }

  if (/迷|悩|どうする|どっち|選択肢/.test(v)) {
    const reason = "目的・前提・リスクを確認してから進むと、後戻りを減らせるため";
    data.recommendations.push({ text: "② 一度整理する", reason, confidence: "中", importance: "高", time: now() });
    persist();
    render();
    addMsg("nexa", `①そのまま進む\n②一度整理する\n③今は決めない\n\nNEXAの推奨：② 一度整理する。\n理由：${reason}。\n情報不足なら③も合理的。最終判断はAKIRA。`);
    return;
  }

  if (/今は決めない|決めない|判断しない|保留する/.test(v)) {
    data.lastChoice = { text: v, time: now() };
    data.decisions.push({ choice: "今は決めない", reason: "判断材料を追加確認", confidence: "高", time: now() });
    persist();
    render();
    addMsg("nexa", "「今は決めない」を判断として記録した。材料が揃ってから再判断しよう。");
    return;
  }

  if (decisionWords(v)) {
    data.lastChoice = { text: v, time: now() };
    data.decisions.push({ choice: v, reason: "必要時に確認", confidence: confidence(v), time: now() });
    persist();
    render();
    addMsg("nexa", `判断として記録した。確信度は「${confidence(v)}」。`);
    return;
  }

  if (/前提|条件/.test(v)) {
    data.assumptions.push({ text: v, time: now() });
    persist();
    render();
    addMsg("nexa", "前提条件として記録した。今後、矛盾しそうな案が出たら確認する。");
    return;
  }

  if (/保留|後で|2号機|初号機には入れない|不要/.test(v)) {
    data.doNot.push({ text: v, time: now() });
    persist();
    render();
    addMsg("nexa", "保留・非実装候補として記録した。");
    return;
  }

  if (/未解決|決まってない|まだ決めてない/.test(v)) {
    data.unresolved.push({ text: v, time: now() });
    persist();
    render();
    addMsg("nexa", "未解決事項として記録した。");
    return;
  }

  addMsg("nexa", buildContextReply(v));
}

function send() {
  const v = $("message").value.trim();
  if (!v) return;
  addMsg("user", v);
  $("message").value = "";
  analyze(v);
}

render();
