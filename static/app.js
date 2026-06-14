const state = {
  cases: [],
  organizations: [],
  documents: [],
  intel: [],
  filter: "all",
  typeFilter: "all",
  range: "all",
  layers: {
    litigation: true,
    intel: true,
    official: true,
    p0: true,
  },
};

const signalTypeLabels = {
  news: "新闻",
  law_firm_statement: "律所表态",
  rights_holder_statement: "权利人声明",
  official_court_document: "官方文件/法院文书",
};

const jurisdictionLabels = {
  France: "法国",
  Germany: "德国",
  "European Union": "欧盟",
  "United Kingdom": "英国",
  Netherlands: "荷兰",
  Spain: "西班牙",
  Italy: "意大利",
  Nordics: "北欧",
  "EU / CJEU": "欧盟 / 欧盟法院",
};

const statusLabels = {
  WATCH: "监控中",
  LEAD: "线索",
  CASE: "案件",
  CLOSED: "已结束",
};

const confidenceLabels = {
  official: "官方",
  semi_official: "半官方",
  media_lead: "媒体线索",
};

const jurisdictions = [
  { id: "fr", name: "France", label: "法国", priority: "P0", score: 97, x: 42, y: 58, note: "SACD、Le Figaro、巴黎法院" },
  { id: "eu", name: "European Union", label: "欧盟", priority: "P1", score: 84, x: 59, y: 43, note: "AI Act、CJEU、TDM opt-out" },
  { id: "de", name: "Germany", label: "德国", priority: "P1", score: 78, x: 54, y: 42, note: "GEMA、OpenAI、音乐版权" },
  { id: "uk", name: "United Kingdom", label: "英国", priority: "P2", score: 70, x: 31, y: 38, note: "新闻语料、图像权利、授权" },
  { id: "nl", name: "Netherlands", label: "荷兰", priority: "P2", score: 61, x: 48, y: 36, note: "平台管辖、抓取、托管" },
  { id: "es", name: "Spain", label: "西班牙", priority: "P3", score: 48, x: 35, y: 76, note: "媒体集团、欧盟落地" },
  { id: "it", name: "Italy", label: "意大利", priority: "P3", score: 52, x: 60, y: 72, note: "出版、监管、文化行业" },
  { id: "no", name: "Nordics", label: "北欧", priority: "P3", score: 45, x: 63, y: 21, note: "集体管理组织、媒体联盟" },
];

const $ = (selector) => document.querySelector(selector);

async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function priorityBadge(priority) {
  return `<span class="badge ${priority}">${priority}</span>`;
}

function formatDate(value) {
  if (!value) return "无日期";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function inRange(item) {
  if (state.range === "all") return true;
  const raw = item.signal_date || item.approved_at || item.created_at;
  if (!raw) return true;
  const time = new Date(raw).getTime();
  if (Number.isNaN(time)) return true;
  const days = state.range === "7d" ? 7 : 30;
  return Date.now() - time <= days * 24 * 60 * 60 * 1000;
}

function intelForJurisdiction(name) {
  const normalized = name === "EU / CJEU" ? "European Union" : name;
  return state.intel.filter((item) => item.jurisdiction === normalized && inRange(item));
}

function caseForJurisdiction(name) {
  const normalized = name === "EU / CJEU" ? "European Union" : name;
  return state.cases.filter((item) => item.jurisdiction === normalized);
}

function renderMetrics() {
  if (!$("#metrics")) return;
  const p0 = state.organizations.filter((item) => item.priority === "P0").length;
  const officialDocs = state.documents.filter((item) => item.confidence === "official").length;
  const p1PlusIntel = state.intel.filter((item) => ["P0", "P1"].includes(item.priority)).length;
  $("#metrics").innerHTML = [
    ["P0 对象", p0],
    ["高风险情报", p1PlusIntel],
    ["官方文书", officialDocs],
    ["监控法域", jurisdictions.length],
  ]
    .map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`)
    .join("");
}

function renderMap() {
  const points = jurisdictions
    .map((item) => {
      const intelCount = intelForJurisdiction(item.name).length;
      const caseCount = caseForJurisdiction(item.name).length;
      const showPoint =
        (state.layers.litigation && caseCount > 0) ||
        (state.layers.intel && intelCount > 0) ||
        (state.layers.p0 && item.priority === "P0");
      if (!showPoint) return "";
      const intensity = Math.min(100, item.score + intelCount * 5);
      return `
        <button class="map-point ${item.priority}" style="left:${item.x}%; top:${item.y}%;" data-jurisdiction="${item.name}">
          <span>${item.label}</span>
          <strong>${item.priority}</strong>
          <em>${caseCount} 案件 · ${intelCount} 情报</em>
          <i style="width:${intensity}%"></i>
        </button>
      `;
    })
    .join("");

  const officialPins = state.layers.official
    ? `
      <div class="map-pin official" style="left:58%; top:47%;">EUR-Lex</div>
      <div class="map-pin official" style="left:42%; top:63%;">Judilibre</div>
    `
    : "";

  $("#nordicMap").innerHTML = `
    <div class="map-watermark">EUROPE</div>
    <div class="map-shape"></div>
    <div class="map-grid-lines"></div>
    ${officialPins}
    ${points}
  `;
}

function renderIntel() {
  if (!$("#intelCards")) return;
  const cards = state.intel.filter((item) => {
    const priorityMatch = state.filter === "all" || item.priority === state.filter;
    const typeMatch = state.typeFilter === "all" || item.signal_type === state.typeFilter;
    return priorityMatch && typeMatch && inRange(item);
  });
  $("#intelCards").innerHTML = cards.length
    ? cards
        .map(
          (item) => `
        <article class="intel-feed-card">
          <div class="case-meta">
            ${priorityBadge(item.priority)}
            <span class="pill type-pill">${signalTypeLabels[item.signal_type] || item.signal_type}</span>
            <span class="pill">${confidenceLabels[item.confidence] || item.confidence}</span>
          </div>
          <h3>${item.title}</h3>
          <p>${item.summary}</p>
          <div class="meta-list">
            <span>日期：${formatDate(item.signal_date || item.approved_at || item.created_at)}</span>
            <span>法域：${jurisdictionLabels[item.jurisdiction] || item.jurisdiction}</span>
          </div>
          <div class="intel-foot">
            <span>${item.source_name}</span>
            <a href="${item.source_url}" target="_blank" rel="noreferrer">来源</a>
          </div>
        </article>
      `
        )
        .join("")
    : `<div class="empty-state">当前筛选条件下没有已发布情报。</div>`;
}

function renderCases() {
  if (!$("#cases")) return;
  $("#cases").innerHTML = state.cases
    .map(
      (item) => `
        <article class="case-card" data-case-id="${item.id}">
          <div class="case-meta">
            ${priorityBadge(item.priority)}
            <span class="pill">${statusLabels[item.status] || item.status}</span>
            <span class="pill">${jurisdictionLabels[item.jurisdiction] || item.jurisdiction}</span>
            <span class="pill">${item.document_count} 文书</span>
          </div>
          <h3>${item.title}</h3>
          <p>${item.summary}</p>
          <div class="risk-bar"><span style="width:${item.risk_score}%"></span></div>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".case-card").forEach((card) => {
    card.addEventListener("click", () => showCase(card.dataset.caseId));
  });
}

async function showCase(caseId) {
  const item = await api(`/api/cases/${caseId}`);
  $("#caseDetail").innerHTML = `
    <div class="case-meta">
      ${priorityBadge(item.priority)}
      <span class="pill">${statusLabels[item.status] || item.status}</span>
      <span class="pill">${item.procedural_stage}</span>
      <span class="pill">风险 ${item.risk_score}</span>
    </div>
    <h2>${item.title}</h2>
    <p>${item.summary}</p>
    <div class="detail-block">
      <h3>法院与标识</h3>
      <p>${item.court || "待确认"} · ${item.case_number || "无案号"} · ${item.ecli || "无 ECLI"}</p>
    </div>
    <div class="detail-block">
      <h3>权利主体</h3>
      <p>${item.organizations.map((org) => `${org.name} (${org.role})`).join(", ") || "未绑定"}</p>
    </div>
    <div class="detail-block">
      <h3>官方文书</h3>
      <p>${item.documents.length ? item.documents.map((doc) => doc.title).join(", ") : "暂无案件文书，保持监控。"}</p>
    </div>
  `;
  $("#caseDialog").showModal();
}

function attachEvents() {
  const priorityFilters = $(".filters");
  if (priorityFilters) priorityFilters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    document.querySelectorAll(".filters button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderIntel();
  });

  const typeFilters = $(".type-filters");
  if (typeFilters) typeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-type-filter]");
    if (!button) return;
    state.typeFilter = button.dataset.typeFilter;
    document.querySelectorAll(".type-filters button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderIntel();
  });

  document.querySelectorAll("[data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      state.range = button.dataset.range;
      document.querySelectorAll("[data-range]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderMap();
      renderIntel();
    });
  });

  document.querySelectorAll("[data-layer]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      state.layers[checkbox.dataset.layer] = checkbox.checked;
      renderMap();
    });
  });

  const closeDialog = $("#closeDialog");
  if (closeDialog) closeDialog.addEventListener("click", () => $("#caseDialog").close());

  const runMonitor = $("#runMonitor");
  if (runMonitor) runMonitor.addEventListener("click", async () => {
    runMonitor.disabled = true;
    runMonitor.textContent = "监控中";
    await api("/api/monitor/run", { method: "POST" });
    await load();
    runMonitor.disabled = false;
    runMonitor.textContent = "运行监控";
  });
}

async function load() {
  const [cases, organizations, documents, intel] = await Promise.all([
    api("/api/cases"),
    api("/api/organizations"),
    api("/api/documents"),
    api("/api/intel?status=published"),
  ]);
  state.cases = cases;
  state.organizations = organizations;
  state.documents = documents;
  state.intel = intel;
  renderMetrics();
  renderMap();
  renderIntel();
  renderCases();
}

attachEvents();
load().catch((error) => {
  document.body.innerHTML = `<main><h1>加载失败</h1><pre>${error.message}</pre></main>`;
});
