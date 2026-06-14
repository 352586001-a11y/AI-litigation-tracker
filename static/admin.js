const adminState = {
  cards: [],
  officialSources: [],
  statusFilter: "all",
  priorityFilter: "all",
  typeFilter: "all",
};

const signalTypeLabels = {
  news: "新闻",
  law_firm_statement: "律所表态",
  rights_holder_statement: "权利人声明",
  official_court_document: "官方文件/法院文书",
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
  "Council of Europe": "欧洲委员会",
};

const sourceTypeLabels = {
  news: "新闻媒体",
  official_site: "官方网站",
  publisher_site: "出版方网站",
  official_legal_database: "官方法律数据库",
  official_portal: "官方门户",
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

function formatDate(value) {
  if (!value) return "无日期";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
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
            <span class="pill type-pill">${signalTypeLabels[item.signal_type] || item.signal_type}</span>
            <span class="pill">${confidenceLabels[item.confidence] || item.confidence}</span>
            <span class="pill">${jurisdictionLabels[item.jurisdiction] || item.jurisdiction}</span>
          </div>
          <h3>${item.title}</h3>
          <p>${item.summary}</p>
          <div class="meta-list">
            <span>情报日期：${formatDate(item.signal_date || item.approved_at || item.created_at)}</span>
            <span>来源类型：${sourceTypeLabels[item.source_type] || item.source_type}</span>
            <span>关联对象：${item.organization_name || item.case_title || "未绑定"}</span>
          </div>
          <div class="intel-foot">
            <span>${item.source_name}</span>
            <a href="${item.source_url}" target="_blank" rel="noreferrer">来源</a>
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
  const [cards, officialSources] = await Promise.all([
    api("/api/admin/intel"),
    api("/api/admin/official-sources"),
  ]);
  adminState.cards = cards;
  adminState.officialSources = officialSources;
  renderOfficialSources();
  renderCards();
}

function attachEvents() {
  $("#refreshAdmin").addEventListener("click", load);

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
