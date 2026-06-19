import argparse
import base64
import hashlib
import json
import os
import sqlite3
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "tracker.db"
STATIC_DIR = BASE_DIR / "static"
CONFIG_DIR = BASE_DIR / "config"
OFFICIAL_CONFIG_PATH = CONFIG_DIR / "official-sources.local.json"
MONITOR_HTTP_TIMEOUT = float(os.environ.get("MONITOR_HTTP_TIMEOUT", "1.8"))
MONITOR_RSS_TIMEOUT = float(os.environ.get("MONITOR_RSS_TIMEOUT", "4"))
MONITOR_RUN_BUDGET_SECONDS = float(os.environ.get("MONITOR_RUN_BUDGET_SECONDS", "38"))

OFFICIAL_SOURCE_CONFIGS = {
    "source_judilibre": {
        "label": "Judilibre",
        "jurisdiction": "France",
        "kind": "official_api",
        "credential_key": "JUDILIBRE_BEARER_TOKEN",
        "config_key": "judilibre",
        "default_search_url": "https://api.piste.gouv.fr/cassation/judilibre/v1.0/search",
        "registration_url": "https://www.data.gouv.fr/dataservices/api-judilibre",
        "notes": "法国司法裁判开放数据。需要 PISTE/API token 后才能自动查询。",
    },
    "source_legifrance": {
        "label": "Légifrance",
        "jurisdiction": "France",
        "kind": "official_api",
        "credential_key": "LEGIFRANCE_BEARER_TOKEN",
        "config_key": "legifrance",
        "default_search_url": "",
        "registration_url": "https://developer.aife.economie.gouv.fr",
        "notes": "法国官方法律信息 API。当前列为待接入，需要注册后确认 endpoint 权限。",
    },
    "source_eurlex": {
        "label": "EUR-Lex",
        "jurisdiction": "European Union",
        "kind": "official_database",
        "credential_key": "",
        "config_key": "eurlex",
        "default_search_url": "https://eur-lex.europa.eu/",
        "registration_url": "https://eur-lex.europa.eu/",
        "notes": "欧盟官方法律数据库。公开页面可归档；Web Service/SPARQL 可后续增强。",
    },
    "source_curia": {
        "label": "CURIA / CJEU",
        "jurisdiction": "European Union",
        "kind": "official_portal",
        "credential_key": "",
        "config_key": "curia",
        "default_search_url": "https://curia.europa.eu/",
        "registration_url": "https://curia.europa.eu/",
        "notes": "欧盟法院官方门户。当前列为官方入口归档源，后续接新闻稿/RSS/检索。",
    },
}

MONITOR_NEWS_QUERIES = [
    {
        "id": "news_eu_ai_copyright_litigation",
        "query": '"artificial intelligence" copyright lawsuit Europe OR "AI copyright" litigation Europe',
        "jurisdiction": "European Union",
        "priority": "P1",
        "tags": "AI copyright,Europe,litigation",
    },
    {
        "id": "news_fr_ai_copyright",
        "query": '"intelligence artificielle" "droit d\'auteur" France procès OR plainte',
        "jurisdiction": "France",
        "priority": "P1",
        "tags": "France,AI,droit auteur,litigation",
    },
    {
        "id": "news_de_ai_copyright",
        "query": 'GEMA OpenAI Suno KI Urheberrecht Klage',
        "jurisdiction": "Germany",
        "priority": "P1",
        "tags": "Germany,GEMA,OpenAI,Suno,copyright",
    },
    {
        "id": "news_uk_ai_copyright",
        "query": 'Getty Stability AI copyright lawsuit UK',
        "jurisdiction": "United Kingdom",
        "priority": "P1",
        "tags": "United Kingdom,Getty,Stability AI,copyright",
    },
    {
        "id": "news_eu_ai_copyright_trackers",
        "query": '"AI and Copyright Case Tracker" Europe GEMA Suno OpenAI Penguin',
        "jurisdiction": "European Union",
        "priority": "P1",
        "tags": "Europe,case tracker,AI copyright,litigation",
    },
    {
        "id": "news_de_penguin_openai",
        "query": '"Penguin Random House" OpenAI Germany copyright lawsuit',
        "jurisdiction": "Germany",
        "priority": "P1",
        "tags": "Germany,Penguin Random House,OpenAI,copyright,litigation",
    },
    {
        "id": "news_dk_koda_suno",
        "query": 'Koda Suno Denmark copyright lawsuit AI music',
        "jurisdiction": "Denmark",
        "priority": "P1",
        "tags": "Denmark,Koda,Suno,AI music,copyright,litigation",
    },
    {
        "id": "news_it_perplexity_rti",
        "query": '"RTI" "Medusa Film" Perplexity AI copyright Italy',
        "jurisdiction": "Italy",
        "priority": "P2",
        "tags": "Italy,RTI,Medusa Film,Perplexity,copyright,litigation",
    },
]

LEGISLATION_MONITORS = [
    {
        "id": "leg_eu_ai_act_gpai",
        "query": 'domain:digital-strategy.ec.europa.eu "GPAI Code of Practice" copyright',
        "jurisdiction": "European Union",
        "priority": "P1",
        "tags": "EU AI Act,GPAI,copyright,transparency,legislation",
    },
    {
        "id": "leg_eu_tdm_optout",
        "query": 'domain:eur-lex.europa.eu "text and data mining" copyright artificial intelligence',
        "jurisdiction": "European Union",
        "priority": "P1",
        "tags": "TDM,opt-out,DSM Directive,AI training,legislation",
    },
    {
        "id": "leg_fr_ai_copyright",
        "query": 'domain:culture.gouv.fr "intelligence artificielle" "droit d\'auteur"',
        "jurisdiction": "France",
        "priority": "P1",
        "tags": "France,AI,copyright,legislation",
    },
    {
        "id": "leg_fr_parliament_ai_copyright",
        "query": 'domain:assemblee-nationale.fr intelligence artificielle droit auteur',
        "jurisdiction": "France",
        "priority": "P1",
        "tags": "France,Assemblée nationale,AI,copyright,legislation",
    },
    {
        "id": "leg_fr_presumption_ai_content",
        "query": 'domain:assemblee-nationale.fr "présomption d’utilisation" "intelligence artificielle"',
        "jurisdiction": "France",
        "priority": "P0",
        "tags": "France,Assemblée nationale,Darcos bill,AI,copyright,presumption,legislation",
    },
    {
        "id": "leg_fr_conseil_etat_ai_content",
        "query": 'domain:conseil-etat.fr "présomption" "intelligence artificielle" "contenus culturels"',
        "jurisdiction": "France",
        "priority": "P0",
        "tags": "France,Conseil d'Etat,Darcos bill,AI,copyright,legislation",
    },
]

RIGHTS_HOLDER_MONITORS = [
    {
        "id": "rights_sacd",
        "query": 'domain:sacd.fr intelligence artificielle droit auteur',
        "organization_id": "org_sacd",
        "jurisdiction": "France",
        "priority": "P0",
        "tags": "SACD,rights-holder,AI,copyright",
    },
    {
        "id": "rights_sacd_darcos_bill",
        "query": 'domain:sacd.fr "preuve d\'utilisation" "IA" "Conseil d\'Etat"',
        "organization_id": "org_sacd",
        "jurisdiction": "France",
        "priority": "P0",
        "tags": "SACD,Darcos bill,rights-holder,AI,copyright,presumption",
    },
    {
        "id": "rights_figaro",
        "query": 'domain:lefigaro.fr intelligence artificielle droit auteur OpenAI',
        "organization_id": "org_figaro",
        "jurisdiction": "France",
        "priority": "P0",
        "tags": "Le Figaro,rights-holder,AI,copyright",
    },
    {
        "id": "rights_gema",
        "query": 'domain:gema.de OpenAI Suno KI Urheberrecht',
        "organization_id": "org_gema",
        "jurisdiction": "Germany",
        "priority": "P1",
        "tags": "GEMA,rights-holder,AI,copyright",
    },
    {
        "id": "rights_sgdl_sne",
        "query": 'SGDL SNE Meta Llama droit auteur intelligence artificielle',
        "organization_id": "org_sgdl",
        "jurisdiction": "France",
        "priority": "P1",
        "tags": "SGDL,SNE,Meta,Llama,rights-holder",
    },
    {
        "id": "rights_sne_presumption_bill",
        "query": 'domain:sne.fr "présomption d\'utilisation" "intelligence artificielle"',
        "organization_id": "org_sne",
        "jurisdiction": "France",
        "priority": "P1",
        "tags": "SNE,rights-holder,Darcos bill,AI,copyright,presumption",
    },
]

OFFICIAL_RSS_SOURCES = [
    {
        "id": "rss_curia_press",
        "name": "CURIA / CJEU RSS",
        "url": "http://curia.europa.eu/site/rss.jsp?lang=en&secondLang=fr",
        "jurisdiction": "European Union",
        "priority": "P1",
        "source_name": "CURIA / CJEU",
        "tags": "CURIA,CJEU,EU court,official",
        "keywords": ["copyright", "intellectual property", "artificial intelligence", "data mining", "database", "authors", "publishers"],
    },
    {
        "id": "rss_echr_news",
        "name": "ECHR RSS",
        "url": "https://www.echr.coe.int/rss",
        "jurisdiction": "Council of Europe",
        "priority": "P3",
        "source_name": "ECHR",
        "tags": "ECHR,official,property,expression",
        "keywords": ["copyright", "intellectual property", "property", "expression", "artificial intelligence"],
    },
]

MARKET_WATCHLIST = [
    ("market_msft", "MSFT", "Microsoft", "NASDAQ", "ai_platform", "United States", None, "OpenAI strategic partner; exposed to model training, Copilot and enterprise AI copyright risk."),
    ("market_meta", "META", "Meta Platforms", "NASDAQ", "ai_platform", "United States", None, "Llama training litigation and large-scale corpus risk."),
    ("market_googl", "GOOGL", "Alphabet", "NASDAQ", "ai_platform", "United States", None, "Search, Gemini and publisher licensing exposure."),
    ("market_adbe", "ADBE", "Adobe", "NASDAQ", "ai_platform", "United States", None, "Creative tools, Firefly licensing positioning and image-generation copyright risk."),
    ("market_nvda", "NVDA", "Nvidia", "NASDAQ", "ai_infrastructure", "United States", None, "AI infrastructure bellwether; adjacent IP and AI capex sensitivity."),
    ("market_gety", "GETY", "Getty Images", "NYSE", "rights_holder", "United States", "org_getty", "Image archive plaintiff and licensing benchmark for visual training data."),
    ("market_sstk", "SSTK", "Shutterstock", "NYSE", "rights_holder", "United States", None, "Stock media licensing bellwether for training data deals."),
    ("market_relx", "RELX", "RELX", "NYSE", "rights_holder", "United Kingdom", None, "Professional publishing and data licensing exposure."),
    ("market_pso", "PSO", "Pearson", "NYSE", "rights_holder", "United Kingdom", None, "Education publishing and book corpus licensing risk."),
    ("market_nws", "NWS", "News Corp", "NASDAQ", "publisher", "United States", None, "News and publishing licensing/litigation benchmark."),
]

VIDEO_INTEL_SEEDS = [
    (
        "video_ep_ai_act_multimedia",
        "欧洲议会多媒体中心：AI Act 与版权执行视频源",
        "European Parliament Multimedia Centre",
        "https://multimedia.europarl.europa.eu/",
        "official_video_portal",
        "European Union",
        None,
        "case_eu_tdm_watch",
        "P1",
        "watch",
        "2026-04-23T00:00:00+00:00",
        "追踪欧洲议会关于 AI Act、GPAI、创作者报酬和版权透明度的发布会、委员会视频和辩论视频，后续可接自动转写摘要。",
        "video,European Parliament,AI Act,GPAI,copyright,hearing",
    ),
    (
        "video_assemblee_fr_ai_bill",
        "法国国民议会视频源：AI 内容使用证明法案",
        "Assemblée nationale vidéos",
        "https://videos.assemblee-nationale.fr/",
        "official_video_portal",
        "France",
        None,
        "case_fr_ai_presumption_bill",
        "P0",
        "watch",
        "2026-06-03T00:00:00+00:00",
        "追踪法国国民议会围绕 Darcos 法案、文化事务委员会、AI 训练透明度和权利人举证推定的会议视频。",
        "video,Assemblée nationale,Darcos bill,AI,copyright,France",
    ),
    (
        "video_sacd_creator_campaign",
        "SACD 官方视频/采访源：创作者 AI 版权动员",
        "SACD",
        "https://www.sacd.fr/fr/recherche?search_api_fulltext=intelligence%20artificielle",
        "rights_holder_video",
        "France",
        "org_sacd",
        "case_watch_sacd_ai",
        "P0",
        "watch",
        "2026-05-05T00:00:00+00:00",
        "追踪 SACD 对 AI 训练、创作者报酬、AI Act 执行和法国举证推定法案的公开视频、采访和活动片段。",
        "video,SACD,creator campaign,AI,copyright,France",
    ),
    (
        "video_gema_ai_music",
        "GEMA 官方视频/活动源：AI 音乐版权诉讼",
        "GEMA",
        "https://www.gema.de/de/aktuelles/kuenstliche-intelligenz",
        "rights_holder_video",
        "Germany",
        "org_gema",
        "case_de_gema_suno",
        "P1",
        "watch",
        "2026-03-09T00:00:00+00:00",
        "追踪 GEMA 关于 OpenAI、Suno、音乐训练数据、歌词复现和生成式音乐授权的公开视频与活动。",
        "video,GEMA,Suno,OpenAI,AI music,copyright,Germany",
    ),
]

CALENDAR_EVENT_SEEDS = [
    (
        "cal_sne_statement_2026_06_12",
        "SNE 对法国政府削弱文化/新闻版权保护发声",
        "rights_pressure",
        "France",
        "case_fr_ai_presumption_bill",
        "org_sne",
        "P1",
        "2026-06-12T00:00:00+00:00",
        "https://www.sne.fr/actu/pourquoi-le-gouvernement-laisse-t-il-les-deputes-sattaquer-frontalement-a-la-culture-a-la-presse-et-a-la-creation-francaise/",
        "SNE",
        "权利人阵营继续围绕 Darcos 法案施压，关注是否引发修正案、投票节点或更强诉讼动员。",
        "completed",
    ),
    (
        "cal_fr_bill_committee_2026_06_02",
        "法国 AI 内容使用证明法案获委员会通过",
        "legislation_checkpoint",
        "France",
        "case_fr_ai_presumption_bill",
        "org_sne",
        "P0",
        "2026-06-02T00:00:00+00:00",
        "https://www.sne.fr/actu/preuve-dutilisation-des-contenus-culturels-par-lia-la-proposition-de-loi-adoptee-en-commission-par-les-deputes/",
        "SNE",
        "法国国民议会文化事务委员会通过文本，标志权利人举证推定机制进入更高优先级跟踪。",
        "completed",
    ),
    (
        "cal_gema_suno_expected_2026_07_31",
        "GEMA v. Suno 预期判决窗口",
        "judgment_expected",
        "Germany",
        "case_de_gema_suno",
        "org_gema",
        "P1",
        "2026-07-31T00:00:00+00:00",
        "https://www.taylorwessing.com/en/campaigns/de/2025/ai-and-copyright-tracker",
        "Taylor Wessing",
        "Taylor Wessing 跟踪器提示 GEMA v. Suno 判决预期。到期前应升级音乐生成诉讼监控频率。",
        "upcoming",
    ),
    (
        "cal_gpai_code_update_2026_04_23",
        "欧委会 GPAI Code 版权章节更新",
        "policy_update",
        "European Union",
        "case_eu_tdm_watch",
        None,
        "P1",
        "2026-04-23T00:00:00+00:00",
        "https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai",
        "European Commission",
        "GPAI Code 页面更新，继续跟踪 AI Act 第 53 条透明度和版权义务落地。",
        "completed",
    ),
]

NEWS_DOMAIN_ALLOWLIST = {
    "reuters.com": "Reuters",
    "apnews.com": "AP News",
    "lemonde.fr": "Le Monde",
    "lefigaro.fr": "Le Figaro",
    "theguardian.com": "The Guardian",
    "politico.eu": "Politico Europe",
    "euractiv.com": "Euractiv",
    "lawfaremedia.org": "Lawfare",
    "cms.law": "CMS",
    "taylorwessing.com": "Taylor Wessing",
    "mishcon.com": "Mishcon de Reya",
    "dlapiper.com": "DLA Piper",
    "hoganlovells.com": "Hogan Lovells",
    "musicbusinessworldwide.com": "Music Business Worldwide",
    "digitalmusicnews.com": "Digital Music News",
    "juve-patent.com": "JUVE Patent",
    "thetechnollama.wordpress.com": "The Technollama",
    "koda.dk": "Koda",
    "sacd.fr": "SACD",
    "gema.de": "GEMA",
    "sgdl.org": "SGDL",
    "sne.fr": "SNE",
    "eur-lex.europa.eu": "EUR-Lex",
    "digital-strategy.ec.europa.eu": "European Commission",
    "commission.europa.eu": "European Commission",
    "europarl.europa.eu": "European Parliament",
    "consilium.europa.eu": "Council of the European Union",
    "culture.gouv.fr": "France Ministry of Culture",
    "assemblee-nationale.fr": "Assemblée nationale",
    "senat.fr": "Sénat",
    "conseil-etat.fr": "Conseil d'Etat",
    "legifrance.gouv.fr": "Légifrance",
    "arcom.fr": "Arcom",
    "cnil.fr": "CNIL",
}


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def read_sql(name):
    return (BASE_DIR / "db" / name).read_text(encoding="utf-8")


def init_db(reset=False):
    if reset and DB_PATH.exists():
        DB_PATH.unlink()
    with connect() as conn:
        conn.executescript(read_sql("schema.sql"))
        seed(conn)


def safe_print(message):
    try:
        print(message)
    except Exception:
        pass


def stable_hash(*parts):
    raw = "|".join(str(part or "") for part in parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def load_official_config():
    config = {}
    if OFFICIAL_CONFIG_PATH.exists():
        try:
            config = json.loads(OFFICIAL_CONFIG_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            config = {}
    return config


def official_config_for(source_id):
    source_config = OFFICIAL_SOURCE_CONFIGS[source_id]
    local_config = load_official_config().get(source_config["config_key"], {})
    token = os.environ.get(source_config["credential_key"], "") if source_config["credential_key"] else ""
    token = local_config.get("bearer_token") or token
    client_id = local_config.get("client_id") or os.environ.get(f"{source_config['config_key'].upper()}_CLIENT_ID", "")
    client_secret = local_config.get("client_secret") or os.environ.get(f"{source_config['config_key'].upper()}_CLIENT_SECRET", "")
    key_id = local_config.get("key_id") or os.environ.get(f"{source_config['config_key'].upper()}_KEY_ID", "")
    extra_headers = dict(local_config.get("headers", {}))
    if key_id:
        extra_headers.setdefault("KeyId", key_id)
    return {
        **source_config,
        "enabled": bool(local_config.get("enabled", True)),
        "search_url": local_config.get("search_url") or source_config["default_search_url"],
        "token_url": local_config.get("token_url", ""),
        "bearer_token": token,
        "key_id": key_id,
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": local_config.get("scope", "openid"),
        "auth_style": local_config.get("auth_style", "body"),
        "extra_headers": extra_headers,
        "query_limit": int(local_config.get("query_limit", 5)),
    }


def official_source_status(conn):
    source_rows = {item["id"]: item for item in rows(conn, "SELECT * FROM sources")}
    status_rows = []
    for source_id, source_config in OFFICIAL_SOURCE_CONFIGS.items():
        runtime = official_config_for(source_id)
        source = source_rows.get(source_id, {})
        needs_token = bool(runtime["credential_key"])
        has_direct_token = bool(runtime["bearer_token"])
        has_key_id = bool(runtime["key_id"] or runtime["extra_headers"].get("KeyId"))
        has_oauth_credentials = bool(runtime["client_id"] and runtime["client_secret"] and runtime["token_url"])
        configured = bool(runtime["search_url"]) and (not needs_token or has_direct_token or has_key_id or has_oauth_credentials)
        status_rows.append(
            {
                "id": source_id,
                "name": source.get("name") or runtime["label"],
                "jurisdiction": runtime["jurisdiction"],
                "kind": runtime["kind"],
                "configured": configured,
                "needs_token": needs_token,
                "enabled": runtime["enabled"],
                "search_url": runtime["search_url"],
                "registration_url": runtime["registration_url"],
                "last_checked_at": source.get("last_checked_at"),
                "notes": source.get("notes") or runtime["notes"],
            }
        )
    return status_rows


def request_json(url, token="", headers=None, payload=None, timeout=30):
    request_headers = {
        "Accept": "application/json",
        "User-Agent": "AI-Copyright-Risk-Tracker/0.1",
    }
    if token:
        request_headers["Authorization"] = f"Bearer {token}"
    if headers:
        request_headers.update(headers)
    data = None
    method = "GET"
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request_headers["Content-Type"] = "application/json"
        method = "POST"
    req = Request(url, data=data, headers=request_headers, method=method)
    with urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def request_text(url, timeout=8):
    req = Request(url, headers={"User-Agent": "AI-Copyright-Risk-Tracker/0.1"})
    with urlopen(req, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_oauth_application_token(config):
    if config.get("bearer_token"):
        return config["bearer_token"]
    if not config.get("client_id") or not config.get("client_secret") or not config.get("token_url"):
        return ""

    form = {
        "grant_type": "client_credentials",
    }
    if config.get("scope"):
        form["scope"] = config["scope"]

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "AI-Copyright-Risk-Tracker/0.1",
    }
    if config.get("auth_style") == "basic":
        raw = f"{config['client_id']}:{config['client_secret']}".encode("utf-8")
        headers["Authorization"] = "Basic " + base64.b64encode(raw).decode("ascii")
    else:
        form["client_id"] = config["client_id"]
        form["client_secret"] = config["client_secret"]

    req = Request(config["token_url"], data=urlencode(form).encode("utf-8"), headers=headers, method="POST")
    try:
        with urlopen(req, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8", errors="replace"))
    except HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"OAuth token request failed: HTTP {exc.code} {details}") from exc

    token = payload.get("access_token") or payload.get("token")
    if not token:
        raise RuntimeError("OAuth token response did not include access_token")
    return token


def extract_judilibre_items(payload):
    if isinstance(payload, list):
        return payload
    for key in ("results", "decisions", "items", "data"):
        value = payload.get(key) if isinstance(payload, dict) else None
        if isinstance(value, list):
            return value
    if isinstance(payload, dict) and isinstance(payload.get("response"), dict):
        return extract_judilibre_items(payload["response"])
    return []


def normalize_judilibre_item(item, query):
    decision_id = item.get("id") or item.get("decision_id") or item.get("numero") or stable_hash(query, item)
    title = item.get("title") or item.get("titre") or item.get("formation") or f"Judilibre 命中文书 {decision_id}"
    text = item.get("text") or item.get("texte") or item.get("summary") or item.get("sommaire") or ""
    date = item.get("date") or item.get("decision_date") or item.get("date_decision")
    ecli = item.get("ecli") or item.get("ECLI")
    case_number = item.get("number") or item.get("numero") or item.get("pourvoi") or item.get("case_number")
    source_url = item.get("url") or item.get("source_url") or f"https://www.courdecassation.fr/decision/{decision_id}"
    summary = text[:700] if text else f"Judilibre 官方 API 对关键词“{query}”返回命中，需人工审核是否与 AI 版权诉讼相关。"
    return {
        "id": f"doc_judilibre_{stable_hash(decision_id, query)[:16]}",
        "title": title,
        "source_url": source_url,
        "document_type": "court_decision",
        "jurisdiction": "France",
        "confidence": "official",
        "document_date": date,
        "sha256": stable_hash("judilibre", decision_id, title, text),
        "ecli": ecli,
        "case_number": case_number,
        "extracted_text": text,
        "summary_cn": summary,
        "raw_payload": item,
    }


def seed(conn):
    now = utc_now()
    organizations = [
        ("org_sacd", "SACD", "Société des Auteurs et Compositeurs Dramatiques", "France", "rights_org", "P0", 97, "Audiovisual, theatre, screenwriter and director rights. Treat any AI-training litigation signal as immediate review."),
        ("org_figaro", "Le Figaro / Groupe Figaro", "French news publisher and media group", "France", "publisher", "P0", 96, "High-value news corpus owner. Watch copyright, neighboring rights, database right, licensing and opt-out signals."),
        ("org_sgdl", "SGDL", "Société des gens de lettres", "France", "rights_org", "P1", 88, "Author-side organization involved in AI training litigation signals."),
        ("org_sne", "SNE", "Syndicat national de l'édition", "France", "industry_org", "P1", 87, "French publishers association; central for book and corpus disputes."),
        ("org_snac", "SNAC", "Syndicat national des auteurs et des compositeurs", "France", "rights_org", "P1", 82, "Author and composer interests; relevant in collective creator claims."),
        ("org_sacem", "SACEM", "Société des auteurs, compositeurs et éditeurs de musique", "France", "cmo", "P1", 85, "Music works and licensing leverage; watch audio model and training disputes."),
        ("org_scam", "SCAM", "Société civile des auteurs multimédia", "France", "cmo", "P1", 79, "Documentary, journalism and multimedia authors; relevant to text/video corpus use."),
        ("org_adagp", "ADAGP", "Société des auteurs dans les arts graphiques et plastiques", "France", "cmo", "P1", 80, "Visual artists and image training risk."),
        ("org_afp", "AFP", "Agence France-Presse", "France", "publisher", "P2", 72, "High-value news and media corpus; also likely to pursue licensing strategies."),
        ("org_arcom", "ARCOM", "Autorité de régulation de la communication audiovisuelle et numérique", "France", "regulator", "P2", 65, "Regulatory signal source, not a rights-holder plaintiff."),
        ("org_cnil", "CNIL", "Commission nationale de l'informatique et des libertés", "France", "regulator", "P2", 64, "Data protection regulator; monitor where training data disputes overlap with privacy."),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO organizations
        (id, name, full_name, jurisdiction, category, priority, risk_score, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [row + (now, now) for row in organizations],
    )

    cases = [
        (
            "case_fr_meta_books3",
            "French authors and publishers v. Meta over Llama training corpus",
            "France",
            "Tribunal judiciaire de Paris",
            None,
            None,
            "CASE",
            "pending",
            "copyright_infringement,text_and_data_mining,training_data",
            "Meta Llama",
            91,
            "P1",
            "Reported French action by SGDL, SNE and SNAC against Meta concerning alleged unauthorized use of protected books in AI training. Official court document still needs capture.",
        ),
        (
            "case_watch_sacd_ai",
            "SACD AI copyright enforcement watch",
            "France",
            None,
            None,
            None,
            "WATCH",
            "monitoring",
            "policy_pressure,creator_remuneration,training_transparency",
            "General-purpose AI systems",
            97,
            "P0",
            "P0 watch object for SACD statements, court filings, AI Act implementation pressure and creator compensation claims.",
        ),
        (
            "case_watch_figaro_ai",
            "Le Figaro AI content use watch",
            "France",
            None,
            None,
            None,
            "WATCH",
            "monitoring",
            "neighboring_rights,copyright,database_right,opt_out,licensing",
            "OpenAI, Google, Meta, Perplexity, Mistral",
            96,
            "P0",
            "P0 watch object for Groupe Figaro litigation, licensing, opt-out and neighboring-rights signals.",
        ),
        (
            "case_fr_ai_presumption_bill",
            "法国 AI 内容使用证明推定法案监控",
            "France",
            "Assemblée nationale / Sénat / Conseil d'Etat",
            None,
            None,
            "WATCH",
            "委员会审议与官方意见跟踪",
            "legislation,burden_of_proof,presumption,training_transparency,copyright",
            "General-purpose AI systems",
            94,
            "P0",
            "法国围绕 AI 使用受保护内容的举证推定和透明度规则推进立法。该对象聚合 SACD/SNE 等权利人发声、Assemblée nationale 程序和 Conseil d'Etat 意见。",
        ),
        (
            "case_eu_tdm_watch",
            "EU TDM and AI Act copyright implementation watch",
            "European Union",
            "CJEU / EU institutions",
            None,
            None,
            "WATCH",
            "monitoring",
            "tdm_exception,opt_out,transparency,ai_act",
            "General-purpose AI systems",
            84,
            "P1",
            "Tracks preliminary references, guidance and implementation measures affecting AI training transparency and TDM opt-outs.",
        ),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO cases
        (id, title, jurisdiction, court, case_number, ecli, status, procedural_stage, claim_types, ai_systems, risk_score, priority, summary, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [row + (now, now) for row in cases],
    )

    links = [
        ("case_watch_sacd_ai", "org_sacd", "watch_target"),
        ("case_watch_figaro_ai", "org_figaro", "watch_target"),
        ("case_fr_ai_presumption_bill", "org_sacd", "rights_holder_support"),
        ("case_fr_ai_presumption_bill", "org_sne", "rights_holder_support"),
        ("case_fr_meta_books3", "org_sgdl", "plaintiff_org"),
        ("case_fr_meta_books3", "org_sne", "plaintiff_org"),
        ("case_fr_meta_books3", "org_snac", "plaintiff_org"),
    ]
    conn.executemany(
        "INSERT OR IGNORE INTO case_organizations (case_id, organization_id, role) VALUES (?, ?, ?)",
        links,
    )

    sources = [
        ("source_judilibre", "Judilibre", "official_api", "France", "https://www.data.gouv.fr/dataservices/api-judilibre", "daily", "Official French judicial decision open-data API."),
        ("source_legifrance", "Légifrance", "official_portal", "France", "https://www.legifrance.gouv.fr/", "daily", "Official French legal information portal."),
        ("source_curia", "CURIA / CJEU", "official_portal", "European Union", "https://curia.europa.eu/", "daily", "CJEU and General Court case-law, opinions and press releases."),
        ("source_eurlex", "EUR-Lex", "official_portal", "European Union", "https://eur-lex.europa.eu/", "daily", "Official EU law and case-law database."),
        ("source_hudoc", "HUDOC", "official_database", "Council of Europe", "https://hudoc.echr.coe.int/", "weekly", "ECHR database for peripheral freedom-of-expression and property-rights signals."),
        ("source_sacd", "SACD official site", "official_site", "France", "https://www.sacd.fr/", "daily", "P0 watch source for author-side AI copyright statements."),
        ("source_sne", "SNE official site", "official_site", "France", "https://www.sne.fr/", "daily", "French publishers' association statements on AI training, litigation and copyright legislation."),
        ("source_figaro", "Le Figaro / Groupe Figaro", "publisher_site", "France", "https://www.lefigaro.fr/", "daily", "P0 watch source for litigation, licensing and neighboring-rights signals."),
        ("source_conseil_etat", "Conseil d'Etat", "official_portal", "France", "https://www.conseil-etat.fr/", "daily", "French official legal opinions and administrative court signals for AI copyright policy."),
        ("source_assemblee", "Assemblée nationale", "official_portal", "France", "https://www.assemblee-nationale.fr/", "daily", "French parliamentary dossiers and amendments for AI copyright legislation."),
        ("source_cms_ai_tracker", "CMS AI copyright case tracker", "law_firm_tracker", "Europe", "https://cms.law/", "daily", "European AI copyright case tracker used as a legal intelligence discovery layer."),
        ("source_taylor_wessing_ai_tracker", "Taylor Wessing AI copyright tracker", "law_firm_tracker", "Europe", "https://www.taylorwessing.com/", "daily", "European AI and copyright tracker used to discover recent litigation procedural updates."),
        ("source_mishcon_ai_ip_tracker", "Mishcon AI and IP cases tracker", "law_firm_tracker", "Europe", "https://www.mishcon.com/", "weekly", "AI and IP cases tracker used as a secondary litigation intelligence source."),
        ("source_video_portals", "Official and rights-holder video portals", "video_monitor", "Europe", "European Parliament / Assemblée nationale / SACD / GEMA", "daily", "Video intelligence discovery layer for hearings, press conferences, interviews and webinars."),
        ("source_market_yahoo", "Yahoo Finance delayed market data", "market_data", "Global", "https://query1.finance.yahoo.com/", "hourly", "Delayed public market data for AI platform and rights-holder exposure basket."),
        ("source_calendar_watch", "Legislative and judgment calendar", "calendar_watch", "Europe", "Internal event calendar + official sources", "daily", "Calendar layer for hearings, votes, expected judgments and policy deadlines."),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO sources
        (id, name, source_type, jurisdiction, base_url, refresh_cadence, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [row + (now, now) for row in sources],
    )

    docs = []
    conn.executemany(
        """
        INSERT OR IGNORE INTO documents
        (id, case_id, source_id, title, source_url, document_type, jurisdiction, confidence, extracted_text, sha256, captured_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [row + (stable_hash(*row), now, now) for row in docs],
    )

    keywords = [
        ("kw_sacd_ia", "org_sacd", "SACD intelligence artificielle droit d'auteur"),
        ("kw_sacd_rogard", "org_sacd", "Pascal Rogard IA générative auteurs"),
        ("kw_figaro_openai", "org_figaro", "Le Figaro OpenAI droit d'auteur"),
        ("kw_figaro_neighboring", "org_figaro", "Groupe Figaro droits voisins intelligence artificielle"),
        ("kw_sgdl_meta", "org_sgdl", "SGDL Meta Llama Books3 Tribunal judiciaire Paris"),
        ("kw_sne_meta", "org_sne", "SNE Meta intelligence artificielle droit auteur"),
        ("kw_sacem_ai", "org_sacem", "SACEM intelligence artificielle droit auteur"),
        ("kw_adagp_ai", "org_adagp", "ADAGP intelligence artificielle artistes"),
    ]
    conn.executemany(
        "INSERT OR IGNORE INTO monitor_keywords (id, organization_id, query) VALUES (?, ?, ?)",
        keywords,
    )

    intel_cards = [
        (
            "intel_fr_meta_ap_2025_03_12",
            "French authors and publishers sue Meta over AI training",
            "AP reported that French authors and publishers brought a Paris action against Meta over alleged unauthorized use of copyrighted books to train Llama. Treat as a France P1 litigation lead until an official court document is captured.",
            "https://apnews.com/article/168b32059e70d0509b0a6ac407f37e8a",
            "AP News",
            "news",
            "France",
            "org_sgdl",
            "case_fr_meta_books3",
            "P1",
            "published",
            "news",
            "Meta,Llama,Books3,SGDL,SNE,SNAC,Paris",
            "media_lead",
            8,
            "2025-03-12T00:00:00+00:00",
        ),
        (
            "intel_fr_meta_lemonde_2025_03_12",
            "Le Monde reports French authors and publishers attack Meta",
            "Le Monde reported that authors and publishers attacked Meta for copyright violation tied to AI training. This corroborates the France Meta/Llama litigation lead but still needs official case-number capture.",
            "https://www.lemonde.fr/economie/article/2025/03/12/auteurs-et-editeurs-attaquent-meta-pour-violation-du-droit-d-auteur_6579662_3234.html",
            "Le Monde",
            "news",
            "France",
            "org_sne",
            "case_fr_meta_books3",
            "P1",
            "published",
            "news",
            "Meta,Llama,authors,publishers,copyright",
            "media_lead",
            7,
            "2025-03-12T00:00:00+00:00",
        ),
        (
            "intel_sacd_lemonde_ai_summit_2025_02_09",
            "SACD cited in creator pushback before Paris AI summit",
            "Le Monde reported creator-side pressure over alleged use of protected content by AI systems before the Paris AI summit. SACD remains P0 because statements can quickly translate into lobbying, opt-out pressure or litigation strategy.",
            "https://www.lemonde.fr/en/economy/article/2025/02/09/ai-manufacturers-have-stolen-all-our-content-how-creators-are-trying-to-assert-their-rights_6737965_19.html",
            "Le Monde",
            "news",
            "France",
            "org_sacd",
            "case_watch_sacd_ai",
            "P0",
            "published",
            "news",
            "SACD,AI summit,creators,copyright,training data",
            "media_lead",
            9,
            "2025-02-09T00:00:00+00:00",
        ),
        (
            "intel_eu_ai_act_guardian_2025_02_18",
            "EU AI Act copyright loophole debate intensifies",
            "The Guardian reported rights-holder concern that the AI Act leaves loopholes around copyright and training transparency. Track at EU level because it can shape enforcement and disclosure expectations.",
            "https://www.theguardian.com/technology/2025/feb/18/eu-accused-of-opening-the-door-to-ai-copyright-loophole",
            "The Guardian",
            "news",
            "European Union",
            None,
            "case_eu_tdm_watch",
            "P1",
            "published",
            "news",
            "AI Act,copyright,training transparency,opt-out",
            "media_lead",
            5,
            "2025-02-18T00:00:00+00:00",
        ),
        (
            "intel_de_gema_openai_guardian_2025_11_11",
            "German court orders OpenAI to pay damages in GEMA copyright case",
            "The Guardian reported a German court ruling ordering OpenAI to pay damages over song lyric use in ChatGPT. This is a high-signal European litigation item and should be followed for the underlying judgment and appeals.",
            "https://www.theguardian.com/technology/2025/nov/11/german-court-orders-openai-to-pay-damages-for-copyright-breach-in-landmark-ruling",
            "The Guardian",
            "news",
            "Germany",
            None,
            None,
            "P1",
            "published",
            "news",
            "GEMA,OpenAI,ChatGPT,lyrics,Germany,copyright",
            "media_lead",
            10,
            "2025-11-11T00:00:00+00:00",
        ),
        (
            "intel_eu_ai_act_official_2024_07_12",
            "EU AI Act official text entered the monitoring base",
            "The official EU AI Act text is monitored as the legal baseline for GPAI transparency and copyright-related compliance. It is not a court document, but it is an official legal source for the EU risk layer.",
            "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
            "EUR-Lex",
            "official_legal_database",
            "European Union",
            None,
            "case_eu_tdm_watch",
            "P1",
            "published",
            "official_court_document",
            "AI Act,EUR-Lex,GPAI,copyright,transparency",
            "official",
            6,
            "2024-07-12T00:00:00+00:00",
        ),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO intelligence_cards
        (id, title, summary, source_url, source_name, source_type, jurisdiction, organization_id,
         case_id, priority, status, signal_type, tags, confidence, risk_delta,
         signal_date, created_at, updated_at, approved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [row[:-1] + (row[-1], now, now, now if row[10] == "published" else None) for row in intel_cards],
    )
    case_updates = [
        (
            "2026-03-09 口头审理 / 2026-07-31 判决预期",
            "GEMA 在慕尼黑针对 Suno 提起 AI 音乐版权诉讼。Taylor Wessing 跟踪器显示该案 2026-03-09 已进入口头审理节点，并提示 2026-07-31 判决预期，需要持续追踪判决全文和上诉动态。",
            now,
            "case_de_gema_suno",
        ),
        (
            "2026-03-27 已起诉 / 诉讼待审",
            "Penguin Random House Verlagsgruppe 在德国慕尼黑起诉 OpenAI，CMS/Taylor Wessing 跟踪器列为 2026-03-27 版权侵权诉讼。该案把欧洲图书出版商与 OpenAI 的训练数据风险推到高优先级。",
            now,
            "case_de_penguin_openai",
        ),
    ]
    conn.executemany(
        "UPDATE cases SET procedural_stage = ?, summary = ?, updated_at = ? WHERE id = ?",
        case_updates,
    )

    organization_cn = [
        ("org_sacd", "法国戏剧作者与作曲者协会", "法国戏剧、影视、编剧和导演作者权益组织。任何 AI 训练数据、作者报酬或透明度线索都进入最高优先级审核。"),
        ("org_figaro", "法国新闻出版集团", "高价值新闻语料权利人。重点监控版权、邻接权、数据库权、授权谈判和 opt-out 动态。"),
        ("org_sgdl", "法国作家协会", "法国作家权益组织，和图书语料、Books3、AI 训练数据争议高度相关。"),
        ("org_sne", "法国出版商协会", "法国出版业核心行业组织，图书出版与训练语料争议中的关键主体。"),
        ("org_snac", "法国作者与作曲者工会", "作者和作曲者组织，适合监控集体维权和作者侧诉讼线索。"),
        ("org_sacem", "法国音乐作者、作曲者和出版者协会", "音乐版权核心组织。重点监控歌词、音乐生成模型和训练数据授权争议。"),
        ("org_scam", "法国多媒体作者协会", "纪录片、新闻、多媒体作者相关组织，和文本/视频语料训练风险相关。"),
        ("org_adagp", "法国视觉艺术作者协会", "视觉艺术和图像权利组织，重点监控图片生成模型和图像训练数据。"),
        ("org_afp", "法新社", "高价值新闻和图片语料来源，既可能诉讼，也可能通过授权协议解决。"),
        ("org_arcom", "法国视听与数字通信监管机构", "监管信号源，不是权利人原告，但会影响平台合规和政策走向。"),
        ("org_cnil", "法国数据保护监管机构", "数据保护监管机构，关注训练数据争议与个人数据、抓取合规的交叉风险。"),
    ]
    conn.executemany(
        "UPDATE organizations SET full_name = ?, notes = ?, updated_at = ? WHERE id = ?",
        [(full_name, notes, now, org_id) for org_id, full_name, notes in organization_cn],
    )

    case_cn = [
        ("case_fr_meta_books3", "法国作者和出版商诉 Meta / Llama 训练语料案", "待官方文书确认", "SGDL、SNE、SNAC 针对 Meta/Llama 训练语料的法国诉讼线索，涉及受版权保护图书是否被未经授权用于训练。仍需抓取官方法院文书或案号。"),
        ("case_watch_sacd_ai", "SACD AI 版权维权动态监控", "持续监控", "SACD 是 P0 监控对象。重点跟踪权利人声明、法院动作、AI Act 落地压力和创作者补偿主张。"),
        ("case_watch_figaro_ai", "Le Figaro 新闻内容 AI 使用风险监控", "持续监控", "Groupe Figaro 是 P0 监控对象。重点跟踪诉讼、授权谈判、opt-out、邻接权和新闻语料复用线索。"),
        ("case_fr_ai_presumption_bill", "法国 AI 内容使用证明推定法案监控", "委员会审议与官方意见跟踪", "法国围绕 AI 使用受保护内容的举证推定和透明度规则推进立法。该对象聚合 SACD/SNE 等权利人发声、Assemblée nationale 程序和 Conseil d'État 意见。"),
        ("case_eu_tdm_watch", "欧盟 TDM 例外与 AI Act 版权执行监控", "持续监控", "跟踪影响 AI 训练透明度、TDM 例外、opt-out 和 GPAI 合规的欧盟法院、官方解释和执行动态。"),
    ]
    conn.executemany(
        "UPDATE cases SET title = ?, procedural_stage = ?, summary = ?, updated_at = ? WHERE id = ?",
        [(title, stage, summary, now, case_id) for case_id, title, stage, summary in case_cn],
    )

    source_cn = [
        ("source_judilibre", "Judilibre", "法国司法裁判开放数据 API，用于抓取官方裁判文书。"),
        ("source_legifrance", "Légifrance", "法国官方法律信息门户，用于补充判例、法规和法律引用。"),
        ("source_curia", "CURIA / CJEU", "欧盟法院和普通法院判例、意见和新闻稿来源。"),
        ("source_eurlex", "EUR-Lex", "欧盟官方法律和判例数据库。"),
        ("source_hudoc", "HUDOC", "欧洲人权法院数据库，用于外围表达自由和财产权风险。"),
        ("source_sacd", "SACD 官方网站", "SACD 权利人声明和 AI 版权立场的 P0 监控源。"),
        ("source_sne", "SNE 官方网站", "法国出版商协会关于 AI 训练、图书语料、立法和诉讼的权利人发声源。"),
        ("source_figaro", "Le Figaro / Groupe Figaro", "Le Figaro 诉讼、授权、邻接权和新闻语料信号源。"),
        ("source_conseil_etat", "Conseil d'État", "法国行政最高法院和政府咨询意见来源，重点追踪 AI 内容使用证明和立法意见。"),
        ("source_assemblee", "Assemblée nationale", "法国国民议会议案、委员会和修正案来源，用于追踪 AI 版权立法进度。"),
        ("source_cms_ai_tracker", "CMS AI 版权案件跟踪器", "欧洲 AI 版权诉讼跟踪器，作为近期诉讼程序节点发现源。"),
        ("source_taylor_wessing_ai_tracker", "Taylor Wessing AI 版权跟踪器", "欧洲 AI 与版权案件跟踪器，用于补充近期案件状态和日期。"),
        ("source_mishcon_ai_ip_tracker", "Mishcon AI/IP 案件跟踪器", "AI 与知识产权案件跟踪器，用作次级法律情报源。"),
        ("source_video_portals", "官方与权利人视频源", "欧洲议会、法国国民议会、SACD、GEMA 等视频/听证/采访源，用于形成视频情报卡。"),
        ("source_market_yahoo", "Yahoo Finance 延迟市场数据", "AI 平台和权利人风险篮子的公开延迟行情源；仅作为风险敏感度辅助指标，不作为法律证据。"),
        ("source_calendar_watch", "立法与判决日历", "听证、投票、判决预期和政策截止日监控源。"),
    ]
    conn.executemany(
        "UPDATE sources SET name = ?, notes = ?, updated_at = ? WHERE id = ?",
        [(name, notes, now, source_id) for source_id, name, notes in source_cn],
    )
    conn.execute("DELETE FROM sources WHERE id = 'source_market_stooq'")

    conn.execute("DELETE FROM documents WHERE id IN ('doc_seed_judilibre', 'doc_seed_eurlex')")

    intel_cn = [
        ("intel_de_gema_openai_guardian_2025_11_11", "德国法院判令 OpenAI 在 GEMA 版权案中赔偿", "The Guardian 报道德国法院认定 OpenAI 在 ChatGPT 歌词使用中构成版权侵权并需赔偿。该项属于欧洲范围内高信号诉讼情报，需要继续追踪原始判决和上诉动态。"),
        ("intel_fr_meta_ap_2025_03_12", "法国作者和出版商就 AI 训练起诉 Meta", "AP 报道法国作者和出版商在巴黎针对 Meta 提起诉讼，指控其未经授权使用受版权保护图书训练 Llama。当前标记为法国 P1 诉讼线索，等待官方法院文书或案号确认。"),
        ("intel_fr_meta_lemonde_2025_03_12", "Le Monde 报道法国作者和出版商攻击 Meta 版权侵权", "Le Monde 报道法国作者和出版商围绕 AI 训练对 Meta 发起版权侵权行动。该情报与 AP 报道相互印证，但仍需补齐官方法院文书、案号和程序状态。"),
        ("intel_eu_ai_act_guardian_2025_02_18", "EU AI Act 版权漏洞争议升温", "The Guardian 报道权利人担心 AI Act 在版权和训练透明度方面留下漏洞。该情报归入欧盟层 P1，因为它可能影响训练数据披露、opt-out 和 GPAI 合规预期。"),
        ("intel_sacd_lemonde_ai_summit_2025_02_09", "巴黎 AI 峰会前 SACD 出现在创作者版权压力报道中", "Le Monde 报道巴黎 AI 峰会前创作者阵营对受保护内容被 AI 使用表达强烈不满。SACD 仍为 P0，因为相关表态可能迅速转化为游说、opt-out 压力或诉讼策略。"),
        ("intel_eu_ai_act_official_2024_07_12", "EU AI Act 官方文本纳入监控基线", "EUR-Lex 上的 EU AI Act 官方文本被纳入欧盟风险层监控，作为 GPAI 透明度和版权相关合规的法律基线。它不是法院判决，但属于官方法律来源。"),
    ]
    conn.executemany(
        "UPDATE intelligence_cards SET title = ?, summary = ?, updated_at = ? WHERE id = ?",
        [(title, summary, now, card_id) for card_id, title, summary in intel_cn],
    )
    conn.execute(
        """
        UPDATE intelligence_cards
        SET signal_type = 'legislation_update',
            source_type = 'official_legal_database',
            updated_at = ?
        WHERE id = 'intel_eu_ai_act_official_2024_07_12'
        """,
        (now,),
    )
    seed_extra_european_ai_litigation(conn, now)
    seed_worldmonitor_extensions(conn, now)


def seed_extra_european_ai_litigation(conn, now):
    organizations = [
        ("org_gema", "GEMA", "Gesellschaft für musikalische Aufführungs- und mechanische Vervielfältigungsrechte", "Germany", "cmo", "P1", 89, "German music collecting society. Track OpenAI and Suno copyright cases in Munich."),
        ("org_getty", "Getty Images", "Getty Images", "United Kingdom", "publisher", "P1", 83, "Image archive and licensing rights holder. Track UK Stability AI litigation."),
        ("org_laion", "LAION", "Large-scale Artificial Intelligence Open Network", "Germany", "ai_dataset_org", "P2", 71, "Open dataset organization involved in German TDM exception litigation."),
        ("org_partec", "ParTec AG", "ParTec AG", "Germany", "technology_company", "P3", 58, "AI/HPC hardware patent plaintiff in Unified Patent Court litigation against Nvidia."),
        ("org_penguin_random_house_de", "Penguin Random House", "Penguin Random House Verlagsgruppe", "Germany", "publisher", "P1", 86, "Book publisher plaintiff in a German copyright infringement claim against OpenAI. Track complaint, answer and Munich court timetable."),
        ("org_koda", "Koda", "Koda", "Denmark", "cmo", "P1", 84, "Danish music collecting society. Track Suno litigation and AI music licensing/remuneration statements."),
        ("org_rti", "RTI", "Reti Televisive Italiane S.p.A.", "Italy", "publisher", "P2", 74, "Mediaset/MFE television rights holder in Italian Perplexity AI copyright litigation."),
        ("org_medusa_film", "Medusa Film", "Medusa Film S.p.A.", "Italy", "publisher", "P2", 72, "Italian audiovisual rights holder in Perplexity AI copyright litigation."),
        ("org_boligportal", "BoligPortal", "BoligPortal A/S", "Denmark", "database_owner", "P2", 68, "Danish database rights holder in scraping and TDM opt-out litigation."),
        ("org_redata", "ReData", "ReData A/S", "Denmark", "data_company", "P3", 50, "Danish data analytics defendant in BoligPortal database/TDM litigation."),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO organizations
        (id, name, full_name, jurisdiction, category, priority, risk_score, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [row + (now, now) for row in organizations],
    )

    cases = [
        (
            "case_de_gema_openai",
            "GEMA v. OpenAI / ChatGPT 歌词版权案",
            "Germany",
            "Landgericht München I",
            "42 O 14139/24",
            None,
            "CASE",
            "已判决 / 损害赔偿与禁令信号",
            "copyright_infringement,lyrics,training_data,memorization",
            "OpenAI ChatGPT",
            89,
            "P1",
            "德国集体管理组织 GEMA 在慕尼黑起诉 OpenAI，指控 ChatGPT 未经许可使用和复现受保护歌词。该案是欧洲 AI 版权诉讼高信号案例，需要持续追踪判决全文和上诉动态。",
        ),
        (
            "case_de_gema_suno",
            "GEMA v. Suno AI 音乐生成版权案",
            "Germany",
            "Landgericht München I",
            None,
            None,
            "CASE",
            "已起诉 / 待审理",
            "copyright_infringement,music_generation,training_data,lyrics",
            "Suno",
            82,
            "P1",
            "GEMA 在慕尼黑针对 Suno 提起 AI 音乐版权诉讼，要求厘清训练和生成音乐时使用受保护曲库的授权与报酬问题。",
        ),
        (
            "case_uk_getty_stability",
            "Getty Images v. Stability AI 英国高等法院案",
            "United Kingdom",
            "High Court of England and Wales",
            None,
            None,
            "CASE",
            "审理中 / 部分主张收窄",
            "copyright_infringement,trademark,secondary_infringement,image_training",
            "Stable Diffusion",
            78,
            "P1",
            "Getty Images 在英国高等法院起诉 Stability AI，指控其在 Stable Diffusion 训练和输出中使用 Getty 图像及水印。该案是欧洲图像训练版权和商标风险的核心案件。",
        ),
        (
            "case_de_kneschke_laion",
            "Robert Kneschke v. LAION TDM 例外案",
            "Germany",
            "Landgericht Hamburg",
            "310 O 227/23",
            None,
            "CASE",
            "一审驳回 / 上诉观察",
            "copyright_infringement,text_and_data_mining,image_dataset",
            "LAION dataset",
            74,
            "P2",
            "德国摄影师 Robert Kneschke 围绕 LAION 数据集中的图片使用提起诉讼。汉堡法院一审驳回后，该案成为欧盟 TDM 例外适用于 AI 数据集的重要信号。",
        ),
        (
            "case_de_partec_nvidia_upc",
            "ParTec v. Nvidia AI 超算专利案",
            "Germany",
            "Unified Patent Court Munich local division",
            None,
            None,
            "CASE",
            "已起诉 / 待审理",
            "patent_infringement,ai_hardware,hpc",
            "Nvidia DGX",
            58,
            "P3",
            "德国超算公司 ParTec 在欧洲统一专利法院体系下起诉 Nvidia，涉及 DGX AI 超算相关专利。该案属于相邻 AI 知识产权风险，低于版权类诉讼优先级。",
        ),
        (
            "case_de_penguin_openai",
            "Penguin Random House v. OpenAI 德国图书版权案",
            "Germany",
            "Landgericht München I",
            None,
            None,
            "CASE",
            "2026-03-27 已起诉 / 诉讼待审",
            "copyright_infringement,book_corpus,training_data,outputs",
            "OpenAI",
            86,
            "P1",
            "Penguin Random House Verlagsgruppe 在德国慕尼黑起诉 OpenAI，CMS/Taylor Wessing 跟踪器列为 2026-03-27 版权侵权诉讼。该案把欧洲图书出版商与 OpenAI 的训练数据风险推到高优先级。",
        ),
        (
            "case_dk_koda_suno",
            "Koda v. Suno 丹麦音乐版权案",
            "Denmark",
            "Copenhagen City Court / Denmark",
            None,
            None,
            "CASE",
            "2025-11 已起诉 / 待官方文书补录",
            "copyright_infringement,music_generation,training_data,outputs,remuneration",
            "Suno",
            84,
            "P1",
            "丹麦音乐集体管理组织 Koda 起诉 Suno，指控未经许可使用丹麦音乐训练和生成相似输出。该案是北欧 AI 音乐版权风险的核心监控对象。",
        ),
        (
            "case_it_rti_medusa_perplexity",
            "RTI / Medusa Film v. Perplexity AI 意大利版权案",
            "Italy",
            "Court of Rome",
            None,
            None,
            "CASE",
            "2025-12 起诉 / 2026-02 仍在审理",
            "copyright_infringement,audiovisual_works,training_data,related_rights",
            "Perplexity AI / Sonar",
            74,
            "P2",
            "RTI 和 Medusa Film 在罗马法院起诉 Perplexity AI，主张其未经授权使用影视内容训练生成式 AI。CMS 称其为意大利首个针对 AI 使用版权内容的法律行动。",
        ),
        (
            "case_dk_boligportal_redata",
            "BoligPortal v. ReData 丹麦数据库/TDM 案",
            "Denmark",
            "Østre Landsret / Danish courts",
            "BS-36038/2020-OLR",
            None,
            "CASE",
            "2026-05-12 上诉判决 / TDM opt-out 观察",
            "database_right,text_and_data_mining,opt_out,scraping,machine_readability",
            "Data scraping / TDM systems",
            68,
            "P2",
            "丹麦 BoligPortal v. ReData 案围绕数据库权、抓取和 TDM opt-out 是否足够机器可读展开。它不是生成式 AI 训练主案，但会影响欧洲 opt-out 和机器可读保留规则。",
        ),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO cases
        (id, title, jurisdiction, court, case_number, ecli, status, procedural_stage,
         claim_types, ai_systems, risk_score, priority, summary, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [row + (now, now) for row in cases],
    )

    links = [
        ("case_de_gema_openai", "org_gema", "plaintiff_org"),
        ("case_de_gema_suno", "org_gema", "plaintiff_org"),
        ("case_uk_getty_stability", "org_getty", "plaintiff"),
        ("case_de_kneschke_laion", "org_laion", "defendant_dataset_org"),
        ("case_de_partec_nvidia_upc", "org_partec", "plaintiff"),
        ("case_de_penguin_openai", "org_penguin_random_house_de", "plaintiff"),
        ("case_dk_koda_suno", "org_koda", "plaintiff_cmo"),
        ("case_it_rti_medusa_perplexity", "org_rti", "plaintiff"),
        ("case_it_rti_medusa_perplexity", "org_medusa_film", "plaintiff"),
        ("case_dk_boligportal_redata", "org_boligportal", "plaintiff_database_owner"),
        ("case_dk_boligportal_redata", "org_redata", "defendant_data_company"),
    ]
    conn.executemany(
        "INSERT OR IGNORE INTO case_organizations (case_id, organization_id, role) VALUES (?, ?, ?)",
        links,
    )

    intel_cards = [
        (
            "intel_de_gema_openai_lawfare_2025_11_12",
            "德国 GEMA v. OpenAI 案进入欧洲诉讼地图",
            "德国慕尼黑 GEMA v. OpenAI / ChatGPT 歌词版权案被纳入诉讼地图。该案是音乐版权、训练数据和模型输出复现风险的重要欧洲样本。",
            "https://www.lawfaremedia.org/article/a-german-court-s-gema-v.-openai-ruling-could-reverberate-across-ai-copyright-landscape",
            "Lawfare",
            "news",
            "Germany",
            "org_gema",
            "case_de_gema_openai",
            "P1",
            "published",
            "news",
            "GEMA,OpenAI,ChatGPT,lyrics,Germany,copyright",
            "media_lead",
            9,
            "2025-11-12T00:00:00+00:00",
        ),
        (
            "intel_de_gema_suno_musicbusiness_2025_01_21",
            "GEMA 起诉 Suno，AI 音乐生成版权风险升温",
            "GEMA 针对 Suno 的慕尼黑诉讼被纳入监控，重点关注 AI 音乐生成、训练语料授权和创作者报酬。",
            "https://www.musicbusinessworldwide.com/gema-sues-suno-in-germany-for-copyright-infringement-over-ai-generated-music/",
            "Music Business Worldwide",
            "news",
            "Germany",
            "org_gema",
            "case_de_gema_suno",
            "P1",
            "published",
            "news",
            "GEMA,Suno,AI music,copyright,Germany",
            "media_lead",
            8,
            "2025-01-21T00:00:00+00:00",
        ),
        (
            "intel_uk_getty_stability_reuters_2025_06_25",
            "Getty v. Stability AI 英国案继续影响图像训练风险",
            "Getty Images v. Stability AI 被纳入英国诉讼层，作为图像训练、输出水印和商标/版权交叉风险的核心案件。",
            "https://www.reuters.com/legal/transactional/stability-ai-wins-partial-victory-getty-images-uk-lawsuit-2025-06-25/",
            "Reuters",
            "news",
            "United Kingdom",
            "org_getty",
            "case_uk_getty_stability",
            "P1",
            "published",
            "news",
            "Getty,Stability AI,Stable Diffusion,UK,copyright,trademark",
            "media_lead",
            7,
            "2025-06-25T00:00:00+00:00",
        ),
        (
            "intel_de_kneschke_laion_techno_llama_2024_09_27",
            "Kneschke v. LAION 成为德国 TDM 例外观察案",
            "Robert Kneschke v. LAION 被纳入德国诉讼层。该案围绕 AI 数据集和文本与数据挖掘例外，是欧盟 AI 训练合规的重要观察点。",
            "https://thetechnollama.wordpress.com/2024/09/27/hamburg-regional-court-rules-on-text-and-data-mining-exception-in-laion-case/",
            "The Technollama",
            "law_firm_statement",
            "Germany",
            "org_laion",
            "case_de_kneschke_laion",
            "P2",
            "published",
            "law_firm_statement",
            "LAION,TDM,Germany,AI dataset,copyright",
            "semi_official",
            6,
            "2024-09-27T00:00:00+00:00",
        ),
        (
            "intel_de_partec_nvidia_juve_2024_10_28",
            "ParTec v. Nvidia 纳入相邻 AI 知识产权诉讼层",
            "ParTec v. Nvidia 属于 AI/HPC 专利诉讼，不是版权案，但会影响欧洲 AI 基础设施知识产权风险，因此以 P3 纳入相邻风险层。",
            "https://www.juve-patent.com/cases/partecs-upc-lawsuit-against-nvidia-tests-ai-computing-patents/",
            "JUVE Patent",
            "news",
            "Germany",
            "org_partec",
            "case_de_partec_nvidia_upc",
            "P3",
            "published",
            "news",
            "ParTec,Nvidia,UPC,AI hardware,patent",
            "media_lead",
            3,
            "2024-10-28T00:00:00+00:00",
        ),
        (
            "intel_sne_fr_bill_commission_2026_06_03",
            "法国 AI 内容使用证明法案获国民议会委员会通过",
            "SNE 报道，法国国民议会文化事务委员会于 2026-06-02 通过 Darcos 法案，拟建立 AI 供应商使用文化内容的推定机制。该动态归入法国 P0 立法风险。",
            "https://www.sne.fr/actu/preuve-dutilisation-des-contenus-culturels-par-lia-la-proposition-de-loi-adoptee-en-commission-par-les-deputes/",
            "SNE",
            "official_site",
            "France",
            "org_sne",
            "case_fr_ai_presumption_bill",
            "P0",
            "published",
            "legislation_update",
            "SNE,Darcos bill,Assemblée nationale,presumption,AI,copyright,France",
            "semi_official",
            10,
            "2026-06-03T00:00:00+00:00",
        ),
        (
            "intel_sne_gov_pressure_2026_06_12",
            "SNE 批评法国政府削弱文化与新闻版权保护",
            "SNE 于 2026-06-12 发布权利人声明，称跨党派 Darcos 文本旨在建立内容使用推定，帮助权利人证明 AI 使用受保护内容。该信号显示法国权利人阵营仍在高压游说。",
            "https://www.sne.fr/actu/pourquoi-le-gouvernement-laisse-t-il-les-deputes-sattaquer-frontalement-a-la-culture-a-la-presse-et-a-la-creation-francaise/",
            "SNE",
            "official_site",
            "France",
            "org_sne",
            "case_fr_ai_presumption_bill",
            "P1",
            "published",
            "rights_holder_statement",
            "SNE,rights-holder,Darcos bill,culture,press,AI,copyright,France",
            "semi_official",
            8,
            "2026-06-12T00:00:00+00:00",
        ),
        (
            "intel_sacd_conseil_etat_2026_03_24",
            "SACD 称 Conseil d'État 支持 AI 内容使用证明法案稳健性",
            "SACD 官网 2026-03-24 发布创意行业联合声明，认为 Conseil d'État 意见确认法国关于 AI 使用受保护内容推定机制的合宪性和欧洲法兼容性。该项是 SACD P0 权利人发声。",
            "https://www.sacd.fr/fr/proposition-de-loi-sur-la-preuve-dutilisation-des-contenus-par-les-ia-avis-favorable-du-conseil",
            "SACD",
            "official_site",
            "France",
            "org_sacd",
            "case_fr_ai_presumption_bill",
            "P0",
            "published",
            "rights_holder_statement",
            "SACD,Conseil d'Etat,Darcos bill,AI,copyright,France,presumption",
            "semi_official",
            10,
            "2026-03-24T00:00:00+00:00",
        ),
        (
            "intel_sacd_25000_signatories_2026_04_28",
            "SACD：超 25,000 名签署者要求完整适用 AI 法",
            "SACD 官网 2026-04-28 动态显示创作者阵营继续推动法国和欧洲完整适用 AI 法，并支持 AI 使用作品推定机制进入议程。该信号归入权利人官方发声。",
            "https://www.sacd.fr/fr/plus-de-25-000-signataires-pour-appeler-lapplication-pleine-et-entiere-de-la-loi-sur-lia-en",
            "SACD",
            "official_site",
            "France",
            "org_sacd",
            "case_fr_ai_presumption_bill",
            "P0",
            "published",
            "rights_holder_statement",
            "SACD,creators,AI Act,presumption,petition,France,Europe",
            "semi_official",
            9,
            "2026-04-28T00:00:00+00:00",
        ),
        (
            "intel_sacd_culture_sovereignty_2026_05_05",
            "SACD：牺牲文化不是技术主权",
            "SACD 2026-05-05 发布文化与信息行业联合立场，称牺牲知识产权不是主权，并支持参议院保护创作的立法路径。该项属于法国 P0 权利人集体发声。",
            "https://www.sacd.fr/fr/ia-sacrifier-la-culture-sur-lautel-de-la-technologie-est-une-erreur-de-civilisation-0",
            "SACD",
            "official_site",
            "France",
            "org_sacd",
            "case_fr_ai_presumption_bill",
            "P0",
            "published",
            "rights_holder_statement",
            "SACD,culture,AI,copyright,rights-holder,France",
            "semi_official",
            9,
            "2026-05-05T00:00:00+00:00",
        ),
        (
            "intel_senat_presumption_report_2026_04_08",
            "法国参议院报告解释 AI 内容使用推定机制",
            "Sénat 官方报告指出，拟通过程序性推定纠正权利人与 AI 供应商之间的信息不对称，并推动许可谈判。该项作为法国官方立法文书进入立法层。",
            "https://www.senat.fr/rap/l25-496/l25-496_mono.html",
            "Sénat",
            "official_portal",
            "France",
            None,
            "case_fr_ai_presumption_bill",
            "P0",
            "published",
            "legislation_update",
            "Sénat,Darcos bill,AI,copyright,presumption,legislation,France",
            "official",
            10,
            "2026-04-08T00:00:00+00:00",
        ),
        (
            "intel_eu_gpai_code_2026_04_23",
            "欧委会 GPAI Code 页面更新版权章节与签署状态",
            "欧委会 GPAI Code 官方页面 2026-04-23 更新，明确 Code 帮助 GPAI 模型提供者履行 AI Act 的透明度和版权义务，并提供单独的 Copyright chapter。",
            "https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai",
            "European Commission",
            "official_portal",
            "European Union",
            None,
            "case_eu_tdm_watch",
            "P1",
            "published",
            "legislation_update",
            "European Commission,GPAI Code,AI Act,copyright,transparency,Article 53",
            "official",
            7,
            "2026-04-23T00:00:00+00:00",
        ),
        (
            "intel_de_penguin_openai_cms_2026_03_27",
            "Penguin Random House v. OpenAI 德国图书版权案进入诉讼层",
            "CMS AI Copyright Case Tracker 将 Penguin Random House v. OpenAI 列为德国 2026-03-27 待审版权侵权案。该案把图书出版商对 OpenAI 训练数据和输出的主张纳入欧洲核心诉讼版图。",
            "https://cms.law/en/int/publication/artificial-intelligence-and-copyright-case-tracker/germany-penguin-random-house-v.-openai-27-march-2026",
            "CMS AI Copyright Case Tracker",
            "law_firm_tracker",
            "Germany",
            "org_penguin_random_house_de",
            "case_de_penguin_openai",
            "P1",
            "published",
            "news",
            "Penguin Random House,OpenAI,Germany,book corpus,copyright,litigation",
            "semi_official",
            8,
            "2026-03-27T00:00:00+00:00",
        ),
        (
            "intel_dk_koda_suno_official_2025_11_13",
            "Koda 官方宣布起诉 Suno 盗用丹麦音乐",
            "Koda 官网宣布对 Suno 提起诉讼，主张 Suno 未经许可使用丹麦艺术家音乐训练并生成高度相似歌曲。该项作为北欧 AI 音乐版权诉讼进入 P1 监控。",
            "https://www.koda.dk/en/about-koda/news/koda-sues-us-tech-company-suno-for-stealing-danish-artists-music",
            "Koda",
            "official_site",
            "Denmark",
            "org_koda",
            "case_dk_koda_suno",
            "P1",
            "published",
            "news",
            "Koda,Suno,Denmark,AI music,copyright,training data,litigation",
            "semi_official",
            8,
            "2025-11-13T00:00:00+00:00",
        ),
        (
            "intel_it_perplexity_cms_2025_12_04",
            "RTI / Medusa Film v. Perplexity 成为意大利 AI 版权案",
            "CMS 跟踪器称 RTI 和 Medusa Film 在罗马法院起诉 Perplexity AI，主张其未经授权使用影视内容训练生成式 AI，标志意大利 AI 版权诉讼风险抬升。",
            "https://cms.law/en/int/publication/artificial-intelligence-and-copyright-case-tracker",
            "CMS AI Copyright Case Tracker",
            "law_firm_tracker",
            "Italy",
            "org_rti",
            "case_it_rti_medusa_perplexity",
            "P2",
            "published",
            "news",
            "RTI,Medusa Film,Perplexity,Italy,audiovisual,copyright,litigation",
            "semi_official",
            6,
            "2025-12-04T00:00:00+00:00",
        ),
        (
            "intel_dk_boligportal_taylorwessing_2026_05_12",
            "BoligPortal v. ReData 上诉判决成为机器可读 opt-out 信号",
            "Taylor Wessing 2026-05-27 更新的 AI and Copyright Tracker 将 BoligPortal v. ReData 列为丹麦 2026-05-12 上诉判决，涉及数据库权、抓取和 TDM opt-out。",
            "https://www.taylorwessing.com/en/campaigns/de/2025/ai-and-copyright-tracker",
            "Taylor Wessing",
            "law_firm_tracker",
            "Denmark",
            "org_boligportal",
            "case_dk_boligportal_redata",
            "P2",
            "published",
            "news",
            "BoligPortal,ReData,Denmark,database right,TDM,opt-out,litigation",
            "semi_official",
            5,
            "2026-05-12T00:00:00+00:00",
        ),
        (
            "intel_de_gema_suno_taylorwessing_2026_03_09",
            "GEMA v. Suno 进入 2026 审理节点",
            "Taylor Wessing 跟踪器显示 GEMA v. Suno 在德国 2026-03-09 进入口头审理节点，并提示 2026-07-31 判决预期。该项提升音乐生成诉讼的近期时效性。",
            "https://www.taylorwessing.com/en/campaigns/de/2025/ai-and-copyright-tracker",
            "Taylor Wessing",
            "law_firm_tracker",
            "Germany",
            "org_gema",
            "case_de_gema_suno",
            "P1",
            "published",
            "news",
            "GEMA,Suno,Germany,AI music,hearing,judgment expected,copyright",
            "semi_official",
            7,
            "2026-03-09T00:00:00+00:00",
        ),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO intelligence_cards
        (id, title, summary, source_url, source_name, source_type, jurisdiction, organization_id,
         case_id, priority, status, signal_type, tags, confidence, risk_delta,
         signal_date, created_at, updated_at, approved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [row[:-1] + (row[-1], now, now, now if row[10] == "published" else None) for row in intel_cards],
    )


def seed_worldmonitor_extensions(conn, now):
    conn.executemany(
        """
        INSERT OR IGNORE INTO video_items
        (id, title, source_name, source_url, source_type, jurisdiction, organization_id,
         case_id, priority, status, video_date, summary, tags, created_at, updated_at, approved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [row + (now, now, now if row[9] == "published" else None) for row in VIDEO_INTEL_SEEDS],
    )
    conn.executemany(
        """
        UPDATE video_items
        SET title = ?, source_name = ?, source_url = ?, source_type = ?, jurisdiction = ?,
            organization_id = ?, case_id = ?, priority = ?, status = ?, video_date = ?,
            summary = ?, tags = ?, updated_at = ?
        WHERE id = ?
        """,
        [
            (
                title,
                source_name,
                source_url,
                source_type,
                jurisdiction,
                organization_id,
                case_id,
                priority,
                status,
                video_date,
                summary,
                tags,
                now,
                item_id,
            )
            for (
                item_id,
                title,
                source_name,
                source_url,
                source_type,
                jurisdiction,
                organization_id,
                case_id,
                priority,
                status,
                video_date,
                summary,
                tags,
            ) in VIDEO_INTEL_SEEDS
        ],
    )

    conn.executemany(
        """
        INSERT OR IGNORE INTO market_indicators
        (id, symbol, name, market, category, jurisdiction, related_organization_id,
         risk_exposure, source_name, source_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Yahoo Finance', 'https://finance.yahoo.com/', ?, ?)
        """,
        [row + (now, now) for row in MARKET_WATCHLIST],
    )
    conn.executemany(
        """
        UPDATE market_indicators
        SET symbol = ?, name = ?, market = ?, category = ?, jurisdiction = ?,
            related_organization_id = ?, risk_exposure = ?,
            source_name = 'Yahoo Finance', source_url = 'https://finance.yahoo.com/',
            updated_at = ?
        WHERE id = ?
        """,
        [(symbol, name, market, category, jurisdiction, org_id, exposure, now, item_id) for item_id, symbol, name, market, category, jurisdiction, org_id, exposure in MARKET_WATCHLIST],
    )

    conn.executemany(
        """
        INSERT OR IGNORE INTO calendar_events
        (id, title, event_type, jurisdiction, case_id, organization_id, priority,
         event_date, source_url, source_name, summary, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [row + (now, now) for row in CALENDAR_EVENT_SEEDS],
    )
    conn.executemany(
        """
        UPDATE calendar_events
        SET title = ?, event_type = ?, jurisdiction = ?, case_id = ?, organization_id = ?,
            priority = ?, event_date = ?, source_url = ?, source_name = ?,
            summary = ?, status = ?, updated_at = ?
        WHERE id = ?
        """,
        [
            (title, event_type, jurisdiction, case_id, org_id, priority, event_date, source_url, source_name, summary, status, now, event_id)
            for event_id, title, event_type, jurisdiction, case_id, org_id, priority, event_date, source_url, source_name, summary, status in CALENDAR_EVENT_SEEDS
        ],
    )


def rows(conn, query, params=()):
    return [dict(row) for row in conn.execute(query, params)]


def row(conn, query, params=()):
    item = conn.execute(query, params).fetchone()
    return dict(item) if item else None


def gdelt_date_to_iso(value):
    if not value:
        return utc_now()
    value = str(value)
    try:
        if len(value) >= 14:
            parsed = datetime.strptime(value[:14], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
            return parsed.replace(microsecond=0).isoformat()
        if len(value) >= 8:
            parsed = datetime.strptime(value[:8], "%Y%m%d").replace(tzinfo=timezone.utc)
            return parsed.replace(microsecond=0).isoformat()
    except ValueError:
        pass
    return utc_now()


def clean_text(value):
    return " ".join(unescape(str(value or "")).split())


def rss_date_to_iso(value):
    if not value:
        return utc_now()
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).replace(microsecond=0).isoformat()
    except Exception:
        return utc_now()


def source_name_for_url(url, fallback="GDELT"):
    host = urlparse(url or "").netloc.lower().replace("www.", "")
    for domain, name in NEWS_DOMAIN_ALLOWLIST.items():
        if host.endswith(domain):
            return name
    return fallback


def is_allowed_monitor_url(url):
    host = urlparse(url or "").netloc.lower().replace("www.", "")
    return any(host.endswith(domain) for domain in NEWS_DOMAIN_ALLOWLIST)


def request_gdelt_articles(query, max_records=5):
    params = urlencode(
        {
            "query": query,
            "mode": "ArtList",
            "format": "json",
            "maxrecords": max_records,
            "sort": "DateDesc",
        }
    )
    url = f"https://api.gdeltproject.org/api/v2/doc/doc?{params}"
    try:
        payload = request_json(url, timeout=MONITOR_HTTP_TIMEOUT)
    except Exception:
        return []
    return payload.get("articles", []) if isinstance(payload, dict) else []


def request_rss_items(url):
    try:
        raw = request_text(url, timeout=MONITOR_RSS_TIMEOUT)
        root = ET.fromstring(raw)
    except Exception:
        return []
    items = []
    for item in root.findall(".//item"):
        title = clean_text(item.findtext("title"))
        link = clean_text(item.findtext("link"))
        description = clean_text(item.findtext("description"))
        pub_date = clean_text(item.findtext("pubDate") or item.findtext("date"))
        if title and link:
            items.append({"title": title, "url": link, "description": description, "date": rss_date_to_iso(pub_date)})
    return items


def request_market_quote(symbol):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=5d&interval=1d"
    raw = request_text(url, timeout=MONITOR_HTTP_TIMEOUT)
    payload = json.loads(raw)
    result = ((payload.get("chart") or {}).get("result") or [None])[0]
    if not result:
        return None
    meta = result.get("meta") or {}
    quote = (((result.get("indicators") or {}).get("quote") or [{}])[0]).get("close") or []
    closes = [float(value) for value in quote if value is not None]
    if not closes:
        return None
    close = closes[-1]
    open_price = closes[-2] if len(closes) > 1 else meta.get("chartPreviousClose")
    change_pct = None
    if open_price:
        change_pct = round((close - open_price) / open_price * 100, 2)
    return {
        "last_price": round(close, 4),
        "change_pct": change_pct,
        "currency": meta.get("currency"),
        "last_checked_at": utc_now(),
    }


def refresh_market_indicators(conn, deadline=None):
    updated = 0
    errors = []
    for item in rows(conn, "SELECT id, symbol FROM market_indicators ORDER BY category, symbol"):
        if monitor_budget_exhausted(deadline):
            errors.append({"symbol": item["symbol"], "error": "monitor time budget exhausted"})
            break
        try:
            quote = request_market_quote(item["symbol"])
            if not quote:
                errors.append({"symbol": item["symbol"], "error": "no quote"})
                continue
            conn.execute(
                """
                UPDATE market_indicators
                SET last_price = ?, change_pct = ?, currency = COALESCE(?, currency, 'USD'),
                    last_checked_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (quote["last_price"], quote["change_pct"], quote.get("currency"), quote["last_checked_at"], quote["last_checked_at"], item["id"]),
            )
            updated += 1
        except Exception as exc:
            errors.append({"symbol": item["symbol"], "error": str(exc)[:160]})
    return {"source": "market_indicators", "checked": updated + len(errors), "updated": updated, "errors": errors}


def insert_monitor_card(conn, card):
    now = utc_now()
    conn.execute(
        """
        INSERT OR IGNORE INTO intelligence_cards
        (id, title, summary, source_url, source_name, source_type, jurisdiction, organization_id,
         case_id, priority, status, signal_type, tags, confidence, risk_delta,
         signal_date, created_at, updated_at, approved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            card["id"],
            card["title"],
            card["summary"],
            card["source_url"],
            card["source_name"],
            card["source_type"],
            card["jurisdiction"],
            card.get("organization_id"),
            card.get("case_id"),
            card["priority"],
            "review",
            card["signal_type"],
            card["tags"],
            card["confidence"],
            card["risk_delta"],
            card["signal_date"],
            now,
            now,
            None,
        ),
    )


def monitor_budget_exhausted(deadline):
    return deadline is not None and time.monotonic() >= deadline


def run_gdelt_monitor(conn, deadline=None):
    inserted = 0
    checked = 0
    errors = []
    for config in MONITOR_NEWS_QUERIES:
        if monitor_budget_exhausted(deadline):
            errors.append({"query": config["id"], "error": "monitor time budget exhausted"})
            break
        try:
            for article in request_gdelt_articles(config["query"]):
                checked += 1
                url = article.get("url") or ""
                if not url or not is_allowed_monitor_url(url):
                    continue
                title = clean_text(article.get("title"))
                if not title:
                    continue
                source_name = source_name_for_url(url)
                card_id = f"intel_gdelt_{stable_hash(config['id'], url)[:16]}"
                before = conn.total_changes
                insert_monitor_card(
                    conn,
                    {
                        "id": card_id,
                        "title": title,
                        "summary": f"公共新闻索引命中“{config['query']}”。来源为 {source_name}，需人工审核是否与欧洲 AI 版权诉讼或立法动态相关。",
                        "source_url": url,
                        "source_name": source_name,
                        "source_type": "news",
                        "jurisdiction": config["jurisdiction"],
                        "priority": config["priority"],
                        "signal_type": "news",
                        "tags": config["tags"],
                        "confidence": "media_lead",
                        "risk_delta": 4,
                        "signal_date": gdelt_date_to_iso(article.get("seendate")),
                    },
                )
                if conn.total_changes > before:
                    inserted += 1
        except Exception as exc:
            errors.append({"query": config["id"], "error": str(exc)[:240]})
    return {"source": "gdelt_news", "checked": checked, "inserted_review_cards": inserted, "errors": errors}


def run_rights_holder_monitor(conn, deadline=None):
    inserted = 0
    checked = 0
    errors = []
    for config in RIGHTS_HOLDER_MONITORS:
        if monitor_budget_exhausted(deadline):
            errors.append({"query": config["id"], "error": "monitor time budget exhausted"})
            break
        try:
            for article in request_gdelt_articles(config["query"], max_records=5):
                checked += 1
                url = article.get("url") or ""
                if not url or not is_allowed_monitor_url(url):
                    continue
                title = clean_text(article.get("title"))
                if not title:
                    continue
                source_name = source_name_for_url(url, "Rights holder source")
                card_id = f"intel_rights_{stable_hash(config['id'], url)[:16]}"
                before = conn.total_changes
                insert_monitor_card(
                    conn,
                    {
                        "id": card_id,
                        "title": title,
                        "summary": f"权利人/行业组织动态监控命中“{config['query']}”。该信号可能与集体维权、授权谈判、AI 训练透明度或诉讼策略有关，需后台审核。",
                        "source_url": url,
                        "source_name": source_name,
                        "source_type": "official_site",
                        "jurisdiction": config["jurisdiction"],
                        "organization_id": config.get("organization_id"),
                        "priority": config["priority"],
                        "signal_type": "rights_holder_statement",
                        "tags": config["tags"],
                        "confidence": "semi_official",
                        "risk_delta": 6 if config["priority"] == "P0" else 4,
                        "signal_date": gdelt_date_to_iso(article.get("seendate")),
                    },
                )
                if conn.total_changes > before:
                    inserted += 1
        except Exception as exc:
            errors.append({"query": config["id"], "error": str(exc)[:240]})
    return {"source": "rights_holder_domains", "checked": checked, "inserted_review_cards": inserted, "errors": errors}


def run_legislation_monitor(conn, deadline=None):
    inserted = 0
    checked = 0
    errors = []
    for config in LEGISLATION_MONITORS:
        if monitor_budget_exhausted(deadline):
            errors.append({"query": config["id"], "error": "monitor time budget exhausted"})
            break
        try:
            for article in request_gdelt_articles(config["query"], max_records=5):
                checked += 1
                url = article.get("url") or ""
                if not url or not is_allowed_monitor_url(url):
                    continue
                title = clean_text(article.get("title"))
                if not title:
                    continue
                source_name = source_name_for_url(url, "Public policy source")
                card_id = f"intel_legislation_{stable_hash(config['id'], url)[:16]}"
                before = conn.total_changes
                insert_monitor_card(
                    conn,
                    {
                        "id": card_id,
                        "title": title,
                        "summary": f"立法与政策动态监控命中“{config['query']}”。该信号可能影响 AI Act、GPAI 透明度、TDM opt-out 或法国版权立法执行，需后台审核。",
                        "source_url": url,
                        "source_name": source_name,
                        "source_type": "policy_monitor",
                        "jurisdiction": config["jurisdiction"],
                        "priority": config["priority"],
                        "signal_type": "legislation_update",
                        "tags": config["tags"],
                        "confidence": "media_lead" if source_name == "Public policy source" else "semi_official",
                        "risk_delta": 5,
                        "signal_date": gdelt_date_to_iso(article.get("seendate")),
                    },
                )
                if conn.total_changes > before:
                    inserted += 1
        except Exception as exc:
            errors.append({"query": config["id"], "error": str(exc)[:240]})
    return {"source": "legislation_monitor", "checked": checked, "inserted_review_cards": inserted, "errors": errors}


def run_official_rss_monitor(conn, deadline=None):
    inserted = 0
    checked = 0
    errors = []
    for source in OFFICIAL_RSS_SOURCES:
        if monitor_budget_exhausted(deadline):
            errors.append({"source": source["id"], "error": "monitor time budget exhausted"})
            break
        try:
            for item in request_rss_items(source["url"])[:12]:
                checked += 1
                haystack = f"{item['title']} {item.get('description', '')}".lower()
                if not any(keyword.lower() in haystack for keyword in source["keywords"]):
                    continue
                card_id = f"intel_rss_{stable_hash(source['id'], item['url'])[:16]}"
                before = conn.total_changes
                insert_monitor_card(
                    conn,
                    {
                        "id": card_id,
                        "title": item["title"],
                        "summary": item.get("description") or f"{source['name']} 官方 RSS 命中版权/AI/知识产权相关关键词，需后台审核。",
                        "source_url": item["url"],
                        "source_name": source["source_name"],
                        "source_type": "official_portal",
                        "jurisdiction": source["jurisdiction"],
                        "priority": source["priority"],
                        "signal_type": "official_court_document",
                        "tags": source["tags"],
                        "confidence": "official",
                        "risk_delta": 5,
                        "signal_date": item["date"],
                    },
                )
                if conn.total_changes > before:
                    inserted += 1
        except Exception as exc:
            errors.append({"source": source["id"], "error": str(exc)[:240]})
    return {"source": "official_rss", "checked": checked, "inserted_review_cards": inserted, "errors": errors}


def source_health(conn):
    items = rows(conn, "SELECT * FROM sources ORDER BY jurisdiction, name")
    health = []
    for item in items:
        doc_count = row(conn, "SELECT COUNT(*) AS count FROM documents WHERE source_id = ?", (item["id"],))["count"]
        configured = item["source_type"] not in {"official_api"} or item["last_checked_at"] is not None
        if item["id"] in OFFICIAL_SOURCE_CONFIGS:
            runtime = official_config_for(item["id"])
            needs_token = bool(runtime["credential_key"])
            has_direct_token = bool(runtime["bearer_token"])
            has_key_id = bool(runtime["key_id"] or runtime["extra_headers"].get("KeyId"))
            has_oauth_credentials = bool(runtime["client_id"] and runtime["client_secret"] and runtime["token_url"])
            configured = bool(runtime["search_url"]) and (not needs_token or has_direct_token or has_key_id or has_oauth_credentials)
        health.append(
            {
                **item,
                "document_count": doc_count,
                "configured": configured,
            }
        )
    health.extend(
        [
            {
                "id": "source_gdelt_news",
                "name": "GDELT public news index",
                "source_type": "news_index",
                "jurisdiction": "Europe",
                "base_url": "https://api.gdeltproject.org/api/v2/doc/doc",
                "refresh_cadence": "hourly",
                "notes": "公共新闻发现层。只接收白名单媒体和权利人域名，所有命中进入后台审核。",
                "last_checked_at": row(conn, "SELECT MAX(started_at) AS last FROM monitor_runs WHERE notes LIKE '%gdelt_news%'")["last"],
                "document_count": 0,
                "configured": True,
            },
            {
                "id": "source_rights_holder_domains",
                "name": "Rights-holder domain monitor",
                "source_type": "rights_holder_monitor",
                "jurisdiction": "Europe",
                "base_url": "SACD / Le Figaro / GEMA / SGDL / SNE domains via GDELT",
                "refresh_cadence": "hourly",
                "notes": "权利人官网和行业组织发声发现层，命中后进入后台审核。",
                "last_checked_at": row(conn, "SELECT MAX(started_at) AS last FROM monitor_runs WHERE notes LIKE '%rights_holder_domains%'")["last"],
                "document_count": 0,
                "configured": True,
            },
            {
                "id": "source_official_rss",
                "name": "Official RSS monitor",
                "source_type": "official_rss",
                "jurisdiction": "Europe",
                "base_url": ", ".join(source["url"] for source in OFFICIAL_RSS_SOURCES),
                "refresh_cadence": "hourly",
                "notes": "无需密钥的官方 RSS 监控层。当前包含 CURIA/CJEU 和 ECHR，命中后进入后台审核。",
                "last_checked_at": row(conn, "SELECT MAX(started_at) AS last FROM monitor_runs WHERE notes LIKE '%official_rss%'")["last"],
                "document_count": 0,
                "configured": True,
            },
            {
                "id": "source_legislation_monitor",
                "name": "Legislation and policy monitor",
                "source_type": "policy_monitor",
                "jurisdiction": "Europe",
                "base_url": "GDELT public index + EUR-Lex policy watch queries",
                "refresh_cadence": "hourly",
                "notes": "AI Act、GPAI Code、TDM opt-out 和法国 AI 版权立法动态发现层，命中后进入后台审核。",
                "last_checked_at": row(conn, "SELECT MAX(started_at) AS last FROM monitor_runs WHERE notes LIKE '%legislation_monitor%'")["last"],
                "document_count": 0,
                "configured": True,
            },
        ]
    )
    return health


def run_monitor():
    now = utc_now()
    deadline = time.monotonic() + MONITOR_RUN_BUDGET_SECONDS
    with connect() as conn:
        source_rows = rows(conn, "SELECT * FROM sources ORDER BY name")
        monitor_results = [
            refresh_market_indicators(conn, deadline),
            run_gdelt_monitor(conn, deadline),
            run_rights_holder_monitor(conn, deadline),
            run_legislation_monitor(conn, deadline),
            run_official_rss_monitor(conn, deadline),
        ]
        run_id = "run_" + now.replace(":", "").replace("+", "Z")
        inserted = sum(item.get("inserted_review_cards", 0) for item in monitor_results)
        conn.execute(
            "INSERT INTO monitor_runs (id, status, started_at, completed_at, notes) VALUES (?, ?, ?, ?, ?)",
            (
                run_id,
                "completed",
                now,
                utc_now(),
                json.dumps({"results": monitor_results, "inserted_review_cards": inserted}, ensure_ascii=False),
            ),
        )
        for source in source_rows:
            conn.execute(
                """
                UPDATE sources
                SET last_checked_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (now, now, source["id"]),
            )
        conn.commit()
    return {"run_id": run_id, "checked_sources": len(source_rows), "status": "completed"}


def upsert_official_document(conn, source_id, document):
    now = utc_now()
    conn.execute(
        """
        INSERT OR IGNORE INTO documents
        (id, case_id, source_id, title, source_url, document_type, jurisdiction, confidence,
         document_date, captured_at, sha256, ecli, case_number, extracted_text, summary_cn, raw_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            document["id"],
            None,
            source_id,
            document["title"],
            document["source_url"],
            document["document_type"],
            document["jurisdiction"],
            document["confidence"],
            document.get("document_date"),
            now,
            document["sha256"],
            document.get("ecli"),
            document.get("case_number"),
            document.get("extracted_text", ""),
            document.get("summary_cn", ""),
            None,
            now,
        ),
    )
    return conn.total_changes


def create_review_card_for_document(conn, source_id, document, query):
    card_id = f"intel_official_{stable_hash(source_id, document['id'], query)[:16]}"
    now = utc_now()
    title = f"官方文书命中：{document['title']}"
    summary = document.get("summary_cn") or f"官方文书源对关键词“{query}”返回命中，等待人工审核。"
    conn.execute(
        """
        INSERT OR IGNORE INTO intelligence_cards
        (id, title, summary, source_url, source_name, source_type, jurisdiction, organization_id,
         case_id, priority, status, signal_type, tags, confidence, risk_delta,
         signal_date, created_at, updated_at, approved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            card_id,
            title,
            summary,
            document["source_url"],
            "Judilibre",
            "official_legal_database",
            document["jurisdiction"],
            None,
            None,
            "P1",
            "review",
            "official_court_document",
            f"official,Judilibre,{query}",
            "official",
            8,
            document.get("document_date"),
            now,
            now,
            None,
        ),
    )


def run_judilibre_connector(conn):
    config = official_config_for("source_judilibre")
    if not config["enabled"]:
        return {"source_id": "source_judilibre", "status": "skipped", "reason": "disabled"}
    token = fetch_oauth_application_token(config)
    if not token and not config["extra_headers"].get("KeyId"):
        return {"source_id": "source_judilibre", "status": "needs_credentials", "reason": "missing KeyId, bearer token or OAuth client credentials"}
    if not config["search_url"]:
        return {"source_id": "source_judilibre", "status": "needs_config", "reason": "missing search_url"}

    keywords = rows(
        conn,
        """
        SELECT mk.query, o.priority
        FROM monitor_keywords mk
        LEFT JOIN organizations o ON o.id = mk.organization_id
        WHERE o.jurisdiction = 'France'
        ORDER BY o.priority, mk.query
        """,
    )
    inserted_docs = 0
    inserted_cards = 0
    errors = []
    for keyword in keywords:
        query = keyword["query"]
        payload = {"query": query, "page_size": config["query_limit"]}
        url = config["search_url"]
        try:
            try:
                response = request_json(url, token, config["extra_headers"], payload=payload)
            except Exception:
                query_url = f"{url}?{urlencode({'query': query, 'page_size': config['query_limit']})}"
                response = request_json(query_url, token, config["extra_headers"])
            for item in extract_judilibre_items(response)[: config["query_limit"]]:
                document = normalize_judilibre_item(item, query)
                before = conn.total_changes
                upsert_official_document(conn, "source_judilibre", document)
                if conn.total_changes > before:
                    inserted_docs += 1
                    create_review_card_for_document(conn, "source_judilibre", document, query)
                    inserted_cards += 1
        except Exception as exc:
            errors.append({"query": query, "error": str(exc)[:300]})

    return {
        "source_id": "source_judilibre",
        "status": "completed" if not errors else "partial",
        "queries": len(keywords),
        "inserted_documents": inserted_docs,
        "created_review_cards": inserted_cards,
        "errors": errors,
    }


def run_official_documents():
    now = utc_now()
    run_id = "official_" + now.replace(":", "").replace("+", "Z")
    with connect() as conn:
        results = [run_judilibre_connector(conn)]
        for source_id in OFFICIAL_SOURCE_CONFIGS:
            conn.execute(
                "UPDATE sources SET last_checked_at = ?, updated_at = ? WHERE id = ?",
                (now, now, source_id),
            )
        status = "completed"
        if any(item["status"] in {"partial", "needs_credentials", "needs_config"} for item in results):
            status = "partial"
        notes = json.dumps(results, ensure_ascii=False)
        conn.execute(
            "INSERT INTO monitor_runs (id, status, started_at, completed_at, notes) VALUES (?, ?, ?, ?, ?)",
            (run_id, status, now, utc_now(), notes),
        )
        conn.commit()
    return {"run_id": run_id, "status": status, "results": results}


def read_json_body(handler):
    length = int(handler.headers.get("Content-Length", "0") or "0")
    if not length:
        return {}
    raw = handler.rfile.read(length).decode("utf-8")
    return json.loads(raw or "{}")


def capture_document(payload):
    required_url = payload.get("source_url")
    if not required_url:
        raise ValueError("source_url is required")

    req = Request(required_url, headers={"User-Agent": "AI-Copyright-Risk-Tracker/0.1"})
    with urlopen(req, timeout=20) as response:
        content = response.read()
        content_type = response.headers.get("Content-Type", "application/octet-stream")

    digest = hashlib.sha256(content).hexdigest()
    now = utc_now()
    extension = ".bin"
    if "pdf" in content_type:
        extension = ".pdf"
    elif "html" in content_type:
        extension = ".html"
    elif "json" in content_type:
        extension = ".json"
    elif "text" in content_type:
        extension = ".txt"

    raw_dir = BASE_DIR / "data" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    raw_path = raw_dir / f"{digest}{extension}"
    raw_path.write_bytes(content)

    title = payload.get("title") or required_url
    document_id = payload.get("id") or f"doc_{digest[:16]}"
    extracted_text = ""
    if extension in {".html", ".json", ".txt"}:
        extracted_text = content.decode("utf-8", errors="replace")[:200000]

    with connect() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO documents
            (id, case_id, source_id, title, source_url, document_type, jurisdiction, confidence,
             document_date, captured_at, sha256, ecli, case_number, extracted_text, summary_cn, raw_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                document_id,
                payload.get("case_id"),
                payload.get("source_id"),
                title,
                required_url,
                payload.get("document_type", "official_document"),
                payload.get("jurisdiction", "France"),
                payload.get("confidence", "official"),
                payload.get("document_date"),
                now,
                digest,
                payload.get("ecli"),
                payload.get("case_number"),
                extracted_text,
                payload.get("summary_cn"),
                str(raw_path),
                now,
            ),
        )
        conn.commit()

    return {
        "id": document_id,
        "sha256": digest,
        "content_type": content_type,
        "bytes": len(content),
        "raw_path": str(raw_path),
    }


def create_intel_card(payload):
    now = utc_now()
    title = payload.get("title")
    summary = payload.get("summary")
    source_url = payload.get("source_url")
    if not title or not summary or not source_url:
        raise ValueError("title, summary and source_url are required")

    card_id = payload.get("id") or f"intel_{stable_hash(title, source_url)[:16]}"
    status = payload.get("status", "review")
    with connect() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO intelligence_cards
            (id, title, summary, source_url, source_name, source_type, jurisdiction, organization_id,
             case_id, priority, status, signal_type, tags, confidence, risk_delta,
             signal_date, created_at, updated_at, approved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                card_id,
                title,
                summary,
                source_url,
                payload.get("source_name", "Manual review"),
                payload.get("source_type", "manual"),
                payload.get("jurisdiction", "France"),
                payload.get("organization_id"),
                payload.get("case_id"),
                payload.get("priority", "P2"),
                status,
                payload.get("signal_type", "news"),
                payload.get("tags", ""),
                payload.get("confidence", "media_lead"),
                int(payload.get("risk_delta", 0)),
                payload.get("signal_date"),
                now,
                now,
                now if status == "published" else None,
            ),
        )
        conn.commit()
    return {"id": card_id, "status": status}


def update_intel_status(payload, status):
    card_id = payload.get("id")
    if not card_id:
        raise ValueError("id is required")
    now = utc_now()
    with connect() as conn:
        existing = row(conn, "SELECT id FROM intelligence_cards WHERE id = ?", (card_id,))
        if not existing:
            raise ValueError("intelligence card not found")
        conn.execute(
            """
            UPDATE intelligence_cards
            SET status = ?, updated_at = ?, approved_at = CASE WHEN ? = 'published' THEN ? ELSE approved_at END
            WHERE id = ?
            """,
            (status, now, status, now, card_id),
        )
        conn.commit()
    return {"id": card_id, "status": status}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def log_message(self, fmt, *args):
        try:
            sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))
        except Exception:
            pass

    def send_json(self, payload, status=200):
        data = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return super().do_GET()
        try:
            with connect() as conn:
                if parsed.path == "/api/health":
                    return self.send_json({"ok": True, "database": str(DB_PATH), "time": utc_now()})
                if parsed.path == "/api/organizations":
                    return self.send_json(rows(conn, "SELECT * FROM organizations ORDER BY priority, risk_score DESC, name"))
                if parsed.path == "/api/sources":
                    return self.send_json(rows(conn, "SELECT * FROM sources ORDER BY jurisdiction, name"))
                if parsed.path == "/api/source-health":
                    return self.send_json(source_health(conn))
                if parsed.path == "/api/documents":
                    return self.send_json(rows(conn, "SELECT * FROM documents ORDER BY captured_at DESC, created_at DESC"))
                if parsed.path == "/api/video-intel":
                    return self.send_json(
                        rows(
                            conn,
                            """
                            SELECT v.*, o.name AS organization_name, c.title AS case_title
                            FROM video_items v
                            LEFT JOIN organizations o ON o.id = v.organization_id
                            LEFT JOIN cases c ON c.id = v.case_id
                            WHERE v.status IN ('watch', 'published')
                            ORDER BY COALESCE(v.video_date, v.updated_at, v.created_at) DESC, v.priority
                            """,
                        )
                    )
                if parsed.path == "/api/market-indicators":
                    return self.send_json(
                        rows(
                            conn,
                            """
                            SELECT m.*, o.name AS organization_name
                            FROM market_indicators m
                            LEFT JOIN organizations o ON o.id = m.related_organization_id
                            ORDER BY
                              CASE m.category
                                WHEN 'ai_platform' THEN 0
                                WHEN 'rights_holder' THEN 1
                                WHEN 'publisher' THEN 2
                                ELSE 3
                              END,
                              m.symbol
                            """,
                        )
                    )
                if parsed.path == "/api/calendar-events":
                    return self.send_json(
                        rows(
                            conn,
                            """
                            SELECT ce.*, o.name AS organization_name, c.title AS case_title
                            FROM calendar_events ce
                            LEFT JOIN organizations o ON o.id = ce.organization_id
                            LEFT JOIN cases c ON c.id = ce.case_id
                            ORDER BY datetime(ce.event_date) DESC, ce.priority
                            """,
                        )
                    )
                if parsed.path == "/api/admin/official-sources":
                    return self.send_json(official_source_status(conn))
                if parsed.path == "/api/intel":
                    params = parse_qs(parsed.query)
                    status = params.get("status", ["published"])[0]
                    return self.send_json(
                        rows(
                            conn,
                            """
                            SELECT ic.*, o.name AS organization_name, c.title AS case_title
                            FROM intelligence_cards ic
                            LEFT JOIN organizations o ON o.id = ic.organization_id
                            LEFT JOIN cases c ON c.id = ic.case_id
                            WHERE ic.status = ?
                            ORDER BY COALESCE(ic.signal_date, ic.approved_at, ic.created_at) DESC, ic.priority
                            """,
                            (status,),
                        )
                    )
                if parsed.path == "/api/admin/intel":
                    return self.send_json(
                        rows(
                            conn,
                            """
                            SELECT ic.*, o.name AS organization_name, c.title AS case_title
                            FROM intelligence_cards ic
                            LEFT JOIN organizations o ON o.id = ic.organization_id
                            LEFT JOIN cases c ON c.id = ic.case_id
                            ORDER BY
                              CASE ic.status WHEN 'review' THEN 0 WHEN 'published' THEN 1 ELSE 2 END,
                              COALESCE(ic.signal_date, ic.approved_at, ic.created_at) DESC,
                              ic.priority
                            """,
                        )
                    )
                if parsed.path == "/api/monitor/keywords":
                    return self.send_json(
                        rows(
                            conn,
                            """
                            SELECT mk.*, o.name AS organization_name, o.priority
                            FROM monitor_keywords mk
                            LEFT JOIN organizations o ON o.id = mk.organization_id
                            ORDER BY o.priority, o.name, mk.query
                            """,
                        )
                    )
                if parsed.path == "/api/monitor/runs":
                    return self.send_json(rows(conn, "SELECT * FROM monitor_runs ORDER BY started_at DESC LIMIT 25"))
                if parsed.path == "/api/cases":
                    params = parse_qs(parsed.query)
                    priority = params.get("priority", [None])[0]
                    if priority:
                        data = rows(conn, "SELECT * FROM case_cards WHERE priority = ? ORDER BY risk_score DESC", (priority,))
                    else:
                        data = rows(conn, "SELECT * FROM case_cards ORDER BY priority, risk_score DESC")
                    return self.send_json(data)
                if parsed.path.startswith("/api/cases/"):
                    case_id = parsed.path.rsplit("/", 1)[-1]
                    case_item = row(conn, "SELECT * FROM cases WHERE id = ?", (case_id,))
                    if not case_item:
                        return self.send_json({"error": "case not found"}, 404)
                    case_item["organizations"] = rows(
                        conn,
                        """
                        SELECT o.*, co.role
                        FROM case_organizations co
                        JOIN organizations o ON o.id = co.organization_id
                        WHERE co.case_id = ?
                        ORDER BY o.priority, o.risk_score DESC
                        """,
                        (case_id,),
                    )
                    case_item["documents"] = rows(
                        conn,
                        "SELECT * FROM documents WHERE case_id = ? ORDER BY captured_at DESC, created_at DESC",
                        (case_id,),
                    )
                    case_item["intelligence"] = rows(
                        conn,
                        """
                        SELECT ic.*, o.name AS organization_name
                        FROM intelligence_cards ic
                        LEFT JOIN organizations o ON o.id = ic.organization_id
                        WHERE ic.case_id = ? AND ic.status = 'published'
                        ORDER BY COALESCE(ic.signal_date, ic.approved_at, ic.created_at) DESC, ic.priority
                        """,
                        (case_id,),
                    )
                    return self.send_json(case_item)
            return self.send_json({"error": "not found"}, 404)
        except Exception as exc:
            return self.send_json({"error": str(exc)}, 500)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/monitor/run":
            try:
                return self.send_json(run_monitor())
            except Exception as exc:
                return self.send_json({"error": str(exc)}, 500)
        if parsed.path == "/api/official-documents/run":
            try:
                return self.send_json(run_official_documents())
            except Exception as exc:
                return self.send_json({"error": str(exc)}, 500)
        if parsed.path == "/api/documents/capture":
            try:
                payload = read_json_body(self)
                return self.send_json(capture_document(payload), 201)
            except Exception as exc:
                return self.send_json({"error": str(exc)}, 500)
        if parsed.path == "/api/admin/intel":
            try:
                payload = read_json_body(self)
                return self.send_json(create_intel_card(payload), 201)
            except Exception as exc:
                return self.send_json({"error": str(exc)}, 500)
        if parsed.path == "/api/admin/intel/publish":
            try:
                return self.send_json(update_intel_status(read_json_body(self), "published"))
            except Exception as exc:
                return self.send_json({"error": str(exc)}, 500)
        if parsed.path == "/api/admin/intel/reject":
            try:
                return self.send_json(update_intel_status(read_json_body(self), "rejected"))
            except Exception as exc:
                return self.send_json({"error": str(exc)}, 500)
        return self.send_json({"error": "not found"}, 404)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--init-db", action="store_true")
    parser.add_argument("--reset-db", action="store_true")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--monitor-loop", action="store_true")
    parser.add_argument("--interval-minutes", default=60, type=int)
    parser.add_argument("--port", default=8765, type=int)
    args = parser.parse_args()

    if args.init_db or args.reset_db or not DB_PATH.exists():
        init_db(reset=args.reset_db)
        safe_print(f"Database ready: {DB_PATH}")
        if args.init_db:
            return

    if args.monitor_loop:
        safe_print(f"Monitoring loop started. interval={args.interval_minutes} minutes")
        while True:
            result = run_monitor()
            safe_print(f"{utc_now()} monitor_run={result['run_id']} status={result['status']}")
            time.sleep(max(args.interval_minutes, 1) * 60)

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    safe_print(f"Serving tracker at http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        log_dir = BASE_DIR / "logs"
        log_dir.mkdir(exist_ok=True)
        (log_dir / "fatal.log").write_text(f"{utc_now()} {type(exc).__name__}: {exc}\n", encoding="utf-8")
        raise
