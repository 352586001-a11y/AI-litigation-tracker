const state = {
  cases: [],
  organizations: [],
  documents: [],
  intel: [],
  filter: "all",
  typeFilter: "all",
};

const signalTypeLabels = {
  news: "\u65b0\u95fb",
  law_firm_statement: "\u5f8b\u6240\u8868\u6001",
  rights_holder_statement: "\u6743\u5229\u4eba\u58f0\u660e",
  official_court_document: "\u5b98\u65b9\u6587\u4ef6/\u6cd5\u9662\u6587\u4e66",
};

const jurisdictionLabels = {
  France: "\u6cd5\u56fd",
  Germany: "\u5fb7\u56fd",
  "European Union": "\u6b27\u76df",
  "United Kingdom": "\u82f1\u56fd",
  Netherlands: "\u8377\u5170",
  Spain: "\u897f\u73ed\u7259",
  Italy: "\u610f\u5927\u5229",
  Nordics: "\u5317\u6b27",
  "EU / CJEU": "\u6b27\u76df / \u6b27\u76df\u6cd5\u9662",
};

const statusLabels = {
  WATCH: "\u76d1\u63a7\u4e2d",
  LEAD: "\u7ebf\u7d22",
  CASE: "\u6848\u4ef6",
  CLOSED: "\u5df2\u7ed3\u675f",
};

const confidenceLabels = {
  official: "\u5b98\u65b9",
  semi_official: "\u534a\u5b98\u65b9",
  media_lead: "\u5a92\u4f53\u7ebf\u7d22",
};

const jurisdictions = [
  {
    name: "France",
    priority: "P0",
    score: 97,
    drivers: ["SACD", "Le Figaro", "\u5df4\u9ece\u6cd5\u9662", "Judilibre"],
    summary: "\u521b\u4f5c\u8005\u7ec4\u7ec7\u548c\u65b0\u95fb\u51fa\u7248\u6743\u5229\u4eba\u53cc P0\uff0c\u5b98\u65b9\u6587\u4e66\u548c\u8206\u60c5\u90fd\u9700\u8981\u65e5\u7ea7\u76d1\u63a7\u3002",
  },
  {
    name: "EU / CJEU",
    priority: "P1",
    score: 84,
    drivers: ["AI Act", "TDM opt-out", "\u6b27\u76df\u6cd5\u9662"],
    summary: "\u5f71\u54cd\u5168\u6b27\u7684\u89e3\u91ca\u5c42\uff1a\u8bad\u7ec3\u6570\u636e\u900f\u660e\u5ea6\u3001TDM \u4f8b\u5916\u3001opt-out \u5408\u89c4\u3002",
  },
  {
    name: "Germany",
    priority: "P2",
    score: 67,
    drivers: ["\u51fa\u7248\u5546", "\u56fe\u50cf\u6743\u5229", "\u6570\u636e\u5e93\u6743"],
    summary: "\u5173\u6ce8\u51fa\u7248\u5546\u3001\u56fe\u7247\u6743\u5229\u4eba\u548c\u6570\u636e\u5e93\u6743\u8def\u5f84\u3002",
  },
  {
    name: "United Kingdom",
    priority: "P2",
    score: 70,
    drivers: ["\u65b0\u95fb\u8bed\u6599", "\u56fe\u50cf\u6743\u5229", "\u6388\u6743"],
    summary: "\u867d\u975e EU\uff0c\u4f46\u4f1a\u5f71\u54cd\u6b27\u6d32\u6388\u6743\u5e02\u573a\u548c\u5e73\u53f0\u7b56\u7565\u3002",
  },
  {
    name: "Netherlands",
    priority: "P2",
    score: 61,
    drivers: ["\u5e73\u53f0\u7ba1\u8f96", "\u6293\u53d6", "\u6258\u7ba1"],
    summary: "\u8de8\u5883\u5e73\u53f0\u3001\u6293\u53d6\u548c\u7ba1\u8f96\u98ce\u9669\u76d1\u63a7\u3002",
  },
  {
    name: "Spain",
    priority: "P3",
    score: 48,
    drivers: ["\u5a92\u4f53\u96c6\u56e2", "\u6b27\u76df\u843d\u5730"],
    summary: "\u4ee5\u5a92\u4f53\u6743\u5229\u4eba\u4e0e\u6b27\u76df\u5b9e\u65bd\u52a8\u6001\u4e3a\u4e3b\u3002",
  },
  {
    name: "Italy",
    priority: "P3",
    score: 52,
    drivers: ["\u51fa\u7248\u5546", "\u76d1\u7ba1\u673a\u6784", "\u6587\u5316\u884c\u4e1a"],
    summary: "\u5173\u6ce8\u51fa\u7248\u3001\u76d1\u7ba1\u58f0\u660e\u548c\u6587\u5316\u5185\u5bb9\u6388\u6743\u3002",
  },
  {
    name: "Nordics",
    priority: "P3",
    score: 45,
    drivers: ["\u96c6\u4f53\u7ba1\u7406\u7ec4\u7ec7", "\u5a92\u4f53\u8054\u76df", "\u653f\u7b56"],
    summary: "\u7248\u6743\u7ec4\u7ec7\u548c\u5a92\u4f53\u8054\u76df\u4fe1\u53f7\u76d1\u63a7\u3002",
  },
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
  if (!value) return "\u65e0\u65e5\u671f";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function renderMetrics() {
  const p0 = state.organizations.filter((item) => item.priority === "P0").length;
  const officialDocs = state.documents.filter((item) => item.confidence === "official").length;
  const avgRisk = Math.round(
    state.cases.reduce((sum, item) => sum + item.risk_score, 0) / Math.max(state.cases.length, 1)
  );
  $("#metrics").innerHTML = [
    ["P0 \u6700\u9ad8\u98ce\u9669", p0],
    ["\u5df2\u53d1\u5e03\u7b80\u62a5", state.intel.length],
    ["\u5b98\u65b9\u6587\u4e66", officialDocs],
    ["\u5e73\u5747\u98ce\u9669", avgRisk],
  ]
    .map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function countForJurisdiction(collection, name) {
  if (name === "EU / CJEU") return collection.filter((item) => item.jurisdiction === "European Union").length;
  return collection.filter((item) => item.jurisdiction === name).length;
}

function latestForJurisdiction(collection, name) {
  const normalized = name === "EU / CJEU" ? "European Union" : name;
  return collection.find((item) => item.jurisdiction === normalized);
}

function renderMap(container, mode) {
  if (!container) return;
  const isIntel = mode === "intel";
  const source = isIntel ? state.intel : state.cases;
  container.innerHTML = jurisdictions
    .map((item, index) => {
      const count = countForJurisdiction(source, item.name);
      const latest = isIntel ? latestForJurisdiction(state.intel, item.name) : null;
      const metric = isIntel ? count : item.score;
      return `
        <article class="map-tile ${item.priority}" style="--x:${18 + (index % 4) * 25}%; --y:${22 + Math.floor(index / 4) * 42}%">
          <div class="risk-cell-head">
            <h3>${jurisdictionLabels[item.name] || item.name}</h3>
            ${priorityBadge(item.priority)}
          </div>
          <div class="score-row">
            <strong>${metric}</strong>
            <div class="risk-bar"><span style="width:${isIntel ? Math.min(count * 30, 100) : item.score}%"></span></div>
          </div>
          <p>${isIntel ? `${count} \u6761\u5df2\u53d1\u5e03\u60c5\u62a5${latest ? `\uff0c\u6700\u65b0 ${formatDate(latest.signal_date || latest.approved_at || latest.created_at)}` : ""}` : item.summary}</p>
          <div class="driver-list">
            ${(isIntel ? ["\u65b0\u95fb", "\u5f8b\u6240", "\u6743\u5229\u4eba", "\u5b98\u65b9\u6587\u4ef6"] : item.drivers).map((driver) => `<span>${driver}</span>`).join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderP0Targets() {
  const p0 = state.organizations.filter((org) => org.priority === "P0");
  $("#p0Targets").innerHTML = p0
    .map(
      (org) => `
        <article class="target-card">
          <div>
            <h3>${org.name}</h3>
            <p>${org.notes}</p>
          </div>
          <strong>${org.risk_score}</strong>
        </article>
      `
    )
    .join("");
}

function renderIntel() {
  const cards = state.intel.filter((item) => {
    const priorityMatch = state.filter === "all" || item.priority === state.filter;
    const typeMatch = state.typeFilter === "all" || item.signal_type === state.typeFilter;
    return priorityMatch && typeMatch;
  });
  $("#intelCards").innerHTML = cards
    .map(
      (item) => `
        <article class="intel-card">
          <div class="case-meta">
            ${priorityBadge(item.priority)}
            <span class="pill type-pill">${signalTypeLabels[item.signal_type] || item.signal_type}</span>
            <span class="pill">${confidenceLabels[item.confidence] || item.confidence}</span>
            <span class="pill">${jurisdictionLabels[item.jurisdiction] || item.jurisdiction}</span>
            <span class="pill">+${item.risk_delta}</span>
          </div>
          <h3>${item.title}</h3>
          <p>${item.summary}</p>
          <div class="intel-foot">
            <span>${formatDate(item.signal_date || item.approved_at || item.created_at)} · ${item.organization_name || item.source_name}</span>
            <a href="${item.source_url}" target="_blank" rel="noreferrer">\u6765\u6e90</a>
          </div>
        </article>
      `
    )
    .join("");
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
            <span class="pill">${item.document_count} docs</span>
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
      <span class="pill">${item.status}</span>
      <span class="pill">${item.procedural_stage}</span>
      <span class="pill">Risk ${item.risk_score}</span>
    </div>
    <h2>${item.title}</h2>
    <p>${item.summary}</p>
    <div class="detail-block">
      <h3>\u6cd5\u9662\u4e0e\u6807\u8bc6</h3>
      <p>${item.court || "\u5f85\u786e\u8ba4"} · ${item.case_number || "\u65e0\u6848\u53f7"} · ${item.ecli || "\u65e0 ECLI"}</p>
    </div>
    <div class="detail-block">
      <h3>\u6743\u5229\u4e3b\u4f53</h3>
      <p>${item.organizations.map((org) => `${org.name} (${org.role})`).join(", ") || "\u672a\u7ed1\u5b9a"}</p>
    </div>
    <div class="detail-block">
      <h3>\u5b98\u65b9\u6587\u4e66</h3>
      <p>${item.documents.length ? item.documents.map((doc) => doc.title).join(", ") : "\u6682\u65e0\u6848\u4ef6\u6587\u4e66\uff0c\u4fdd\u6301\u76d1\u63a7\u3002"}</p>
    </div>
  `;
  $("#caseDialog").showModal();
}

function attachEvents() {
  $(".filters").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    document.querySelectorAll(".filters button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderIntel();
  });

  $(".type-filters").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-type-filter]");
    if (!button) return;
    state.typeFilter = button.dataset.typeFilter;
    document.querySelectorAll(".type-filters button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderIntel();
  });

  $("#closeDialog").addEventListener("click", () => $("#caseDialog").close());

  $("#runMonitor").addEventListener("click", async () => {
    $("#runMonitor").disabled = true;
    $("#runMonitor").textContent = "\u76d1\u63a7\u4e2d";
    await api("/api/monitor/run", { method: "POST" });
    await load();
    $("#runMonitor").disabled = false;
    $("#runMonitor").textContent = "\u8fd0\u884c\u76d1\u63a7";
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
  renderMap($("#litigationMap"), "litigation");
  renderMap($("#intelMap"), "intel");
  renderP0Targets();
  renderIntel();
  renderCases();
}

attachEvents();
load().catch((error) => {
  document.body.innerHTML = `<main><h1>\u52a0\u8f7d\u5931\u8d25</h1><pre>${error.message}</pre></main>`;
});
