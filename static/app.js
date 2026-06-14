const state = {
  cases: [],
  organizations: [],
  documents: [],
  intel: [],
  filter: "all",
  typeFilter: "all",
};

const signalTypeLabels = {
  news: "新闻",
  law_firm_statement: "律所表态",
  rights_holder_statement: "权利人声明",
  official_court_document: "官方法院文件",
};

const jurisdictions = [
  {
    name: "France",
    priority: "P0",
    score: 97,
    drivers: ["SACD", "Le Figaro", "Paris court", "Judilibre"],
    summary: "创作者组织和新闻出版权利人双 P0，官方文书和舆情都需要日级监控。",
  },
  {
    name: "EU / CJEU",
    priority: "P1",
    score: 84,
    drivers: ["AI Act", "TDM opt-out", "CJEU references"],
    summary: "影响全欧的解释层：训练数据透明度、TDM 例外、opt-out 合规。",
  },
  {
    name: "Germany",
    priority: "P2",
    score: 67,
    drivers: ["publishers", "image rights", "database right"],
    summary: "关注出版商、图片权利人和数据库权路径。",
  },
  {
    name: "United Kingdom",
    priority: "P2",
    score: 70,
    drivers: ["news corpus", "Getty-style claims", "licensing"],
    summary: "虽非 EU，但会影响欧洲授权市场和平台策略。",
  },
  {
    name: "Netherlands",
    priority: "P2",
    score: 61,
    drivers: ["platform jurisdiction", "scraping", "hosting"],
    summary: "跨境平台、抓取和管辖风险监控。",
  },
  {
    name: "Spain",
    priority: "P3",
    score: 48,
    drivers: ["media groups", "EU implementation"],
    summary: "以媒体权利人与欧盟实施动态为主。",
  },
  {
    name: "Italy",
    priority: "P3",
    score: 52,
    drivers: ["publishers", "regulators", "culture sector"],
    summary: "关注出版、监管声明和文化内容授权。",
  },
  {
    name: "Nordics",
    priority: "P3",
    score: 45,
    drivers: ["CMOs", "media alliances", "policy"],
    summary: "版权组织和媒体联盟信号监控。",
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

function renderMetrics() {
  const p0 = state.organizations.filter((item) => item.priority === "P0").length;
  const reviewEligible = state.intel.length;
  const officialDocs = state.documents.filter((item) => item.confidence === "official").length;
  const avgRisk = Math.round(
    state.cases.reduce((sum, item) => sum + item.risk_score, 0) / Math.max(state.cases.length, 1)
  );
  $("#metrics").innerHTML = [
    ["P0 最高风险", p0],
    ["已发布简报", reviewEligible],
    ["官方文书", officialDocs],
    ["平均风险", avgRisk],
  ]
    .map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderRiskMap() {
  $("#riskMap").innerHTML = jurisdictions
    .map(
      (item) => `
        <article class="risk-cell ${item.priority}">
          <div class="risk-cell-head">
            <h3>${item.name}</h3>
            ${priorityBadge(item.priority)}
          </div>
          <div class="score-row">
            <strong>${item.score}</strong>
            <div class="risk-bar"><span style="width:${item.score}%"></span></div>
          </div>
          <p>${item.summary}</p>
          <div class="driver-list">${item.drivers.map((driver) => `<span>${driver}</span>`).join("")}</div>
        </article>
      `
    )
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
            <span class="pill">${item.confidence}</span>
            <span class="pill">${item.jurisdiction}</span>
            <span class="pill">+${item.risk_delta}</span>
          </div>
          <h3>${item.title}</h3>
          <p>${item.summary}</p>
          <div class="intel-foot">
            <span>${item.organization_name || item.source_name}</span>
            <a href="${item.source_url}" target="_blank" rel="noreferrer">来源</a>
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
            <span class="pill">${item.status}</span>
            <span class="pill">${item.jurisdiction}</span>
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
    $("#runMonitor").textContent = "监控中";
    await api("/api/monitor/run", { method: "POST" });
    await load();
    $("#runMonitor").disabled = false;
    $("#runMonitor").textContent = "运行监控";
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
  renderRiskMap();
  renderP0Targets();
  renderIntel();
  renderCases();
}

attachEvents();
load().catch((error) => {
  document.body.innerHTML = `<main><h1>加载失败</h1><pre>${error.message}</pre></main>`;
});
