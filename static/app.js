const state = {
  cases: [],
  organizations: [],
  documents: [],
  intel: [],
  filter: "all",
  evidence: "news",
  range: "all",
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
  "Council of Europe": "欧洲委员会",
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

const evidenceTitles = {
  news: "新闻有哪些",
  official: "官方诉讼文书有哪些",
  rights: "权利人机构是否集体发声",
};

const jurisdictions = [
  { id: "fr", name: "France", label: "法国", priority: "P0", score: 97, x: 42, y: 58 },
  { id: "eu", name: "European Union", label: "欧盟", priority: "P1", score: 84, x: 59, y: 43 },
  { id: "de", name: "Germany", label: "德国", priority: "P1", score: 78, x: 54, y: 42 },
  { id: "uk", name: "United Kingdom", label: "英国", priority: "P2", score: 70, x: 31, y: 38 },
  { id: "nl", name: "Netherlands", label: "荷兰", priority: "P2", score: 61, x: 48, y: 36 },
  { id: "es", name: "Spain", label: "西班牙", priority: "P3", score: 48, x: 35, y: 76 },
  { id: "it", name: "Italy", label: "意大利", priority: "P3", score: 52, x: 60, y: 72 },
  { id: "no", name: "Nordics", label: "北欧", priority: "P3", score: 45, x: 63, y: 21 },
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

function sortByTimeDesc(items) {
  return [...items].sort((a, b) => {
    const left = new Date(a.sort_date || a.signal_date || a.document_date || a.approved_at || a.created_at || 0).getTime();
    const right = new Date(b.sort_date || b.signal_date || b.document_date || b.approved_at || b.created_at || 0).getTime();
    return right - left;
  });
}

function inRange(item) {
  if (state.range === "all") return true;
  const raw = item.sort_date || item.signal_date || item.document_date || item.approved_at || item.created_at;
  if (!raw) return true;
  const time = new Date(raw).getTime();
  if (Number.isNaN(time)) return true;
  const days = state.range === "7d" ? 7 : 30;
  return Date.now() - time <= days * 24 * 60 * 60 * 1000;
}

function orgById(id) {
  return state.organizations.find((item) => item.id === id);
}

function isRightsVoice(item) {
  const org = orgById(item.organization_id);
  const tags = `${item.tags || ""} ${item.title || ""} ${item.summary || ""}`.toLowerCase();
  return (
    item.signal_type === "rights_holder_statement" ||
    item.signal_type === "law_firm_statement" ||
    ["rights_org", "cmo", "industry_org"].includes(org?.category) ||
    tags.includes("sacd") ||
    tags.includes("gema") ||
    tags.includes("sgdl") ||
    tags.includes("sne")
  );
}

function docsForJurisdiction(name) {
  return state.documents.filter((item) => item.jurisdiction === name);
}

function intelForJurisdiction(name) {
  return state.intel.filter((item) => item.jurisdiction === name && inRange(item));
}

function caseForJurisdiction(name) {
  return state.cases.filter((item) => item.jurisdiction === name);
}

function getEvidenceItems() {
  if (state.evidence === "official") {
    const documentItems = state.documents.map((doc) => ({
      ...doc,
      evidence_kind: "official",
      priority: doc.confidence === "official" ? "P1" : "P2",
      signal_type: "official_court_document",
      sort_date: doc.document_date || doc.captured_at || doc.created_at,
      source_name: doc.source_id || "官方文书源",
      summary: doc.summary_cn || doc.extracted_text || "官方来源已归档，等待进一步摘要。",
    }));
    const officialIntel = state.intel
      .filter((item) => item.signal_type === "official_court_document")
      .map((item) => ({ ...item, evidence_kind: "official", sort_date: item.signal_date || item.approved_at || item.created_at }));
    return sortByTimeDesc([...officialIntel, ...documentItems]).filter(inRange);
  }

  const filtered = state.intel.filter((item) => {
    if (state.evidence === "news") return item.signal_type === "news";
    return isRightsVoice(item);
  });
  return sortByTimeDesc(filtered.map((item) => ({ ...item, sort_date: item.signal_date || item.approved_at || item.created_at }))).filter(inRange);
}

function renderMetrics() {
  const news = state.intel.filter((item) => item.signal_type === "news").length;
  const official = state.documents.length + state.intel.filter((item) => item.signal_type === "official_court_document").length;
  const rights = state.intel.filter(isRightsVoice).length;
  $("#metricNews").textContent = news;
  $("#metricOfficial").textContent = official;
  $("#metricRights").textContent = rights;

  $("#metrics").innerHTML = [
    ["案件", state.cases.length],
    ["新闻", news],
    ["官方文书", official],
    ["权利人发声", rights],
  ]
    .map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`)
    .join("");
}

function renderMap() {
  const points = jurisdictions
    .map((item) => {
      const intelCount = intelForJurisdiction(item.name).length;
      const caseCount = caseForJurisdiction(item.name).length;
      const docCount = docsForJurisdiction(item.name).length;
      if (caseCount + intelCount + docCount === 0 && item.priority !== "P0") return "";
      const intensity = Math.min(100, item.score + intelCount * 4 + docCount * 6);
      return `
        <button class="map-point ${item.priority}" style="left:${item.x}%; top:${item.y}%;" data-jurisdiction="${item.name}">
          <span>${item.label}</span>
          <strong>${item.priority}</strong>
          <em>${caseCount} 案件 · ${docCount} 文书 · ${intelCount} 情报</em>
          <i style="width:${intensity}%"></i>
        </button>
      `;
    })
    .join("");

  $("#nordicMap").innerHTML = `
    <div class="map-watermark">EUROPE</div>
    <div class="map-shape"></div>
    <div class="map-grid-lines"></div>
    <div class="map-pin official" style="left:58%; top:47%;">EUR-Lex</div>
    <div class="map-pin official" style="left:42%; top:63%;">Judilibre</div>
    ${points}
  `;
}

function renderIntel() {
  const target = $("#intelCards");
  if (!target) return;
  $("#evidenceTitle").textContent = evidenceTitles[state.evidence];
  const cards = getEvidenceItems().filter((item) => state.filter === "all" || item.priority === state.filter);
  target.innerHTML = cards.length
    ? cards
        .map((item) => {
          const title = item.title;
          const summary = item.summary || item.summary_cn || "暂无摘要。";
          const sourceName = item.source_name || item.source_id || "来源待确认";
          const url = item.source_url || "#";
          const jurisdiction = jurisdictionLabels[item.jurisdiction] || item.jurisdiction || "未知法域";
          const date = formatDate(item.sort_date || item.signal_date || item.document_date || item.created_at);
          return `
            <article class="intel-feed-card ${state.evidence}">
              <div class="case-meta">
                ${priorityBadge(item.priority || "P2")}
                <span class="pill type-pill">${signalTypeLabels[item.signal_type] || "官方文书"}</span>
                <span class="pill">${confidenceLabels[item.confidence] || item.confidence || "官方"}</span>
              </div>
              <h3>${title}</h3>
              <p>${summary}</p>
              <div class="meta-list">
                <span>日期：${date}</span>
                <span>法域：${jurisdiction}</span>
              </div>
              <div class="intel-foot">
                <span>${sourceName}</span>
                ${url === "#" ? "<span>已归档</span>" : `<a href="${url}" target="_blank" rel="noreferrer">来源</a>`}
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">当前筛选条件下没有证据卡片。</div>`;
}

function renderCases() {
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

function setEvidence(value) {
  state.evidence = value;
  document.querySelectorAll("[data-evidence]").forEach((item) => item.classList.toggle("active", item.dataset.evidence === value));
  renderIntel();
}

function attachEvents() {
  $(".filters")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    document.querySelectorAll(".filters button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderIntel();
  });

  document.querySelectorAll("[data-evidence]").forEach((button) => {
    button.addEventListener("click", () => setEvidence(button.dataset.evidence));
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

  $("#closeDialog")?.addEventListener("click", () => $("#caseDialog").close());

  $("#runMonitor")?.addEventListener("click", async () => {
    const button = $("#runMonitor");
    button.disabled = true;
    button.textContent = "监控中";
    await api("/api/monitor/run", { method: "POST" });
    await load();
    button.disabled = false;
    button.textContent = "运行监控";
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
