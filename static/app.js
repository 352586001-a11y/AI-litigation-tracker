const state = {
  cases: [],
  organizations: [],
  documents: [],
  intel: [],
  video: [],
  market: [],
  calendar: [],
  aiAnalysis: [],
  sources: [],
  monitorRuns: [],
  worldGeo: null,
  filter: "all",
  evidence: "litigation",
  range: "all",
  region: "global",
  zoom: 1,
  mapVisible: true,
  query: "",
  selectedJurisdiction: null,
  lastUpdated: null,
  refreshMs: 60000,
  nextRefreshAt: null,
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

const layerLabels = {
  litigation: "诉讼层",
  official: "官方文书层",
  rights: "权利人发声层",
  legislation: "立法动态层",
  video: "视频情报层",
  market: "金融影响层",
  calendar: "风险日历层",
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
  "United States": "美国",
  Canada: "加拿大",
  Brazil: "巴西",
  China: "中国",
  Japan: "日本",
  "South Korea": "韩国",
  India: "印度",
  Global: "全球",
  Nordics: "北欧",
  "Council of Europe": "欧洲委员会",
};

const statusLabels = {
  WATCH: "监控中",
  LEAD: "线索",
  CASE: "案件",
  CLOSED: "已结束",
  completed: "已完成",
  partial: "部分完成",
  failed: "失败",
  running: "运行中",
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
  official_archive_api: "法院归档 API",
  publisher_site: "出版方",
  law_firm_tracker: "法律跟踪器",
  news_index: "新闻索引",
  rights_holder_monitor: "权利人监控",
  official_rss: "官方 RSS",
  policy_monitor: "政策监控",
  video_monitor: "视频监控",
  market_data: "金融数据",
  calendar_watch: "风险日历",
};

const marketCategoryLabels = {
  ai_platform: "AI 平台",
  ai_infrastructure: "AI 基建",
  rights_holder: "权利人",
  publisher: "出版/新闻",
};

const eventTypeLabels = {
  legislation_checkpoint: "立法节点",
  judgment_expected: "判决预期",
  policy_update: "政策更新",
  rights_pressure: "权利人压力",
};

const evidenceTitles = {
  litigation: "诉讼外部动态",
  official: "官方诉讼文书",
  rights: "权利人官方声明与表态",
  legislation: "官方立法与政策动态",
  video: "视频与听证情报",
  market: "金融影响指标",
  calendar: "立法与判决日历",
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
  { id: "us", region: "americas", name: "United States", label: "美国", priority: "P1", score: 91, lat: 38.9072, lon: -77.0369 },
  { id: "ca", region: "americas", name: "Canada", label: "加拿大", priority: "P2", score: 68, lat: 45.4215, lon: -75.6972 },
  { id: "br", region: "americas", name: "Brazil", label: "巴西", priority: "P3", score: 54, lat: -15.7939, lon: -47.8828 },
  { id: "uk", region: "europe", name: "United Kingdom", label: "英国", priority: "P1", score: 78, lat: 51.5072, lon: -0.1276 },
  { id: "fr", region: "europe", name: "France", label: "法国", priority: "P0", score: 97, lat: 48.8566, lon: 2.3522 },
  { id: "eu", region: "europe", name: "European Union", label: "欧盟", priority: "P1", score: 84, lat: 50.8503, lon: 4.3517 },
  { id: "de", region: "europe", name: "Germany", label: "德国", priority: "P1", score: 86, lat: 52.52, lon: 13.405 },
  { id: "dk", region: "europe", name: "Denmark", label: "丹麦", priority: "P1", score: 76, lat: 55.6761, lon: 12.5683 },
  { id: "nl", region: "europe", name: "Netherlands", label: "荷兰", priority: "P2", score: 66, lat: 52.3676, lon: 4.9041 },
  { id: "it", region: "europe", name: "Italy", label: "意大利", priority: "P2", score: 65, lat: 41.9028, lon: 12.4964 },
  { id: "cn", region: "apac", name: "China", label: "中国", priority: "P2", score: 70, lat: 39.9042, lon: 116.4074 },
  { id: "jp", region: "apac", name: "Japan", label: "日本", priority: "P3", score: 55, lat: 35.6762, lon: 139.6503 },
  { id: "kr", region: "apac", name: "South Korea", label: "韩国", priority: "P2", score: 64, lat: 37.5665, lon: 126.978 },
  { id: "in", region: "apac", name: "India", label: "印度", priority: "P3", score: 58, lat: 28.6139, lon: 77.209 },
];

const regionLabels = {
  global: "全球",
  europe: "欧洲",
  americas: "美洲",
  apac: "亚太",
};

const regionViewports = {
  global: { lat: 20, lon: 0, zoom: 1, originX: 50, originY: 50 },
  europe: { lat: 50, lon: 10, zoom: 1.85, originX: 52, originY: 29 },
  americas: { lat: 28, lon: -75, zoom: 1.65, originX: 24, originY: 46 },
  apac: { lat: 28, lon: 112, zoom: 1.75, originX: 75, originY: 36 },
};

const geoProjection = {
  width: 1000,
  height: 520,
  minLat: -58,
  maxLat: 84,
};

const $ = (selector) => document.querySelector(selector);

async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function loadWorldGeo() {
  if (state.worldGeo) return state.worldGeo;
  const response = await fetch("/world-countries.geojson");
  if (!response.ok) throw new Error("world map geojson load failed");
  state.worldGeo = await response.json();
  return state.worldGeo;
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

function hasUsableSource(item) {
  return safeUrl(item.source_url) !== "#";
}

function isPublishableEvidence(item) {
  if (!item) return false;
  if (item.detail_kind === "case") return true;
  if (["draft", "rejected"].includes(String(item.status || "").toLowerCase())) return false;
  return hasUsableSource(item);
}

function projectLonLat(lon, lat) {
  const clampedLat = Math.max(geoProjection.minLat, Math.min(geoProjection.maxLat, Number(lat)));
  const clampedLon = Math.max(-180, Math.min(180, Number(lon)));
  const x = ((clampedLon + 180) / 360) * geoProjection.width;
  const y = ((geoProjection.maxLat - clampedLat) / (geoProjection.maxLat - geoProjection.minLat)) * geoProjection.height;
  return {
    x,
    y,
    xp: (x / geoProjection.width) * 100,
    yp: (y / geoProjection.height) * 100,
  };
}

function geoRingPath(ring) {
  return ring
    .map(([lon, lat], index) => {
      const point = projectLonLat(lon, lat);
      return `${index ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ") + " Z";
}

function geoPolygonPath(polygon) {
  return polygon.map(geoRingPath).join(" ");
}

function geoFeaturePath(feature) {
  const geometry = feature?.geometry;
  if (!geometry) return "";
  if (geometry.type === "Polygon") return geoPolygonPath(geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.map(geoPolygonPath).join(" ");
  return "";
}

function renderGeoMap(activeNames = new Set()) {
  const monitored = new Set(jurisdictions.map((item) => item.name));
  const p0Names = new Set(jurisdictions.filter((item) => item.priority === "P0").map((item) => item.name));
  const features = state.worldGeo?.features || [];
  if (!features.length) return `<div class="wm-map-loading">正在加载真实世界地图</div>`;
  return `
    <svg class="wm-geo-map" viewBox="0 0 ${geoProjection.width} ${geoProjection.height}" role="img" aria-label="真实国家边界世界地图">
      <g>
        ${features
          .map((feature) => {
            const name = feature.properties?.name || "";
            const className = `${monitored.has(name) ? " monitored" : ""}${activeNames.has(name) ? " layer-active" : ""}${p0Names.has(name) ? " p0" : ""}`;
            return `<path class="wm-country${className}" d="${geoFeaturePath(feature)}"></path>`;
          })
          .join("")}
      </g>
    </svg>
  `;
}

function priorityBadge(priority) {
  return `<span class="badge ${escapeHtml(priority)}">${escapeHtml(priority)}</span>`;
}

function displaySignalType(item) {
  if (item.detail_kind === "case" || item.signal_type === "case_object") return "案件对象";
  if (item.signal_type && ["video_intelligence", "market_indicator", "calendar_event"].includes(item.signal_type)) {
    return signalTypeLabels[item.signal_type];
  }
  if (item.signal_type === "litigation_update") return "诉讼动态";
  if (item.signal_type === "legislation_update") return "立法动态";
  if (item.signal_type === "rights_holder_statement") return "权利人发声";
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

function rangeDate(item) {
  return item.signal_date || item.document_date || item.video_date || item.event_date || item.last_checked_at || null;
}

function inRange(item) {
  if (state.range === "all") return true;
  const time = new Date(rangeDate(item)).getTime();
  if (Number.isNaN(time)) return false;
  const now = Date.now();
  if (time > now + 60 * 1000) return false;
  const hours = {
    "1h": 1,
    "6h": 6,
    "24h": 24,
    "48h": 48,
    "7d": 7 * 24,
    "30d": 30 * 24,
  }[state.range] || 30 * 24;
  return now - time <= hours * 60 * 60 * 1000;
}

function rangeLabel() {
  return {
    "1h": "最近 1 小时",
    "6h": "最近 6 小时",
    "24h": "最近 24 小时",
    "48h": "最近 48 小时",
    "7d": "最近 7 天",
    "30d": "最近 30 天",
    all: "全部时间",
  }[state.range] || "全部时间";
}

function regionForJurisdiction(name) {
  if (["Europe", "European Union", "United Kingdom", "France", "Germany", "Denmark", "Netherlands", "Italy", "Spain", "Nordics", "Council of Europe"].includes(name)) return "europe";
  if (["Americas", "United States", "Canada", "Brazil"].includes(name)) return "americas";
  if (["APAC", "Asia Pacific", "China", "Japan", "South Korea", "India"].includes(name)) return "apac";
  return jurisdictions.find((item) => item.name === name)?.region || "global";
}

function inSelectedRegion(item) {
  if (state.region === "global") return true;
  return regionForJurisdiction(item.jurisdiction) === state.region;
}

function inSelectedJurisdiction(item) {
  return inSelectedRegion(item) && (!state.selectedJurisdiction || item.jurisdiction === state.selectedJurisdiction);
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

function searchableText(item) {
  return [
    item.title,
    item.summary,
    item.summary_cn,
    item.source_name,
    item.source_id,
    item.source_type,
    item.base_url,
    item.notes,
    item.refresh_cadence,
    item.document_type,
    item.jurisdiction,
    item.organization_name,
    item.case_title,
    item.name,
    item.full_name,
    item.case_number,
    item.court,
    item.ecli,
    item.tags,
    item.claim_types,
    item.ai_systems,
  ].filter(Boolean).join(" ").toLowerCase();
}

function matchesSearch(item) {
  const query = state.query.trim().toLowerCase();
  if (!query) return true;
  return query.split(/\s+/).every((part) => searchableText(item).includes(part));
}

function caseMatchesSearch(item) {
  if (matchesSearch(item)) return true;
  if (!state.query.trim()) return true;
  return signalsForCase(item.id).some(matchesSearch);
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
  if (["video", "market", "calendar"].includes(item.evidence_kind)) return false;
  if (["video_intelligence", "market_indicator", "calendar_event"].includes(item.signal_type)) return false;
  if (item.signal_type === "litigation_update") return true;
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
  if (["video", "market", "calendar"].includes(item.evidence_kind)) return false;
  if (["video_intelligence", "market_indicator", "calendar_event"].includes(item.signal_type)) return false;
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
  return state.documents.filter((item) => item.jurisdiction === name).filter(matchesSearch);
}

function intelForJurisdiction(name) {
  return state.intel.filter((item) => item.jurisdiction === name && inRange(item)).filter(matchesSearch);
}

function caseForJurisdiction(name) {
  return state.cases.filter((item) => item.jurisdiction === name).filter(caseInRange).filter(caseMatchesSearch);
}

function signalsForCase(caseId) {
  if (!caseId) return [];
  const intelSignals = state.intel
    .filter((item) => item.case_id === caseId)
    .map((item) => ({ ...item, sort_date: item.signal_date || item.approved_at || item.created_at }));
  const documentSignals = state.documents
    .filter((item) => item.case_id === caseId)
    .map((item) => ({ ...item, sort_date: item.document_date || item.captured_at || item.created_at }));
  const videoSignals = state.video
    .filter((item) => item.case_id === caseId)
    .map((item) => ({ ...item, sort_date: item.video_date || item.approved_at || item.updated_at || item.created_at }));
  const calendarSignals = state.calendar
    .filter((item) => item.case_id === caseId)
    .map((item) => ({ ...item, sort_date: item.event_date }));
  return [...intelSignals, ...documentSignals, ...videoSignals, ...calendarSignals];
}

function caseInRange(item) {
  if (state.range === "all") return true;
  return signalsForCase(item.id).some(inRange);
}

function visibleCases() {
  return state.cases.filter(inSelectedJurisdiction).filter(caseInRange).filter(caseMatchesSearch);
}

function visibleSignals() {
  return getAllSignals().filter(inSelectedJurisdiction).filter(matchesSearch);
}

function documentGapRows(cases = visibleCases()) {
  const rowsByPriority = ["P0", "P1", "P2", "P3"].map((priority) => {
    const total = cases.filter((item) => item.priority === priority).length;
    const gaps = cases.filter((item) => item.priority === priority && Number(item.document_count || 0) === 0).length;
    return [`${priority} 缺口`, gaps, priority, total];
  });
  return rowsByPriority.filter((row) => row[1] || row[3]);
}

function freshnessRows(signals = visibleSignals()) {
  const buckets = [
    ["7 天内", (item) => {
      const days = daysAgo(sortDate(item));
      return days !== null && days <= 7;
    }, "P0"],
    ["30 天内", (item) => {
      const days = daysAgo(sortDate(item));
      return days !== null && days > 7 && days <= 30;
    }, "P1"],
    ["较早", (item) => {
      const days = daysAgo(sortDate(item));
      return days === null || days > 30;
    }, "P3"],
  ];
  return buckets.map(([label, predicate, tone]) => [label, signals.filter(predicate).length, tone]);
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

function getVideoEvidence() {
  return sortByTimeDesc(
    state.video.map((item) => ({
      ...item,
      evidence_kind: "video",
      signal_type: "video_intelligence",
      confidence: item.source_type?.includes("official") ? "official" : "semi_official",
      sort_date: item.video_date || item.approved_at || item.updated_at || item.created_at,
      summary: item.summary || "视频源已纳入监控，等待转写和人工摘要。",
    }))
  )
    .filter(inRange)
    .filter(inSelectedJurisdiction);
}

function getMarketEvidence() {
  return state.market.map((item) => {
    const price = item.last_price == null ? "待同步" : `${Number(item.last_price).toFixed(2)} ${item.currency || "USD"}`;
    const change = item.change_pct == null ? "暂无日内涨跌" : `${Number(item.change_pct).toFixed(2)}%`;
    const priority = item.category === "ai_platform" ? "P1" : item.category === "rights_holder" ? "P2" : "P3";
    const linkage = item.category === "ai_platform"
      ? "作为 AI 模型/产品供给侧，受训练数据透明度、授权成本、诉讼赔偿和禁令风险影响。"
      : item.category === "rights_holder"
        ? "作为版权资产或出版内容供给侧，受授权谈判、集体诉讼、AI Act 透明度和 opt-out 执行影响。"
        : "作为新闻/出版市场观察项，反映内容授权和 AI 版权议价环境。";
    return {
      ...item,
      evidence_kind: "market",
      signal_type: "market_indicator",
      priority,
      confidence: "media_lead",
      sort_date: item.last_checked_at || item.updated_at || item.created_at,
      title: `${item.name} (${item.symbol})`,
      summary: `${marketCategoryLabels[item.category] || item.category} · ${linkage} 暴露点：${item.risk_exposure} 市场指标：${price}，涨跌：${change}。`,
      source_name: item.source_name || "Market data",
      source_url: item.source_url,
      tags: `${item.symbol},${item.category},market,copyright risk`,
    };
  });
}

function getCalendarEvidence() {
  return sortByTimeDesc(
    state.calendar.map((item) => ({
      ...item,
      evidence_kind: "calendar",
      signal_type: "calendar_event",
      confidence: item.source_name?.includes("Commission") || item.source_name?.includes("Sénat") ? "official" : "semi_official",
      sort_date: item.event_date,
      tags: `${item.event_type},calendar,${item.jurisdiction}`,
      summary: `${eventTypeLabels[item.event_type] || item.event_type} · ${item.summary}`,
    }))
  )
    .filter(inRange)
    .filter(inSelectedJurisdiction);
}

function getEvidenceItems(layer = state.evidence) {
  if (layer === "official") return getOfficialEvidence().filter(isPublishableEvidence).filter(matchesSearch);
  if (layer === "video") return getVideoEvidence().filter(isPublishableEvidence).filter(matchesSearch);
  if (layer === "market") return getMarketEvidence().filter(inRange).filter(inSelectedJurisdiction).filter(isPublishableEvidence).filter(matchesSearch);
  if (layer === "calendar") return getCalendarEvidence().filter(isPublishableEvidence).filter(matchesSearch);

  const filtered = state.intel.filter((item) => {
    if (layer === "litigation") return isLitigationSignal(item);
    if (layer === "rights") return isRightsVoice(item);
    return isLegislationSignal(item);
  });

  return sortByTimeDesc(filtered.map((item) => ({ ...item, sort_date: item.signal_date || item.approved_at || item.created_at })))
    .filter(inRange)
    .filter(inSelectedJurisdiction)
    .filter(isPublishableEvidence)
    .filter(matchesSearch);
}

function layerItemsForJurisdiction(name, layer = state.evidence) {
  const jurisdictionFilter = (item) => item.jurisdiction === name;
  if (layer === "litigation") {
    const cases = caseForJurisdiction(name);
    const updates = state.intel
      .filter(jurisdictionFilter)
      .filter(inRange)
      .filter(matchesSearch)
      .filter(isLitigationSignal)
      .filter(isPublishableEvidence);
    return [...cases, ...updates];
  }
  if (layer === "official") {
    const docs = state.documents
      .filter(jurisdictionFilter)
      .filter(inRange)
      .filter(matchesSearch)
      .filter(isPublishableEvidence);
    const officialIntel = state.intel
      .filter(jurisdictionFilter)
      .filter(inRange)
      .filter(matchesSearch)
      .filter((item) => item.signal_type === "official_court_document")
      .filter(isPublishableEvidence);
    return [...docs, ...officialIntel];
  }
  if (layer === "rights") {
    return state.intel.filter(jurisdictionFilter).filter(inRange).filter(matchesSearch).filter(isRightsVoice).filter(isPublishableEvidence);
  }
  if (layer === "legislation") {
    return state.intel.filter(jurisdictionFilter).filter(inRange).filter(matchesSearch).filter(isLegislationSignal).filter(isPublishableEvidence);
  }
  if (layer === "video") {
    return state.video
      .filter(jurisdictionFilter)
      .map((item) => ({ ...item, sort_date: item.video_date || item.approved_at || item.updated_at || item.created_at }))
      .filter(inRange)
      .filter(matchesSearch)
      .filter(isPublishableEvidence);
  }
  if (layer === "market") {
    return state.market.filter(jurisdictionFilter).filter(inRange).filter(matchesSearch).filter(isPublishableEvidence);
  }
  if (layer === "calendar") {
    return state.calendar
      .filter(jurisdictionFilter)
      .map((item) => ({ ...item, sort_date: item.event_date }))
      .filter(inRange)
      .filter(matchesSearch)
      .filter(isPublishableEvidence);
  }
  return [];
}

function mapLayerSignals() {
  if (state.evidence === "litigation") return getEvidenceItems("litigation");
  return getEvidenceItems(state.evidence);
}

function caseToDetailItem(item) {
  const caseSignals = sortByTimeDesc(
    signalsForCase(item.id)
      .filter(inRange)
      .filter(matchesSearch)
      .filter(isPublishableEvidence)
  );
  const latestSignal = caseSignals[0];
  const documentCount = Number(item.document_count || 0);
  return {
    ...item,
    detail_kind: "case",
    signal_type: "case_object",
    sort_date: latestSignal ? sortDate(latestSignal) : item.updated_at || item.created_at,
    source_name: `${statusLabels[item.status] || item.status || "案件库"} · ${documentCount} 份文书 · ${caseSignals.length} 条证据`,
    summary: item.summary || "案件库对象，点击可查看聚合证据链。",
  };
}

function layerDetailItems() {
  const passesPriority = (item) => state.filter === "all" || (item.priority || "P2") === state.filter;
  if (state.evidence === "litigation") {
    const cases = visibleCases().map(caseToDetailItem);
    const litigationSignals = getEvidenceItems("litigation").map((item) => ({ ...item, detail_kind: "signal" }));
    return sortByTimeDesc([...cases, ...litigationSignals]).filter(passesPriority);
  }
  return getEvidenceItems(state.evidence)
    .map((item) => ({ ...item, detail_kind: item.evidence_kind === "official" ? "document" : "signal" }))
    .filter(passesPriority);
}

function renderLayerDetailCard(item) {
  const sourceUrl = safeUrl(item.source_url);
  const jurisdiction = jurisdictionLabels[item.jurisdiction] || item.jurisdiction || "未知法域";
  const signalType = displaySignalType(item);
  const detailDate = formatDate(rangeDate(item) || sortDate(item));
  const clickable = item.detail_kind === "case" && item.id;
  return `
    <article class="wm-detail-card ${escapeHtml(item.priority || "P2")} ${clickable ? "is-clickable" : ""}" ${clickable ? `data-case-id="${escapeHtml(item.id)}" role="button" tabindex="0"` : ""}>
      <div class="wm-detail-meta">
        ${priorityBadge(item.priority || "P2")}
        <span>${escapeHtml(signalType)}</span>
        <span>${escapeHtml(detailDate)}</span>
        <span>${escapeHtml(jurisdiction)}</span>
      </div>
      <h4>${escapeHtml(item.title || item.name || "未命名信号")}</h4>
      <p>${escapeHtml(item.summary || item.summary_cn || "暂无摘要。")}</p>
      <div class="wm-detail-foot">
        <span>${escapeHtml(item.source_name || item.source_id || "案件库")}</span>
        ${clickable ? "<em>点击查看案件详情</em>" : `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">打开来源</a>`}
      </div>
    </article>
  `;
}

function renderLayerDetail() {
  const list = $("#layerDetailList");
  if (!list) return;
  const title = $("#layerDetailTitle");
  const kicker = $("#layerDetailKicker");
  const layerName = layerLabels[state.evidence] || state.evidence;
  const scopeName = state.selectedJurisdiction
    ? jurisdictionLabels[state.selectedJurisdiction] || state.selectedJurisdiction
    : regionLabels[state.region] || "全球";
  const items = layerDetailItems();
  if (title) title.textContent = `${scopeName} · ${layerName.replace("层", "详情")}`;
  if (kicker) kicker.textContent = `${rangeLabel()} · ${items.length} 条`;
  list.innerHTML = items.length
    ? items.slice(0, 28).map(renderLayerDetailCard).join("")
    : `<div class="empty-state">这个时间窗口没有可核验的${escapeHtml(layerName)}信号。切换到“全部”可查看案件库和历史证据。</div>`;

  list.querySelectorAll(".wm-detail-card[data-case-id]").forEach((card) => {
    const open = () => showCase(card.dataset.caseId);
    card.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      open();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    });
  });
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
  const videoSignals = getVideoEvidence();
  const calendarSignals = getCalendarEvidence();
  return sortByTimeDesc([...intelSignals, ...documentSignals, ...videoSignals, ...calendarSignals]).filter(inRange);
}

function renderMetrics() {
  const scopedIntel = state.intel.filter(inSelectedJurisdiction).filter(inRange).filter(matchesSearch);
  const scopedDocuments = state.documents.filter(inSelectedJurisdiction).filter(inRange).filter(matchesSearch);
  const scopedVideo = getVideoEvidence().filter(matchesSearch);
  const scopedMarket = state.market.filter(inSelectedJurisdiction).filter(matchesSearch);
  const scopedCalendar = getCalendarEvidence().filter(matchesSearch);
  const litigation = scopedIntel.filter(isLitigationSignal).length;
  const official = scopedDocuments.length + scopedIntel.filter((item) => item.signal_type === "official_court_document").length;
  const rights = scopedIntel.filter(isRightsVoice).length;
  const legislation = scopedIntel.filter(isLegislationSignal).length;
  const video = scopedVideo.length;
  const market = scopedMarket.length;
  const calendar = scopedCalendar.length;

  $("#metricNews").textContent = litigation;
  $("#metricOfficial").textContent = official;
  $("#metricRights").textContent = rights;
  $("#metricLegislation").textContent = legislation;
  $("#metricVideo").textContent = video;
  $("#metricMarket").textContent = market;
  $("#metricCalendar").textContent = calendar;
  const recentSignals = visibleSignals().filter((item) => {
    const time = new Date(sortDate(item)).getTime();
    return !Number.isNaN(time) && Date.now() - time <= 30 * 24 * 60 * 60 * 1000;
  });
  const configuredSources = state.sources.filter((item) => item.configured).length;
  const currentLayerSignals = mapLayerSignals();

  $("#metrics").innerHTML = [
    ["案件", visibleCases().length],
    ["P0 对象", visibleCases().filter((item) => item.priority === "P0").length],
    ["情报卡", scopedIntel.length],
    ["官方文书", official],
    ["视频源", video],
    ["金融指标", market],
    ["日历事件", calendar],
    ["30天信号", recentSignals.length],
    ["最近更新", state.lastUpdated ? formatTime(state.lastUpdated) : "--:--"],
  ]
    .map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`)
    .join("");
  $("#sourceCoverage").textContent = `源 ${configuredSources}/${state.sources.length}`;
  $("#recentSignalCount").textContent = `${recentSignals.length} 条 / 30 天`;
  $("#liveHeadline").textContent = currentLayerSignals[0]?.title || "当前图层暂无信号";
  const latestRun = state.monitorRuns[0];
  $("#lastMonitorRun").textContent = latestRun
    ? `${statusLabels[latestRun.status] || latestRun.status} · ${formatTime(latestRun.completed_at || latestRun.started_at)}`
    : "等待运行";
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item) || "未分类";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function chartBars(rows, maxValue) {
  const values = rows.map((row) => Number(row[1] || 0));
  const max = Math.max(1, Number(maxValue || 0), ...values);
  return `
    <div class="wm-chart-bars">
      ${rows.map(([label, value, tone]) => {
        const width = Math.max(4, Math.min(100, Number(value || 0) / max * 100));
        return `
          <div class="wm-chart-row ${escapeHtml(tone || "")}">
            <span>${escapeHtml(label)}</span>
            <i><b style="width:${width}%"></b></i>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function chartCard(label, title, body) {
  return `
    <article class="wm-chart-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(title)}</strong>
      ${body}
    </article>
  `;
}

function renderChartDeck() {
  const target = $("#chartDeck");
  if (!target) return;
  const signals = visibleSignals();
  const cases = visibleCases();
  const priorityRows = ["P0", "P1", "P2", "P3"].map((priority) => [
    priority,
    signals.filter((item) => (item.priority || "P2") === priority).length,
    priority,
  ]);
  const layerRows = [
    ["诉讼", getEvidenceItems("litigation").length, "P0"],
    ["文书", getEvidenceItems("official").length, "P1"],
    ["权利人", getEvidenceItems("rights").length, "P1"],
    ["立法", getEvidenceItems("legislation").length, "P2"],
    ["视频", getEvidenceItems("video").length, "P2"],
    ["日历", getEvidenceItems("calendar").length, "P3"],
  ];
  const jurisdictionRows = Object.entries(countBy(signals, (item) => jurisdictionLabels[item.jurisdiction] || item.jurisdiction))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => [label, value, "geo"]);
  const confidenceRows = Object.entries(countBy(signals, (item) => confidenceLabels[item.confidence] || item.confidence || "待确认"))
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => [label, value, label.includes("官方") ? "P0" : "P2"]);
  const aiRows = state.aiAnalysis
    .filter(inSelectedJurisdiction)
    .filter(matchesSearch)
    .slice(0, 5)
    .map((item) => [
      item.name,
      item.risk_score,
      item.risk_level || item.base_priority || "P2",
    ]);
  const gapRows = documentGapRows(cases).map(([label, value, tone, total]) => [`${label}/${total}`, value, tone]);
  const freshRows = freshnessRows(signals);
  const configuredSources = state.sources.filter((item) => item.configured).length;
  const totalSources = Math.max(1, state.sources.length);
  const sourcePct = Math.round(configuredSources / totalSources * 100);
  target.innerHTML = [
    chartCard("RISK", "P0-P3 情报分布", chartBars(priorityRows)),
    chartCard("LAYER", "分类构成", chartBars(layerRows)),
    chartCard("GEO", "法域热度", chartBars(jurisdictionRows.length ? jurisdictionRows : [["无数据", 0, "P3"]])),
    chartCard("QUALITY", "来源可信度", chartBars(confidenceRows.length ? confidenceRows : [["待同步", 0, "P3"]])),
    chartCard("FRESH", "数据新鲜度", chartBars(freshRows)),
    chartCard("DOC GAP", "官方文书缺口", chartBars(gapRows.length ? gapRows : [["无缺口", 0, "P3"]])),
    chartCard("AI SCORE", "机构风险评分", chartBars(aiRows.length ? aiRows : [["加载中", 0, "P3"]], 100)),
    chartCard(
      "SOURCE",
      "监控源接入率",
      `<div class="wm-source-gauge" style="--source-pct:${sourcePct}%"><strong>${configuredSources}/${state.sources.length}</strong><i><b></b></i><em>${sourcePct}% 已接入，官方 API 凭证缺失源仍显示为待配置。</em></div>`
    ),
  ].join("");
}

function renderAiAnalysis() {
  const target = $("#aiAnalysis");
  if (!target) return;
  target.innerHTML = state.aiAnalysis.filter(inSelectedJurisdiction).filter(matchesSearch).slice(0, 6).map((item) => `
    <article class="wm-ai-card ${escapeHtml(item.risk_level || item.base_priority || "P2")}">
      <div>
        <span>${escapeHtml(jurisdictionLabels[item.jurisdiction] || item.jurisdiction)}</span>
        <strong>${escapeHtml(item.name)}</strong>
      </div>
      <em>${escapeHtml(item.risk_score)}/100 · ${escapeHtml(item.risk_level)}</em>
      <p>${escapeHtml(item.summary)}</p>
      <div class="wm-ai-drivers">
        ${(item.drivers || []).slice(0, 3).map((driver) => `<span>${escapeHtml(driver)}</span>`).join("")}
      </div>
      <small>${escapeHtml(item.next_action)}</small>
    </article>
  `).join("") || `<div class="empty-state">AI 风险研判加载中。</div>`;
}

function renderMap() {
  const scopedCases = visibleCases();
  const scopedSignals = visibleSignals();
  const scopedDocs = state.documents.filter(inSelectedJurisdiction).filter(inRange).filter(matchesSearch);
  const scopedLayerItems = mapLayerSignals();
  const gapCount = scopedCases.filter((item) => Number(item.document_count || 0) === 0).length;
  const p0Count = scopedLayerItems.filter((item) => item.priority === "P0").length;
  const viewport = regionViewports[state.region] || regionViewports.global;
  const geoPoint = (lon, lat) => {
    const point = projectLonLat(lon, lat);
    return `left:${point.xp.toFixed(2)}%; top:${point.yp.toFixed(2)}%;`;
  };
  const activeLayerJurisdictions = new Set();
  const points = jurisdictions
    .filter((item) => state.region === "global" || item.region === state.region)
    .map((item) => {
      const layerItems = layerItemsForJurisdiction(item.name);
      const layerCount = layerItems.length;
      const isActive = state.selectedJurisdiction === item.name;
      if (!layerCount) return "";
      activeLayerJurisdictions.add(item.name);
      const topPriority = layerItems.some((entry) => entry.priority === "P0") ? "P0" : item.priority;
      const intensity = Math.min(100, item.score + layerCount * 8);
      return `
        <button class="wm-map-point ${escapeHtml(topPriority)} ${isActive ? "active" : ""}" style="${geoPoint(item.lon, item.lat)}" data-jurisdiction="${escapeHtml(item.name)}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(topPriority)}</strong>
          <em>${escapeHtml(layerLabels[state.evidence] || state.evidence)} · ${layerCount} 条</em>
          <i style="width:${intensity}%"></i>
        </button>
      `;
    })
    .join("");
  const regionName = regionLabels[state.region] || "全球";
  const mapLabel = state.region === "global" ? "GLOBAL" : regionName.toUpperCase();

  $("#nordicMap").innerHTML = `
    <div class="wm-grid"></div>
    <div class="wm-scan"></div>
    <div class="wm-radar-ring one"></div>
    <div class="wm-radar-ring two"></div>
    <div class="wm-map-label">${escapeHtml(mapLabel)}</div>
    <div class="wm-map-viewport" style="--map-zoom:${state.zoom}; --map-origin-x:${viewport.originX}%; --map-origin-y:${viewport.originY}%;">
      ${renderGeoMap(activeLayerJurisdictions)}
      <div class="wm-risk-zone z-us"></div>
      <div class="wm-risk-zone z-eu"></div>
      <div class="wm-risk-zone z-fr"></div>
      <div class="wm-risk-zone z-de"></div>
      <div class="wm-risk-zone z-cn"></div>
      <div class="wm-place-label" style="${geoPoint(-79.3832, 43.6532)}">Toronto</div>
      <div class="wm-place-label" style="${geoPoint(-74.006, 40.7128)}">New York</div>
      <div class="wm-place-label" style="${geoPoint(-0.1276, 51.5072)}">UNITED KINGDOM</div>
      <div class="wm-place-label" style="${geoPoint(2.3522, 48.8566)}">FRANCE</div>
      <div class="wm-place-label" style="${geoPoint(13.405, 52.52)}">GERMANY</div>
      <div class="wm-place-label" style="${geoPoint(18.0686, 59.3293)}">SWEDEN</div>
      <div class="wm-place-label" style="${geoPoint(77.209, 28.6139)}">INDIA</div>
      <div class="wm-place-label" style="${geoPoint(116.4074, 39.9042)}">CHINA</div>
      <div class="wm-place-label" style="${geoPoint(139.6503, 35.6762)}">JAPAN</div>
      <div class="wm-place-label muted" style="${geoPoint(74, -25)}">INDIAN OCEAN</div>
      <div class="wm-route r1"></div>
      <div class="wm-route r2"></div>
      <div class="wm-route r3"></div>
      <div class="wm-source-pin" style="${geoPoint(4.3517, 50.8503)}">EUR-Lex</div>
      <div class="wm-source-pin" style="${geoPoint(2.3522, 48.8566)}">Judilibre</div>
      <div class="wm-source-pin" style="${geoPoint(-77.0369, 38.9072)}">CourtListener</div>
      <div class="wm-source-pin" style="${geoPoint(-77.0369, 38.9072)}">RECAP</div>
      <div class="wm-source-pin" style="${geoPoint(2.3522, 48.8566)}">SACD</div>
      <div class="wm-source-pin video" style="${geoPoint(30, 46)}">Video</div>
      <div class="wm-source-pin market" style="${geoPoint(-74.006, 40.7128)}">Market</div>
      <div class="wm-source-pin calendar" style="${geoPoint(13.405, 52.52)}">Calendar</div>
      ${points}
    </div>
    <div class="wm-region-stats">
      <article><span>CASES</span><strong>${scopedCases.length}</strong><em>当前案件</em></article>
      <article><span>DOCS</span><strong>${scopedDocs.length}</strong><em>文书记录</em></article>
      <article><span>LAYER</span><strong>${scopedLayerItems.length}</strong><em>当前图层</em></article>
      <article><span>GAPS</span><strong>${gapCount}</strong><em>无文书案件</em></article>
      <article class="danger"><span>P0</span><strong>${p0Count}</strong><em>最高风险</em></article>
    </div>
  `;

  document.querySelectorAll(".wm-map-point").forEach((point) => {
    point.addEventListener("click", () => {
      state.selectedJurisdiction = point.dataset.jurisdiction;
      updateSelectedJurisdiction();
      renderAll();
    });
  });
  updateMapViewportControls();
}

function renderIntel() {
  const target = $("#intelCards");
  if (!target) return;
  $("#evidenceTitle").textContent = evidenceTitles[state.evidence];
  if (state.evidence === "calendar") {
    target.innerHTML = renderCalendarPlanner();
    return;
  }
  const cards = getEvidenceItems().filter((item) => state.filter === "all" || item.priority === state.filter);
  target.innerHTML = cards.length
    ? cards.slice(0, 40).map(renderIntelCard).join("")
    : `<div class="empty-state">当前筛选条件下没有证据卡片。</div>`;
}

function renderCalendarPlanner() {
  const items = getCalendarEvidence().filter((item) => state.filter === "all" || item.priority === state.filter);
  const anchor = items[0]?.event_date ? new Date(items[0].event_date) : new Date();
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push({ blank: true });
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayItems = items.filter((item) => String(item.event_date || "").slice(0, 10) === dateKey);
    cells.push({ day, dateKey, items: dayItems });
  }
  while (cells.length % 7) cells.push({ blank: true });
  const monthTitle = anchor.toLocaleDateString("zh-CN", { year: "numeric", month: "long" });
  return `
    <section class="wm-calendar-planner">
      <div class="wm-calendar-head">
        <div>
          <span>LEGISLATION / JUDGMENT TODO</span>
          <strong>${escapeHtml(monthTitle)}</strong>
        </div>
        <em>${items.length} 个节点</em>
      </div>
      <div class="wm-calendar-weekdays">
        ${["一", "二", "三", "四", "五", "六", "日"].map((day) => `<span>${day}</span>`).join("")}
      </div>
      <div class="wm-calendar-grid">
        ${cells.map((cell) => cell.blank ? `<article class="blank"></article>` : `
          <article class="${cell.items?.length ? "has-event" : ""}">
            <strong>${cell.day}</strong>
            ${(cell.items || []).slice(0, 2).map((item) => `<span class="${escapeHtml(item.priority)}">${escapeHtml(item.priority)}</span>`).join("")}
          </article>
        `).join("")}
      </div>
      <div class="wm-todo-list">
        ${items.map((item) => `
          <article class="wm-todo-item ${escapeHtml(item.priority || "P2")}">
            ${priorityBadge(item.priority || "P2")}
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.summary || "等待补充说明。")}</p>
              <span>${escapeHtml(formatDate(item.event_date))} · ${escapeHtml(eventTypeLabels[item.event_type] || item.event_type)} · ${escapeHtml(jurisdictionLabels[item.jurisdiction] || item.jurisdiction)}</span>
            </div>
            <a href="${escapeHtml(safeUrl(item.source_url))}" target="_blank" rel="noreferrer">来源</a>
          </article>
        `).join("") || `<div class="empty-state">暂无日历待办。</div>`}
      </div>
    </section>
  `;
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
  const cases = visibleCases().sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0));
  $("#cases").innerHTML = cases.length
    ? cases
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
    .join("")
    : `<div class="empty-state">当前区域和时间窗口下没有诉讼对象。</div>`;

  document.querySelectorAll(".wm-case-card").forEach((card) => {
    card.addEventListener("click", () => showCase(card.dataset.caseId));
  });
}

function renderSources() {
  const target = $("#sourceStack");
  if (!target) return;
  const sourceItems = state.sources.length
    ? state.sources.filter((source) => state.region === "global" || source.jurisdiction === "Global" || regionForJurisdiction(source.jurisdiction) === state.region)
      .filter(matchesSearch)
    : [];
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
  const signals = mapLayerSignals().filter(inSelectedJurisdiction).slice(0, 14);
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
  const label = state.selectedJurisdiction ? jurisdictionLabels[state.selectedJurisdiction] || state.selectedJurisdiction : `${regionLabels[state.region] || "全球"}视图`;
  $("#activeJurisdiction").textContent = label;
  const activeRegion = $("#activeRegion");
  if (activeRegion) activeRegion.textContent = regionLabels[state.region] || "全球";
}

function updateMapViewportControls() {
  const viewport = regionViewports[state.region] || regionViewports.global;
  $("#mapLat").textContent = `lat ${viewport.lat.toFixed(1)}`;
  $("#mapLon").textContent = `lon ${viewport.lon.toFixed(1)}`;
  $("#mapZoom").textContent = `zoom ${state.zoom.toFixed(2)}`;
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
  $("#liveWindow").textContent = rangeLabel();
  document.querySelectorAll("[data-evidence]").forEach((item) => item.classList.toggle("active", item.dataset.evidence === value));
  renderAll();
}

function renderAll() {
  renderMetrics();
  renderAiAnalysis();
  renderChartDeck();
  renderMap();
  renderIntel();
  renderCases();
  renderSources();
  renderTimeline();
  renderLayerDetail();
  updateSelectedJurisdiction();
}

function attachEvents() {
  [$("#globalSearch"), $("#mapSearch")].filter(Boolean).forEach((input) => {
    input.addEventListener("input", (event) => {
      state.query = event.target.value || "";
      [$("#globalSearch"), $("#mapSearch")].filter(Boolean).forEach((otherInput) => {
        if (otherInput !== event.target) otherInput.value = state.query;
      });
      renderAll();
    });
  });

  $(".wm-floating-search")?.addEventListener("click", () => {
    document.body.classList.toggle("wm-search-open");
    if (document.body.classList.contains("wm-search-open")) {
      $("#mapSearch")?.focus();
    }
  });

  $(".filters")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    document.querySelectorAll(".filters button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderAll();
  });

  document.querySelectorAll("[data-evidence]").forEach((button) => {
    button.addEventListener("click", () => setEvidence(button.dataset.evidence));
  });

  document.querySelectorAll("[data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      state.range = button.dataset.range;
      document.querySelectorAll("[data-range]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      $("#liveWindow").textContent = rangeLabel();
      renderAll();
    });
  });

  document.querySelectorAll("[data-region]").forEach((button) => {
    button.addEventListener("click", () => {
      state.region = button.dataset.region;
      state.zoom = regionViewports[state.region]?.zoom || 1;
      state.selectedJurisdiction = null;
      document.querySelectorAll("[data-region]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderAll();
    });
  });

  document.querySelectorAll("[data-zoom-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.zoomAction;
      if (action === "in") state.zoom = Math.min(3.2, state.zoom + 0.25);
      if (action === "out") state.zoom = Math.max(0.8, state.zoom - 0.25);
      if (action === "reset") state.zoom = regionViewports[state.region]?.zoom || 1;
      renderMap();
    });
  });

  document.querySelectorAll("[data-map-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.mapAction;
      if (action === "toggle") {
        state.mapVisible = !state.mapVisible;
        document.body.classList.toggle("wm-map-hidden", !state.mapVisible);
        button.textContent = state.mapVisible ? "▼ 隐藏地图" : "▲ 显示地图";
        button.classList.toggle("active", !state.mapVisible);
      }
      if (action === "reset") {
        state.region = "global";
        state.zoom = regionViewports.global.zoom;
        state.selectedJurisdiction = null;
        state.mapVisible = true;
        document.body.classList.remove("wm-map-hidden");
        document.querySelectorAll("[data-region]").forEach((item) => item.classList.toggle("active", item.dataset.region === "global"));
        document.querySelector('[data-map-action="toggle"]').textContent = "▼ 隐藏地图";
        document.querySelector('[data-map-action="toggle"]').classList.remove("active");
        renderAll();
      }
    });
  });

  $("#resetJurisdiction")?.addEventListener("click", () => {
    state.region = "global";
    state.zoom = regionViewports.global.zoom;
    state.selectedJurisdiction = null;
    document.querySelectorAll("[data-region]").forEach((item) => item.classList.toggle("active", item.dataset.region === "global"));
    renderAll();
  });

  $("#closeDialog")?.addEventListener("click", () => $("#caseDialog").close());

  $("#runMonitor")?.addEventListener("click", async () => {
    const button = $("#runMonitor");
    button.disabled = true;
    button.textContent = "监控中";
    try {
      await api("/api/monitor/run", { method: "POST" });
      await api("/api/official-documents/run", { method: "POST" }).catch(() => null);
      await load();
    } finally {
      button.disabled = false;
      button.textContent = "运行监控";
    }
  });
}

async function load() {
  $("#refreshStatus").textContent = "正在同步";
  const [cases, organizations, documents, intel, sources, video, market, calendar, aiAnalysis, monitorRuns, worldGeo] = await Promise.all([
    api("/api/cases"),
    api("/api/organizations"),
    api("/api/documents"),
    api("/api/intel?status=published"),
    api("/api/source-health").catch(() => []),
    api("/api/video-intel").catch(() => []),
    api("/api/market-indicators").catch(() => []),
    api("/api/calendar-events").catch(() => []),
    api("/api/ai-analysis").catch(() => []),
    api("/api/monitor/runs").catch(() => []),
    loadWorldGeo().catch(() => null),
  ]);
  state.cases = cases;
  state.organizations = organizations;
  state.documents = documents;
  state.intel = intel;
  state.sources = sources;
  state.video = video;
  state.market = market;
  state.calendar = calendar;
  state.aiAnalysis = aiAnalysis;
  state.monitorRuns = monitorRuns;
  if (worldGeo) state.worldGeo = worldGeo;
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
