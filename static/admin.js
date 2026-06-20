const adminState = {
  cards: [],
  officialSources: [],
  sourceHealth: [],
  monitorRuns: [],
  statusFilter: "all",
  priorityFilter: "all",
  typeFilter: "all",
};

const signalTypeLabels = {
  news: "新闻",
  litigation_update: "诉讼动态",
  law_firm_statement: "律所表态",
  rights_holder_statement: "权利人声明",
  official_court_document: "官方文件/法院文书",
  legislation_update: "立法动态",
  video_intelligence: "视频情报",
  market_indicator: "金融指标",
  calendar_event: "风险日历",
};

const statusLabels = {
  review: "待审核",
  published: "已发布",
  rejected: "已拒绝",
};

const confidenceLabels = {
  official: "官方",
  semi_official: "半官方",
  media_lead: "媒体线索",
};

const jurisdictionLabels = {
  France: "法国",
  Germany: "德国",
  "European Union": "欧盟",
  "United Kingdom": "英国",
  Netherlands: "荷兰",
  Denmark: "丹麦",
  Italy: "意大利",
  "Council of Europe": "欧洲委员会",
};

const sourceTypeLabels = {
  news: "新闻媒体",
  official_site: "官方网站",
  publisher_site: "出版方网站",
  official_legal_database: "官方法律数据库",
  official_portal: "官方门户",
  official_database: "官方数据库",
  official_api: "官方 API",
  law_firm_tracker: "律所/案件跟踪器",
  news_index: "新闻索引",
  rights_holder_monitor: "权利人监控",
  official_rss: "官方 RSS",
  policy_monitor: "政策监控",
  video_monitor: "视频监控",
  market_data: "金融数据",
  calendar_watch: "风险日历",
  manual: "手工录入",
};

const $ = (selector) => document.querySelector(selector);

async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function priorityBadge(priority) {
  return `<span class="badge ${priority}">${priority}</span>`;
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

function formatDate(value) {
  if (!value) return "无日期";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateTime(value) {
  if (!value) return "未运行";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function parseRunNotes(notes) {
  try {
    return JSON.parse(notes || "{}");
  } catch {
    return { raw: notes || "" };
  }
}

function renderAdminStats() {
  const target = $("#adminStats");
  if (!target) return;
  const review = adminState.cards.filter((item) => item.status === "review").length;
  const published = adminState.cards.filter((item) => item.status === "published").length;
  const p0Review = adminState.cards.filter((item) => item.status === "review" && item.priority === "P0").length;
  const sourceReady = adminState.sourceHealth.filter((item) => item.configured).length;
  const lastRun = adminState.monitorRuns[0];
  const lastNotes = parseRunNotes(lastRun?.notes);
  const inserted = lastNotes.inserted_review_cards ?? 0;
  target.innerHTML = [
    ["待审核", review],
    ["P0 待审", p0Review],
    ["已发布", published],
    ["源已接入", `${sourceReady}/${adminState.sourceHealth.length}`],
    ["上次新增", inserted],
    ["最近运行", formatDateTime(lastRun?.started_at)],
  ]
    .map(([label, value]) => `
      <article class="ops-stat">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `)
    .join("");
}

function renderMonitorRuns() {
  const target = $("#monitorRuns");
  if (!target) return;
  target.innerHTML = adminState.monitorRuns.slice(0, 5).map((run) => {
    const notes = parseRunNotes(run.notes);
    const results = Array.isArray(notes.results) ? notes.results : [];
    return `
      <article class="run-card">
        <div>
          <strong>${escapeHtml(statusLabels[run.status] || run.status)}</strong>
          <span>${escapeHtml(formatDateTime(run.started_at))} - ${escapeHtml(formatDateTime(run.completed_at))}</span>
        </div>
        <div class="run-source-row">
          ${results.length ? results.map((item) => `
            <span title="${escapeHtml((item.errors || []).map((err) => err.error || err.reason || "").join("；"))}">
              ${escapeHtml(item.source)} · 查 ${escapeHtml(item.checked ?? 0)} · 新 ${escapeHtml(item.inserted_review_cards ?? item.updated ?? 0)}
            </span>
          `).join("") : `<span>${escapeHtml(notes.raw || "暂无结果明细")}</span>`}
        </div>
      </article>
    `;
  }).join("") || `<div class="empty-state">还没有监控运行记录。</div>`;
}

function renderOfficialSources() {
  $("#officialSources").innerHTML = adminState.officialSources
    .map((item) => {
      const status = item.configured ? "已配置" : item.needs_token ? "待配置 token" : "已登记";
      return `
        <article class="source-card ${item.configured ? "configured" : "pending"}">
          <div class="case-meta">
            <span class="pill">${status}</span>
            <span class="pill">${jurisdictionLabels[item.jurisdiction] || item.jurisdiction}</span>
            <span class="pill">${item.kind}</span>
          </div>
          <h3>${item.name}</h3>
          <p>${item.notes}</p>
          <div class="meta-list">
            <span>最近检查：${formatDate(item.last_checked_at)}</span>
            <span>接口：${item.search_url || "注册后填写"}</span>
          </div>
          <div class="intel-foot">
            <a href="${item.registration_url}" target="_blank" rel="noreferrer">注册/文档</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSourceHealth() {
  const target = $("#sourceHealth");
  if (!target) return;
  target.innerHTML = adminState.sourceHealth
    .map((item) => {
      const status = item.configured ? "可运行" : "待配置";
      return `
        <article class="source-card ${item.configured ? "configured" : "pending"}">
          <div class="case-meta">
            <span class="pill">${status}</span>
            <span class="pill">${item.refresh_cadence || "按需"}</span>
          </div>
          <h3>${item.name}</h3>
          <p>${item.notes || item.base_url}</p>
          <div class="meta-list">
            <span>类型：${sourceTypeLabels[item.source_type] || item.source_type}</span>
            <span>法域：${jurisdictionLabels[item.jurisdiction] || item.jurisdiction}</span>
            <span>最近检查：${formatDate(item.last_checked_at)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function filteredCards() {
  return adminState.cards.filter((item) => {
    const statusMatch = adminState.statusFilter === "all" || item.status === adminState.statusFilter;
    const priorityMatch = adminState.priorityFilter === "all" || item.priority === adminState.priorityFilter;
    const typeMatch = adminState.typeFilter === "all" || item.signal_type === adminState.typeFilter;
    return statusMatch && priorityMatch && typeMatch;
  });
}

function renderCards() {
  const cards = filteredCards();
  $("#adminCards").innerHTML = cards.length
    ? cards
        .map(
          (item) => `
        <article class="admin-card ${item.status}">
          <div class="case-meta">
            ${priorityBadge(item.priority)}
            <span class="pill">${statusLabels[item.status] || item.status}</span>
            <span class="pill type-pill">${escapeHtml(signalTypeLabels[item.signal_type] || item.signal_type)}</span>
            <span class="pill">${escapeHtml(confidenceLabels[item.confidence] || item.confidence)}</span>
            <span class="pill">${escapeHtml(jurisdictionLabels[item.jurisdiction] || item.jurisdiction)}</span>
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary)}</p>
          <div class="meta-list">
            <span>情报日期：${formatDate(item.signal_date || item.approved_at || item.created_at)}</span>
            <span>来源类型：${escapeHtml(sourceTypeLabels[item.source_type] || item.source_type)}</span>
            <span>关联对象：${escapeHtml(item.organization_name || item.case_title || "未绑定")}</span>
          </div>
          <div class="intel-foot">
            <span>${escapeHtml(item.source_name)}</span>
            <a href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">来源</a>
          </div>
          <div class="admin-actions">
            <button data-action="publish" data-id="${item.id}" ${item.status === "published" ? "disabled" : ""}>发布</button>
            <button data-action="reject" data-id="${item.id}" ${item.status === "rejected" ? "disabled" : ""}>拒绝</button>
          </div>
        </article>
      `
        )
        .join("")
    : `<div class="empty-state">当前筛选条件下没有情报卡片。</div>`;
}

async function load() {
  const [cards, officialSources, sourceHealth, monitorRuns] = await Promise.all([
    api("/api/admin/intel"),
    api("/api/admin/official-sources"),
    api("/api/source-health"),
    api("/api/monitor/runs"),
  ]);
  adminState.cards = cards;
  adminState.officialSources = officialSources;
  adminState.sourceHealth = sourceHealth;
  adminState.monitorRuns = monitorRuns;
  renderAdminStats();
  renderMonitorRuns();
  renderOfficialSources();
  renderSourceHealth();
  renderCards();
}

function attachEvents() {
  $("#refreshAdmin").addEventListener("click", load);

  $("#runMonitor")?.addEventListener("click", async () => {
    const button = $("#runMonitor");
    const resultBox = $("#monitorRunResult");
    button.disabled = true;
    button.textContent = "监控中";
    try {
      const result = await api("/api/monitor/run", { method: "POST" });
      resultBox.hidden = false;
      resultBox.textContent = JSON.stringify(result, null, 2);
      await load();
    } finally {
      button.disabled = false;
      button.textContent = "运行全量监控";
    }
  });

  $("#runOfficialDocs").addEventListener("click", async () => {
    const button = $("#runOfficialDocs");
    const resultBox = $("#officialRunResult");
    button.disabled = true;
    button.textContent = "抓取中";
    try {
      const result = await api("/api/official-documents/run", { method: "POST" });
      resultBox.hidden = false;
      resultBox.textContent = JSON.stringify(result, null, 2);
      await load();
    } finally {
      button.disabled = false;
      button.textContent = "运行官方文书抓取";
    }
  });

  ["statusFilter", "priorityFilter", "typeFilter"].forEach((id) => {
    $(`#${id}`).addEventListener("change", (event) => {
      adminState[id] = event.target.value;
      renderCards();
    });
  });

  $("#adminCards").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const id = button.dataset.id;
    await api(`/api/admin/intel/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  });

  $("#intelForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    payload.risk_delta = Number(payload.risk_delta || 0);
    if (payload.signal_date) {
      payload.signal_date = `${payload.signal_date}T00:00:00+00:00`;
    }
    await api("/api/admin/intel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    event.currentTarget.reset();
    await load();
  });
}

attachEvents();
load().catch((error) => {
  document.body.innerHTML = `<main><h1>加载失败</h1><pre>${error.message}</pre></main>`;
});
