const KEY="nexa_first_state_v3";
const OLD_KEY="nexa_first_state_v2";
const $=id=>document.getElementById(id);
const now=()=>new Date().toLocaleString("ja-JP");
const base={goal:"",state:"",next:"",assumptions:[],decisions:[],lastChoice:null,messages:[],unresolved:[],doNot:[],recommendations:[],priorities:[],notes:[]};
function load(){try{const current=JSON.parse(localStorage.getItem(KEY)||"null");if(current)return {...base,...current};const old=JSON.parse(localStorage.getItem(OLD_KEY)||"null");if(old){const migrated={...base,...old,priorities:old.priorities||[]};localStorage.setItem(KEY,JSON.stringify(migrated));return migrated}return {...base}}catch{return {...base}}}
let data=load();
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function persist(){localStorage.setItem(KEY,JSON.stringify(data));}
function addMsg(role,text,save=true){const el=document.createElement("div");el.className="msg "+(role==="user"?"user":"nexa");el.textContent=text;$('chat').appendChild(el);$('chat').scrollTop=$('chat').scrollHeight;if(save){data.messages.push({role,text});persist()}}
function listHtml(items,empty){return items.length?items.map((x,i)=>`<div class="item"><b>${i+1}.</b> ${esc(x.text||x.choice)}<span class="small">${x.priority?"｜優先度："+esc(x.priority):""}${x.time?"｜"+esc(x.time):""}</span></div>`).join(""):empty}
function render(){
 $('goal').value=data.goal||'';$('state').value=data.state||'';$('next').value=data.next||'';
 const chat=$('chat');chat.innerHTML='';data.messages.slice(-30).forEach(m=>addMsg(m.role,m.text,false));
 $('decisions').innerHTML=listHtml(data.decisions.slice(-8),'まだありません。');
 $('assumptions').innerHTML=listHtml(data.assumptions.slice(-8),'まだありません。');
 $('unresolved').innerHTML=listHtml(data.unresolved.slice(-8),'未解決事項はありません。');
 $('doNot').innerHTML=listHtml(data.doNot.slice(-8),'保留・非実装項目はありません。');
 $('priorities').innerHTML=listHtml(data.priorities.slice(-8),'まだありません。');
 $('recommendations').innerHTML=data.recommendations.length?data.recommendations.slice(-6).map((x,i)=>`<div class="item"><b>${i+1}.</b> ${esc(x.text)}<br><span class="small">理由：${esc(x.reason)}｜確信度：${esc(x.confidence)}｜重要度：${esc(x.importance)}｜${esc(x.time)}</span></div>`).join(''):'まだありません。';
}
function saveState(){data.goal=$('goal').value.trim();data.state=$('state').value.trim();data.next=$('next').value.trim();persist();addMsg('nexa','状態を保存した。目的・現在地・次の一手・前提条件を基準に再開できる。');}
function restart(){const d=data;$('restartBox').innerHTML=`<b>おかえり、AKIRA。</b><br>目的：${esc(d.goal||'未設定')}<br>現在地：${esc(d.state||'未設定')}<br>次の一手：${esc(d.next||'未設定')}<br>前提条件：${d.assumptions.length}件｜未解決：${d.unresolved.length}件｜保留：${d.doNot.length}件｜優先事項：${d.priorities.length}件｜判断：${d.decisions.length}件`;addMsg('nexa',`前回状態を確認した。\n目的：${d.goal||'未設定'}\n現在地：${d.state||'未設定'}\n次の一手：${d.next||'未設定'}\n前提条件：${d.assumptions.length}件／未解決：${d.unresolved.length}件／保留：${d.doNot.length}件／優先事項：${d.priorities.length}件\n必要なら、ここから続けよう。`)}
function clearAll(){if(!confirm('NEXA初号機の保存状態をすべて消します。よろしいですか？'))return;localStorage.removeItem(KEY);data={...base};render();$('restartBox').textContent='保存状態を消去しました。'}
function confidence(v){if(/確実|確定|間違いない/.test(v))return '高';if(/たぶん|おそらく|可能性|推測/.test(v))return '中';return '未評価'}
function priority(v){if(/最優先|急ぎ|今すぐ|至急/.test(v))return '高';if(/重要|先に|優先/.test(v))return '中';return '低'}
function recordPriority(v){const p=priority(v);data.priorities.push({text:v,priority:p,time:now()});persist();addMsg('nexa',`優先事項として整理した。優先度は「${p}」。\n判断基準：目的への影響・緊急性・後戻りコストを優先して見る。`);render()}
function contradiction(v){
 const a=data.assumptions.map(x=>x.text||'').join(' ');
 const checks=[
  [/無料|無課金|課金しない/,'有料|課金|有料API','「無料・無課金」という前提と今回の内容がぶつかっている'],
  [/iPhone|iOS|スマホ|スマートフォン/,'Mac|macOS|Xcode','「iPhone中心」という前提と今回の内容がぶつかっている'],
  [/初号機|基本型|シンプル/,'全部入れ|機能追加|高度な|大規模','「初号機はシンプル」という前提と今回の内容がぶつかっている']
 ];
 for(const [yes,no,msg] of checks){if(yes.test(a)&&no.test(v))return msg+'。前提が変わったなら更新しよう。変わっていないなら、今は保留を推す。'}
 return null;
}
function decisionWords(v){return /決めた|決定|選ぶ|選んだ|これでいく|これで行く|①|②|③|やる|やめる|進める|採用|却下/.test(v)}
function analyze(v){
 const prev=data.lastChoice;
 const conflict=contradiction(v);if(conflict){addMsg('nexa','⚠️ 矛盾候補を検知。\n'+conflict);}
 if(/分からない|わからない/.test(v)){addMsg('nexa','了解。分からないものは分からないでOK。事実・推測・意見を分け、必要なら「今は決めない」を選択肢にする。');return}
 if(/最優先|急ぎ|今すぐ|至急|重要|先に|優先/.test(v)&&!decisionWords(v)){recordPriority(v);return}
 if(/迷|悩|どうする|どっち|選択/.test(v)){
  const rec='② 一度整理する';const reason='目的・前提・矛盾候補・リスクを先に確認すると、後戻りを減らせるため';
  data.recommendations.push({text:rec,reason,confidence:'中',importance:'高',time:now()});persist();
  addMsg('nexa',`軍師秘書モード：①そのまま進む ②一度整理する ③今は決めない。\nNEXAなら②を推す。\n理由：${reason}。\nただし、情報不足なら③「今は決めない」が正解。最終判断はAKIRA。`);render();return
 }
 if(/今は決めない|決めない|判断しない|保留する/.test(v)){
  data.lastChoice={text:'今は決めない：'+v,time:now()};data.decisions.push({choice:'今は決めない',reason:'判断材料・条件を追加確認',confidence:'高',time:now()});persist();
  addMsg('nexa','「今は決めない」を正式な判断として記録した。\nこれは逃げではなく、判断材料不足や前提未確定なら合理的な選択肢。\n未解決事項を整理してから再判断する。');render();return
 }
 if(decisionWords(v)){
  const c=confidence(v);data.lastChoice={text:v,time:now()};data.decisions.push({choice:v,reason:'必要時に確認',confidence:c,time:now()});persist();
  addMsg('nexa',`判断として記録した。確信度は「${c}」。\nNEXAの推奨と異なる場合も、まず理由と前提の変化を確認する。くどくはしない。`);render();return
 }
 if(/前提|条件/.test(v)){data.assumptions.push({text:v,time:now()});persist();addMsg('nexa','前提条件として記録した。今後この条件と矛盾する案が出たら、NEXAが止めて確認する。');render();return}
 if(/保留|後で|2号機|初号機には入れない|不要/.test(v)){data.doNot.push({text:v,time:now()});persist();addMsg('nexa','今は保留・非実装候補として記録した。初号機を膨らませすぎない。');render();return}
 if(/未解決|決まってない|まだ決めてない/.test(v)){data.unresolved.push({text:v,time:now()});persist();addMsg('nexa','未解決事項として記録した。次回再開時にも確認できる。');render();return}
 addMsg('nexa','受け取った。目的→現在地→次の一手を軸に、優先順位・前提との矛盾・判断変更・未解決事項・保留事項を見て、必要な時だけ介入する。事実／推測／意見も分けて扱う。\n\n※初号機では自然言語理解に限界があるため、曖昧な内容は断定しない。');
}
function send(){const v=$('message').value.trim();if(!v)return;addMsg('user',v);$('message').value='';analyze(v)}
render();
