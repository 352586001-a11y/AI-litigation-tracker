const adminState = {
  cards: [],
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

function renderCards() {
  $("#adminCards").innerHTML = adminState.cards
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
          <div class="intel-foot">
            <span>${item.organization_name || item.source_name}</span>
            <a href="${item.source_url}" target="_blank" rel="noreferrer">来源</a>
          </div>
          <div class="admin-actions">
            <button data-action="publish" data-id="${item.id}" ${item.status === "published" ? "disabled" : ""}>发布</button>
            <button data-action="reject" data-id="${item.id}" ${item.status === "rejected" ? "disabled" : ""}>拒绝</button>
          </div>
        </article>
      `
    )
    .join("");
}

async function load() {
  adminState.cards = await api("/api/admin/intel");
  renderCards();
}

$("#refreshAdmin").addEventListener("click", load);

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
  await api("/api/admin/intel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  event.currentTarget.reset();
  await load();
});

load().catch((error) => {
  document.body.innerHTML = `<main><h1>加载失败</h1><pre>${error.message}</pre></main>`;
});
