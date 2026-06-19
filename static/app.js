const state = {
  cases: [],
  organizations: [],
  documents: [],
  intel: [],
  sources: [],
  filter: "all",
  evidence: "litigation",
  range: "all",
  selectedJurisdiction: null,
  lastUpdated: null,
  refreshMs: 60000,
  nextRefreshAt: null,
};

const signalTypeLabels = {
  news: "新闻",
  law_firm_statement: "律所表态",
  rights_holder_statement: "权利人声明",
  official_court_document: "官方文件/法院文书",
  legislation_update: "立法动态",
};

const layerLabels = {
  litigation: "诉讼层",
  official: "官方文书层",
  rights: "权利人发声层",
  legislation: "立法动态层",
};

const jurisdictionLabels = {
  France: "法国",
  Germany: "德国",
  "European Union": "欧盟",
  "United Kingdom": "英国",
  Denmark: "丹麦",
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

const sourceTypeLabels = {
  official_api: "官方 API",
  official_portal: "官方门户",
  official_database: "官方库",
  official_site: "官网",
  publisher_site: "出版方",
  law_firm_tracker: "法律跟踪器",
  news_index: "新闻索引",
  rights_holder_monitor: "权利人监控",
  official_rss: "官方 RSS",
  policy_monitor: "政策监控",
};

const evidenceTitles = {
  litigation: "诉讼动态有哪些",
  official: "官方诉讼文书有哪些",
  rights: "权利人官方声明与表态",
  legislation: "立法动态有哪些",
};

const litigationKeywords = [
  "lawsuit",
  "sue",
  "sued",
  "sues",
  "court",
  "tribunal",
  "judgment",
  "ruling",
  "damages",
  "injunction",
  "appeal",
  "complaint",
  "claim",
  "case",
  " v. ",
  " v ",
  "procès",
  "plainte",
  "tribunal judiciaire",
  "cour",
  "klage",
  "gericht",
  "起诉",
  "法院",
  "判决",
  "裁定",
  "赔偿",
  "禁令",
];

const rightsStatementKeywords = [
  "statement",
  "position",
  "declaration",
  "déclaration",
  "calls",
  "urges",
  "demands",
  "open letter",
  "licensing",
  "license",
  "opt-out",
  "remuneration",
  "compensation",
  "creator",
  "authors",
  "publishers",
  "声明",
  "表态",
  "立场",
  "呼吁",
  "要求",
  "授权",
  "许可",
  "报酬",
  "补偿",
  "创作者",
  "作者",
  "出版商",
  "集体",
];

const jurisdictions = [
  { id: "fr", name: "France", label: "法国", priority: "P0", score: 97, x: 40, y: 60 },
  { id: "eu", name: "European Union", label: "欧盟", priority: "P1", score: 84, x: 76, y: 38 },
  { id: "de", name: "Germany", label: "德国", priority: "P1", score: 78, x: 59, y: 55 },
  { id: "uk", name: "United Kingdom", label: "英国", priority: "P2", score: 70, x: 30, y: 41 },
  { id: "dk", name: "Denmark", label: "丹麦", priority: "P1", score: 72, x: 53, y: 24 },
  { id: "nl", name: "Netherlands", label: "荷兰", priority: "P2", score: 61, x: 48, y: 36 },
  { id: "es", name: "Spain", label: "西班牙", priority: "P3", score: 48, x: 35, y: 76 },
  { id: "it", name: "Italy", label: "意大利", priority: "P3", score: 52, x: 66, y: 72 },
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
  return url.startsWith("http://") || url.startsWith("https://") ? url : "#";
}

function priorityBadge(priority) {
  return `<span class="badge ${escapeHtml(priority)}">${escapeHtml(priority)}</span>`;
}

function displaySignalType(item) {
  if (isOfficialDocumentSignal(item)) return "官方文书";
  if (isLitigationSignal(item)) return "诉讼动态";
  if (isRightsVoice(item)) return "权利人发声";
  if (isLegislationSignal(item)) return "立法动态";
  return signalTypeLabels[item.signal_type] || "情报";
}

function formatDate(value) {
  if (!value) return "无日期";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatTime(value) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function daysAgo(value) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000)));
}

function freshnessLabel(value) {
  const days = daysAgo(value);
  if (days === null) return "待核时";
  if (days === 0) return "今日";
  if (days <= 7) return `${days} 天内`;
  if (days <= 30) return `${days} 天前`;
  return "";
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

function inSelectedJurisdiction(item) {
  return !state.selectedJurisdiction || item.jurisdiction === state.selectedJurisdiction;
}

function orgById(id) {
  return state.organizations.find((item) => item.id === id);
}

function caseById(id) {
  return state.cases.find((item) => item.id === id);
}

function signalHaystack(item) {
  return `${item.tags || ""} ${item.title || ""} ${item.summary || ""} ${item.source_name || ""}`.toLowerCase();
}

function hasAnyKeyword(haystack, keywords) {
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function hasLitigationCase(item) {
  const relatedCase = caseById(item.case_id);
  return Boolean(relatedCase && ["CASE", "LEAD"].includes(relatedCase.status));
}

function isOfficialDocumentSignal(item) {
  return item.signal_type === "official_court_document" || item.evidence_kind === "official";
}

function isLitigationSignal(item) {
  if (isOfficialDocumentSignal(item)) return false;
  if (hasLitigationCase(item)) return true;
  if (isLegislationSignal(item)) return false;
  return hasAnyKeyword(signalHaystack(item), litigationKeywords);
}

function isRightsVoice(item) {
  if (isOfficialDocumentSignal(item) || isLegislationSignal(item) || isLitigationSignal(item)) return false;
  const org = orgById(item.organization_id);
  const haystack = signalHaystack(item);
  const isRightsOrganization = ["rights_org", "cmo", "industry_org", "publisher"].includes(org?.category);
  const isOfficialSource = ["official_site", "publisher_site"].includes(item.source_type);
  return (
    item.signal_type === "rights_holder_statement" ||
    ((isRightsOrganization || isOfficialSource) && hasAnyKeyword(haystack, rightsStatementKeywords))
  );
}

function isLegislationSignal(item) {
  if (isOfficialDocumentSignal(item)) return false;
  if (hasLitigationCase(item)) return false;
  if (item.signal_type === "rights_holder_statement") return false;
  const haystack = signalHaystack(item);
  return (
    item.signal_type === "legislation_update" ||
    haystack.includes("ai act") ||
    haystack.includes("gpai") ||
    haystack.includes("tdm") ||
    haystack.includes("text and data mining") ||
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
  return sortByTimeDesc([...officialIntel, ...documentItems]).filter(inRange).filter(inSelectedJurisdiction);
}

function getEvidenceItems(layer = state.evidence) {
  if (layer === "official") return getOfficialEvidence();

  const filtered = state.intel.filter((item) => {
    if (layer === "litigation") return isLitigationSignal(item);
    if (layer === "rights") return isRightsVoice(item);
    return isLegislationSignal(item);
  });

  return sortByTimeDesc(filtered.map((item) => ({ ...item, sort_date: item.signal_date || item.approved_at || item.created_at })))
    .filter(inRange)
    .filter(inSelectedJurisdiction);
}

function getAllSignals() {
  const documentSignals = state.documents.map((doc) => ({
    ...doc,
    title: doc.title,
    summary: doc.summary_cn || doc.extracted_text || "官方文书已归档。",
    source_name: doc.source_id || "官方文书源",
    priority: doc.confidence === "official" ? "P1" : "P2",
    signal_type: "official_court_document",
    sort_date: doc.document_date || doc.captured_at || doc.created_at,
  }));
  const intelSignals = state.intel.map((item) => ({ ...item, sort_date: item.signal_date || item.approved_at || item.created_at }));
  return sortByTimeDesc([...intelSignals, ...documentSignals]).filter(inRange);
}

function renderMetrics() {
  const litigation = state.intel.filter(isLitigationSignal).length;
  const official = state.documents.length + state.intel.filter((item) => item.signal_type === "official_court_document").length;
  const rights = state.intel.filter(isRightsVoice).length;
  const legislation = state.intel.filter(isLegislationSignal).length;

  $("#metricNews").textContent = litigation;
  $("#metricOfficial").textContent = official;
  $("#metricRights").textContent = rights;
  $("#metricLegislation").textContent = legislation;
  const recentSignals = getAllSignals().filter((item) => {
    const time = new Date(sortDate(item)).getTime();
    return !Number.isNaN(time) && Date.now() - time <= 30 * 24 * 60 * 60 * 1000;
  });
  const configuredSources = state.sources.filter((item) => item.configured).length;

  $("#metrics").innerHTML = [
    ["案件", state.cases.length],
    ["P0 对象", state.cases.filter((item) => item.priority === "P0").length],
    ["情报卡", state.intel.length],
    ["官方文书", official],
    ["30天信号", recentSignals.length],
    ["最近更新", state.lastUpdated ? formatTime(state.lastUpdated) : "--:--"],
  ]
    .map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`)
    .join("");
  $("#sourceCoverage").textContent = `源 ${configuredSources}/${state.sources.length}`;
  $("#recentSignalCount").textContent = `${recentSignals.length} 条 / 30 天`;
  $("#liveHeadline").textContent = getAllSignals()[0]?.title || "等待情报同步";
}

function renderMap() {
  const points = jurisdictions
    .map((item) => {
      const intelItems = intelForJurisdiction(item.name);
      const caseCount = caseForJurisdiction(item.name).length;
      const docCount = docsForJurisdiction(item.name).length;
      const intelCount = intelItems.length;
      const legislationCount = intelItems.filter(isLegislationSignal).length;
      const isActive = state.selectedJurisdiction === item.name;
      if (caseCount + intelCount + docCount === 0 && item.priority !== "P0") return "";
      const intensity = Math.min(100, item.score + intelCount * 4 + docCount * 6 + legislationCount * 3);
      return `
        <button class="wm-map-point ${escapeHtml(item.priority)} ${isActive ? "active" : ""}" style="left:${item.x}%; top:${item.y}%;" data-jurisdiction="${escapeHtml(item.name)}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.priority)}</strong>
          <em>${caseCount} 案件 · ${docCount} 文书 · ${intelCount} 信号</em>
          <i style="width:${intensity}%"></i>
        </button>
      `;
    })
    .join("");

  $("#nordicMap").innerHTML = `
    <div class="wm-grid"></div>
    <div class="wm-scan"></div>
    <div class="wm-radar-ring one"></div>
    <div class="wm-radar-ring two"></div>
    <div class="wm-map-label">EUROPE</div>
    <div class="wm-europe-shape"></div>
    <div class="wm-route r1"></div>
    <div class="wm-route r2"></div>
    <div class="wm-route r3"></div>
    <div class="wm-source-pin" style="left:58%; top:47%;">EUR-Lex</div>
    <div class="wm-source-pin" style="left:42%; top:63%;">Judilibre</div>
    <div class="wm-source-pin" style="left:44%; top:55%;">SACD</div>
    <div class="wm-source-pin" style="left:46%; top:54%;">Figaro</div>
    <div class="wm-source-pin" style="left:38%; top:52%;">SNE</div>
    <div class="wm-source-pin" style="left:56%; top:30%;">Koda</div>
    ${points}
  `;

  document.querySelectorAll(".wm-map-point").forEach((point) => {
    point.addEventListener("click", () => {
      state.selectedJurisdiction = point.dataset.jurisdiction;
      updateSelectedJurisdiction();
      renderAll();
    });
  });
}

function renderIntel() {
  const target = $("#intelCards");
  if (!target) return;
  $("#evidenceTitle").textContent = evidenceTitles[state.evidence];
  const cards = getEvidenceItems().filter((item) => state.filter === "all" || item.priority === state.filter);
  target.innerHTML = cards.length
    ? cards.slice(0, 40).map(renderIntelCard).join("")
    : `<div class="empty-state">当前筛选条件下没有证据卡片。</div>`;
}

function renderIntelCard(item) {
  const sourceUrl = safeUrl(item.source_url);
  const sourceName = item.source_name || item.source_id || "来源待确认";
  const jurisdiction = jurisdictionLabels[item.jurisdiction] || item.jurisdiction || "未知法域";
  const signalType = displaySignalType(item);
  const date = formatDate(sortDate(item));
  const fresh = freshnessLabel(sortDate(item));
  return `
    <article class="wm-intel-card ${escapeHtml(item.priority || "P2")}">
      <div class="case-meta">
        ${priorityBadge(item.priority || "P2")}
        <span class="pill type-pill">${escapeHtml(signalType)}</span>
        <span class="pill">${escapeHtml(confidenceLabels[item.confidence] || item.confidence || "待确认")}</span>
        ${fresh ? `<span class="pill fresh-pill">${escapeHtml(fresh)}</span>` : ""}
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
  const visibleCases = state.cases.filter((item) => !state.selectedJurisdiction || item.jurisdiction === state.selectedJurisdiction);
  $("#cases").innerHTML = visibleCases
    .map(
      (item) => `
        <article class="wm-case-card" data-case-id="${escapeHtml(item.id)}">
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

  document.querySelectorAll(".wm-case-card").forEach((card) => {
    card.addEventListener("click", () => showCase(card.dataset.caseId));
  });
}

function renderSources() {
  const target = $("#sourceStack");
  if (!target) return;
  const sourceItems = state.sources.length ? state.sources : [];
  target.innerHTML = sourceItems
    .sort((a, b) => Number(b.configured) - Number(a.configured) || String(a.jurisdiction).localeCompare(String(b.jurisdiction)))
    .slice(0, 14)
    .map((source) => {
      const checked = source.last_checked_at ? formatDate(source.last_checked_at) : "未检查";
      return `
        <article class="wm-source-item ${source.configured ? "configured" : "pending"}">
          <span>${escapeHtml(source.name)}</span>
          <strong>${source.configured ? "已接入" : "待凭证"}</strong>
          <small>${escapeHtml(sourceTypeLabels[source.source_type] || source.source_type || "来源")}</small>
          <em>${escapeHtml(checked)}</em>
        </article>
      `;
    })
    .join("") || `<div class="empty-state">源状态加载中。</div>`;
}

function renderTimeline() {
  const target = $("#timelineItems");
  if (!target) return;
  const signals = getAllSignals().filter(inSelectedJurisdiction).slice(0, 14);
  target.innerHTML = signals
    .map((item) => {
      const signalType = displaySignalType(item);
      return `
        <button class="wm-timeline-item ${escapeHtml(item.priority || "P2")}" title="${escapeHtml(item.title)}">
          <span>${escapeHtml(formatDate(sortDate(item)))}</span>
          <strong>${escapeHtml(signalType)}</strong>
          <em>${escapeHtml((item.title || "").slice(0, 36))}</em>
        </button>
      `;
    })
    .join("") || `<div class="empty-state">暂无时间线信号。</div>`;
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
      const signalType = displaySignalType(entry);
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

function updateSelectedJurisdiction() {
  const label = state.selectedJurisdiction ? jurisdictionLabels[state.selectedJurisdiction] || state.selectedJurisdiction : "全欧洲视图";
  $("#activeJurisdiction").textContent = label;
}

function updateClock() {
  const now = new Date();
  $("#systemClock").textContent = `${now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} 本地`;
  if (state.nextRefreshAt) {
    const seconds = Math.max(0, Math.ceil((state.nextRefreshAt - Date.now()) / 1000));
    $("#refreshStatus").textContent = seconds ? `下次同步 ${seconds}s` : "正在同步";
  }
}

function setEvidence(value) {
  state.evidence = value;
  $("#activeLayerName").textContent = layerLabels[value] || value;
  $("#liveWindow").textContent = state.range === "all" ? "全部时间" : state.range === "7d" ? "最近 7 天" : "最近 30 天";
  document.querySelectorAll("[data-evidence]").forEach((item) => item.classList.toggle("active", item.dataset.evidence === value));
  renderAll();
}

function renderAll() {
  renderMetrics();
  renderMap();
  renderIntel();
  renderCases();
  renderSources();
  renderTimeline();
  updateSelectedJurisdiction();
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
      $("#liveWindow").textContent = state.range === "all" ? "全部时间" : state.range === "7d" ? "最近 7 天" : "最近 30 天";
      renderAll();
    });
  });

  $("#resetJurisdiction")?.addEventListener("click", () => {
    state.selectedJurisdiction = null;
    renderAll();
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
  $("#refreshStatus").textContent = "正在同步";
  const [cases, organizations, documents, intel, sources] = await Promise.all([
    api("/api/cases"),
    api("/api/organizations"),
    api("/api/documents"),
    api("/api/intel?status=published"),
    api("/api/source-health").catch(() => []),
  ]);
  state.cases = cases;
  state.organizations = organizations;
  state.documents = documents;
  state.intel = intel;
  state.sources = sources;
  state.lastUpdated = new Date().toISOString();
  state.nextRefreshAt = Date.now() + state.refreshMs;
  $("#refreshStatus").textContent = `同步完成 ${formatTime(state.lastUpdated)}`;
  renderAll();
}

attachEvents();
updateClock();
setInterval(updateClock, 1000);
load().catch((error) => {
  document.body.innerHTML = `<main><h1>加载失败</h1><pre>${escapeHtml(error.message)}</pre></main>`;
});
setInterval(() => {
  load().catch(() => {});
}, state.refreshMs);
