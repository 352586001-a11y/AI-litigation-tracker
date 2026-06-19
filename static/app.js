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
  legislation_update: "立法动态",
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
  legislation: "立法动态有哪些",
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function safeUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "#";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return "#";
}

function priorityBadge(priority) {
  return `<span class="badge ${escapeHtml(priority)}">${escapeHtml(priority)}</span>`;
}

function formatDate(value) {
  if (!value) return "无日期";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function sortDate(item) {
  return item.sort_date || item.signal_date || item.document_date || item.captured_at || item.approved_at || item.created_at || 0;
}

function sortByTimeDesc(items) {
  return [...items].sort((a, b) => new Date(sortDate(b)).getTime() - new Date(sortDate(a)).getTime());
}

function inRange(item) {
  if (state.range === "all") return true;
  const time = new Date(sortDate(item)).getTime();
  if (Number.isNaN(time)) return true;
  const days = state.range === "7d" ? 7 : 30;
  return Date.now() - time <= days * 24 * 60 * 60 * 1000;
}

function orgById(id) {
  return state.organizations.find((item) => item.id === id);
}

function signalHaystack(item) {
  return `${item.tags || ""} ${item.title || ""} ${item.summary || ""} ${item.source_name || ""}`.toLowerCase();
}

function isRightsVoice(item) {
  const org = orgById(item.organization_id);
  const haystack = signalHaystack(item);
  return (
    item.signal_type === "rights_holder_statement" ||
    item.signal_type === "law_firm_statement" ||
    ["rights_org", "cmo", "industry_org", "publisher"].includes(org?.category) ||
    haystack.includes("sacd") ||
    haystack.includes("figaro") ||
    haystack.includes("gema") ||
    haystack.includes("sgdl") ||
    haystack.includes("sne")
  );
}

function isLegislationSignal(item) {
  const haystack = signalHaystack(item);
  return (
    item.signal_type === "legislation_update" ||
    haystack.includes("ai act") ||
    haystack.includes("gpai") ||
    haystack.includes("tdm") ||
    haystack.includes("text and data mining") ||
    haystack.includes("opt-out") ||
    haystack.includes("eur-lex") ||
    haystack.includes("legislation") ||
    haystack.includes("proposition de loi")
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

function getOfficialEvidence() {
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

function getEvidenceItems() {
  if (state.evidence === "official") return getOfficialEvidence();

  const filtered = state.intel.filter((item) => {
    if (state.evidence === "news") return item.signal_type === "news";
    if (state.evidence === "rights") return isRightsVoice(item);
    return isLegislationSignal(item);
  });

  return sortByTimeDesc(filtered.map((item) => ({ ...item, sort_date: item.signal_date || item.approved_at || item.created_at }))).filter(inRange);
}

function renderMetrics() {
  const news = state.intel.filter((item) => item.signal_type === "news").length;
  const official = state.documents.length + state.intel.filter((item) => item.signal_type === "official_court_document").length;
  const rights = state.intel.filter(isRightsVoice).length;
  const legislation = state.intel.filter(isLegislationSignal).length;

  $("#metricNews").textContent = news;
  $("#metricOfficial").textContent = official;
  $("#metricRights").textContent = rights;
  $("#metricLegislation").textContent = legislation;

  $("#metrics").innerHTML = [
    ["案件", state.cases.length],
    ["新闻", news],
    ["官方文书", official],
    ["权利人发声", rights],
    ["立法动态", legislation],
  ]
    .map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${value}</strong></article>`)
    .join("");
}

function renderMap() {
  const points = jurisdictions
    .map((item) => {
      const intelItems = intelForJurisdiction(item.name);
      const caseCount = caseForJurisdiction(item.name).length;
      const docCount = docsForJurisdiction(item.name).length;
      const intelCount = intelItems.length;
      const legislationCount = intelItems.filter(isLegislationSignal).length;
      if (caseCount + intelCount + docCount === 0 && item.priority !== "P0") return "";
      const intensity = Math.min(100, item.score + intelCount * 4 + docCount * 6 + legislationCount * 3);
      return `
        <button class="map-point ${escapeHtml(item.priority)}" style="left:${item.x}%; top:${item.y}%;" data-jurisdiction="${escapeHtml(item.name)}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.priority)}</strong>
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
    ? cards.map(renderIntelCard).join("")
    : `<div class="empty-state">当前筛选条件下没有证据卡片。</div>`;
}

function renderIntelCard(item) {
  const sourceUrl = safeUrl(item.source_url);
  const sourceName = item.source_name || item.source_id || "来源待确认";
  const jurisdiction = jurisdictionLabels[item.jurisdiction] || item.jurisdiction || "未知法域";
  const signalType = signalTypeLabels[item.signal_type] || "情报";
  const date = formatDate(sortDate(item));
  return `
    <article class="intel-feed-card ${escapeHtml(state.evidence)}">
      <div class="case-meta">
        ${priorityBadge(item.priority || "P2")}
        <span class="pill type-pill">${escapeHtml(signalType)}</span>
        <span class="pill">${escapeHtml(confidenceLabels[item.confidence] || item.confidence || "待确认")}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary || item.summary_cn || "暂无摘要。")}</p>
      <div class="meta-list">
        <span>日期：${escapeHtml(date)}</span>
        <span>法域：${escapeHtml(jurisdiction)}</span>
      </div>
      <div class="intel-foot">
        <span>${escapeHtml(sourceName)}</span>
        ${sourceUrl === "#" ? "<span>已归档</span>" : `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">来源</a>`}
      </div>
    </article>
  `;
}

function renderCases() {
  $("#cases").innerHTML = state.cases
    .map(
      (item) => `
        <article class="case-card" data-case-id="${escapeHtml(item.id)}">
          <div class="case-meta">
            ${priorityBadge(item.priority)}
            <span class="pill">${escapeHtml(statusLabels[item.status] || item.status)}</span>
            <span class="pill">${escapeHtml(jurisdictionLabels[item.jurisdiction] || item.jurisdiction)}</span>
            <span class="pill">${Number(item.document_count || 0)} 文书</span>
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary)}</p>
          <div class="risk-bar"><span style="width:${Number(item.risk_score || 0)}%"></span></div>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".case-card").forEach((card) => {
    card.addEventListener("click", () => showCase(card.dataset.caseId));
  });
}

function renderCaseEvidence(item) {
  const documentEvidence = (item.documents || []).map((doc) => ({
    title: doc.title,
    summary: doc.summary_cn || doc.extracted_text || "官方文书已归档。",
    source_name: doc.source_id || "官方文书",
    source_url: doc.source_url,
    priority: doc.confidence === "official" ? "P1" : "P2",
    signal_type: "official_court_document",
    confidence: doc.confidence,
    sort_date: doc.document_date || doc.captured_at || doc.created_at,
  }));
  const intelEvidence = (item.intelligence || []).map((card) => ({
    ...card,
    sort_date: card.signal_date || card.approved_at || card.created_at,
  }));
  const timeline = sortByTimeDesc([...documentEvidence, ...intelEvidence]);
  if (!timeline.length) return `<div class="empty-state">这个监控对象暂时还没有可展示的证据链。</div>`;
  return timeline
    .map((entry) => {
      const sourceUrl = safeUrl(entry.source_url);
      const signalType = signalTypeLabels[entry.signal_type] || "情报";
      return `
        <article class="case-evidence">
          <div class="case-meta">
            ${priorityBadge(entry.priority || "P2")}
            <span class="pill type-pill">${escapeHtml(signalType)}</span>
            <span class="pill">${escapeHtml(formatDate(sortDate(entry)))}</span>
          </div>
          <h4>${escapeHtml(entry.title)}</h4>
          <p>${escapeHtml(entry.summary || "暂无摘要。")}</p>
          <div class="intel-foot">
            <span>${escapeHtml(entry.source_name || "来源待确认")}</span>
            ${sourceUrl === "#" ? "<span>已归档</span>" : `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">打开来源</a>`}
          </div>
        </article>
      `;
    })
    .join("");
}

async function showCase(caseId) {
  const item = await api(`/api/cases/${encodeURIComponent(caseId)}`);
  $("#caseDetail").innerHTML = `
    <div class="case-meta">
      ${priorityBadge(item.priority)}
      <span class="pill">${escapeHtml(statusLabels[item.status] || item.status)}</span>
      <span class="pill">${escapeHtml(item.procedural_stage)}</span>
      <span class="pill">风险 ${Number(item.risk_score || 0)}</span>
    </div>
    <h2>${escapeHtml(item.title)}</h2>
    <p>${escapeHtml(item.summary)}</p>
    <div class="detail-block">
      <h3>法院与标识</h3>
      <p>${escapeHtml(item.court || "待确认")} · ${escapeHtml(item.case_number || "无案号")} · ${escapeHtml(item.ecli || "无 ECLI")}</p>
    </div>
    <div class="detail-block">
      <h3>权利主体</h3>
      <p>${escapeHtml((item.organizations || []).map((org) => `${org.name} (${org.role})`).join(", ") || "未绑定")}</p>
    </div>
    <div class="detail-block">
      <h3>聚合证据链</h3>
      <div class="case-evidence-list">${renderCaseEvidence(item)}</div>
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
    try {
      await api("/api/monitor/run", { method: "POST" });
      await load();
    } finally {
      button.disabled = false;
      button.textContent = "运行监控";
    }
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
  document.body.innerHTML = `<main><h1>加载失败</h1><pre>${escapeHtml(error.message)}</pre></main>`;
});
