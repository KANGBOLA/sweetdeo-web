/* teafly 스마트상점 AI 챗봇 위젯 (self-contained)
 * Wix Custom Code(본문 끝) 또는 HTML 임베드에 <script src>로 삽입.
 * 백엔드: Supabase Edge Function "chat"
 */
(function () {
  if (window.__teaflyChatLoaded) return;
  window.__teaflyChatLoaded = true;

  var ENDPOINT = "https://ldyxlwijrnretecyfrzf.supabase.co/functions/v1/chat";
  var BRAND = "#2E7D5B";          // teafly green
  var BRAND_DK = "#256B4C";
  var GREETING = "안녕하세요! teafly 고객센터예요 🌿 무엇을 도와드릴까요?";
  var QUICK = ["상품문의", "배송문의", "교환·반품", "상담원 연결"];

  var history = [];   // {role, content}
  var busy = false;

  // ---- styles ----
  var css = ""
    + ".tf-fab{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;"
    + "background:" + BRAND + ";color:#fff;border:none;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25);"
    + "font-size:26px;z-index:2147483000;display:flex;align-items:center;justify-content:center;transition:transform .15s}"
    + ".tf-fab:hover{transform:scale(1.06)}"
    + ".tf-panel{position:fixed;right:20px;bottom:92px;width:360px;max-width:calc(100vw - 32px);height:520px;"
    + "max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);"
    + "z-index:2147483000;display:none;flex-direction:column;overflow:hidden;font-family:'Noto Sans KR',system-ui,sans-serif}"
    + ".tf-panel.open{display:flex}"
    + ".tf-head{background:" + BRAND + ";color:#fff;padding:14px 16px;font-weight:700;display:flex;align-items:center;justify-content:space-between}"
    + ".tf-head small{display:block;font-weight:400;opacity:.85;font-size:11px;margin-top:2px}"
    + ".tf-x{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1}"
    + ".tf-body{flex:1;overflow-y:auto;padding:14px;background:#F6F8F7}"
    + ".tf-msg{margin:8px 0;display:flex}"
    + ".tf-msg.u{justify-content:flex-end}"
    + ".tf-bub{max-width:78%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word}"
    + ".tf-msg.b .tf-bub{background:#fff;color:#222;border:1px solid #E5EAE7;border-top-left-radius:4px}"
    + ".tf-msg.u .tf-bub{background:" + BRAND + ";color:#fff;border-top-right-radius:4px}"
    + ".tf-quick{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px;background:#F6F8F7}"
    + ".tf-quick button{border:1px solid " + BRAND + ";color:" + BRAND + ";background:#fff;border-radius:16px;"
    + "padding:6px 12px;font-size:12px;cursor:pointer}"
    + ".tf-quick button:hover{background:" + BRAND + ";color:#fff}"
    + ".tf-foot{display:flex;gap:8px;padding:10px;border-top:1px solid #E5EAE7;background:#fff}"
    + ".tf-foot input{flex:1;border:1px solid #D8DEDB;border-radius:20px;padding:10px 14px;font-size:14px;outline:none}"
    + ".tf-foot input:focus{border-color:" + BRAND + "}"
    + ".tf-send{background:" + BRAND + ";color:#fff;border:none;border-radius:20px;padding:0 16px;cursor:pointer;font-weight:600}"
    + ".tf-send:disabled{opacity:.5;cursor:default}"
    + ".tf-dots span{display:inline-block;width:6px;height:6px;margin:0 2px;background:#9AA6A1;border-radius:50%;animation:tfb 1s infinite}"
    + ".tf-dots span:nth-child(2){animation-delay:.2s}.tf-dots span:nth-child(3){animation-delay:.4s}"
    + "@keyframes tfb{0%,60%,100%{opacity:.3}30%{opacity:1}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---- DOM ----
  var fab = document.createElement("button");
  fab.className = "tf-fab"; fab.setAttribute("aria-label", "채팅 상담 열기"); fab.innerHTML = "💬";

  var panel = document.createElement("div");
  panel.className = "tf-panel";
  panel.innerHTML =
    '<div class="tf-head"><div>teafly 고객센터<small>AI 상담 · 보통 몇 초 내 응답</small></div>'
    + '<button class="tf-x" aria-label="닫기">×</button></div>'
    + '<div class="tf-body" id="tf-body"></div>'
    + '<div class="tf-quick" id="tf-quick"></div>'
    + '<div class="tf-foot"><input id="tf-in" type="text" placeholder="메시지를 입력하세요" autocomplete="off"/>'
    + '<button class="tf-send" id="tf-send">전송</button></div>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var body = panel.querySelector("#tf-body");
  var input = panel.querySelector("#tf-in");
  var sendBtn = panel.querySelector("#tf-send");
  var quickWrap = panel.querySelector("#tf-quick");

  function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}
  function addMsg(role, text) {
    var row = document.createElement("div");
    row.className = "tf-msg " + (role === "user" ? "u" : "b");
    row.innerHTML = '<div class="tf-bub">' + esc(text) + "</div>";
    body.appendChild(row); body.scrollTop = body.scrollHeight;
    return row;
  }
  function typing() {
    var row = document.createElement("div");
    row.className = "tf-msg b";
    row.innerHTML = '<div class="tf-bub tf-dots"><span></span><span></span><span></span></div>';
    body.appendChild(row); body.scrollTop = body.scrollHeight; return row;
  }
  function renderQuick() {
    quickWrap.innerHTML = "";
    QUICK.forEach(function (q) {
      var b = document.createElement("button"); b.textContent = q;
      b.onclick = function () { send(q); };
      quickWrap.appendChild(b);
    });
  }

  async function send(text) {
    text = (text || input.value || "").trim();
    if (!text || busy) return;
    input.value = ""; busy = true; sendBtn.disabled = true;
    addMsg("user", text);
    history.push({ role: "user", content: text });
    quickWrap.style.display = "none";
    var t = typing();
    try {
      var res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      var data = await res.json();
      t.remove();
      var reply = data.reply || "일시적으로 응답이 어려워요. 잠시 후 다시 시도하시거나 070-8064-3891로 문의해 주세요.";
      addMsg("assistant", reply);
      history.push({ role: "assistant", content: reply });
    } catch (e) {
      t.remove();
      addMsg("assistant", "네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      busy = false; sendBtn.disabled = false; input.focus();
    }
  }

  var opened = false;
  function open() {
    panel.classList.add("open");
    if (!opened) { opened = true; addMsg("assistant", GREETING); renderQuick(); }
    quickWrap.style.display = "flex"; input.focus();
  }
  function close() { panel.classList.remove("open"); }

  fab.onclick = function () { panel.classList.contains("open") ? close() : open(); };
  panel.querySelector(".tf-x").onclick = close;
  sendBtn.onclick = function () { send(); };
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
})();
