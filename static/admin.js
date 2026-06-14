const adminState = {
  cards: [],
  statusFilter: "all",
  priorityFilter: "all",
  typeFilter: "all",
};

const signalTypeLabels = {
  news: "\u65b0\u95fb",
  law_firm_statement: "\u5f8b\u6240\u8868\u6001",
  rights_holder_statement: "\u6743\u5229\u4eba\u58f0\u660e",
  official_court_document: "\u5b98\u65b9\u6587\u4ef6/\u6cd5\u9662\u6587\u4e66",
};

const statusLabels = {
  review: "\u5f85\u5ba1\u6838",
  published: "\u5df2\u53d1\u5e03",
  rejected: "\u5df2\u62d2\u7edd",
};

const confidenceLabels = {
  official: "\u5b98\u65b9",
  semi_official: "\u534a\u5b98\u65b9",
  media_lead: "\u5a92\u4f53\u7ebf\u7d22",
};

const jurisdictionLabels = {
  France: "\u6cd5\u56fd",
  Germany: "\u5fb7\u56fd",
  "European Union": "\u6b27\u76df",
  "United Kingdom": "\u82f1\u56fd",
  Netherlands: "\u8377\u5170",
};

const sourceTypeLabels = {
  news: "\u65b0\u95fb\u5a92\u4f53",
  official_site: "\u5b98\u65b9\u7f51\u7ad9",
  publisher_site: "\u51fa\u7248\u65b9\u7f51\u7ad9",
  official_legal_database: "\u5b98\u65b9\u6cd5\u5f8b\u6570\u636e\u5e93",
  official_portal: "\u5b98\u65b9\u95e8\u6237",
  manual: "\u624b\u5de5\u5f55\u5165",
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
  if (!value) return "\u65e0\u65e5\u671f";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
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
  adminState.cards = await api("/api/admin/intel");
  renderCards();
}

function attachEvents() {
  $("#refreshAdmin").addEventListener("click", load);

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
  document.body.innerHTML = `<main><h1>\u52a0\u8f7d\u5931\u8d25</h1><pre>${error.message}</pre></main>`;
});
