import argparse
import hashlib
import json
import os
import sqlite3
import sys
import time
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "tracker.db"
STATIC_DIR = BASE_DIR / "static"


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
        ("source_figaro", "Le Figaro / Groupe Figaro", "publisher_site", "France", "https://www.lefigaro.fr/", "daily", "P0 watch source for litigation, licensing and neighboring-rights signals."),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO sources
        (id, name, source_type, jurisdiction, base_url, refresh_cadence, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [row + (now, now) for row in sources],
    )

    docs = [
        (
            "doc_seed_judilibre",
            None,
            "source_judilibre",
            "Judilibre official API reference",
            "https://www.data.gouv.fr/dataservices/api-judilibre",
            "official_reference",
            "France",
            "official",
            "French judicial decisions open data source for case-document capture.",
        ),
        (
            "doc_seed_eurlex",
            "case_eu_tdm_watch",
            "source_eurlex",
            "EUR-Lex official EU law database",
            "https://eur-lex.europa.eu/",
            "official_reference",
            "European Union",
            "official",
            "EU-level source for case law, AI Act and copyright implementation monitoring.",
        ),
    ]
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
            "intel_sacd_ai_act_pressure",
            "SACD intensifies AI copyright pressure",
            "SACD is treated as a P0 creator-side signal because public AI-policy pressure can quickly become litigation or lobbying leverage around training transparency and remuneration.",
            "https://www.sacd.fr/",
            "SACD official site",
            "official_site",
            "France",
            "org_sacd",
            "case_watch_sacd_ai",
            "P0",
            "published",
            "rights_holder_statement",
            "SACD,AI Act,training transparency,creator remuneration",
            "official",
            8,
        ),
        (
            "intel_figaro_watch",
            "Le Figaro added as P0 media rights-holder watch",
            "Groupe Figaro is monitored as a high-value French news corpus owner. Signals around licensing, neighboring rights, opt-outs or AI search reuse should move directly into review.",
            "https://www.lefigaro.fr/",
            "Le Figaro",
            "publisher_site",
            "France",
            "org_figaro",
            "case_watch_figaro_ai",
            "P0",
            "published",
            "news",
            "Le Figaro,neighboring rights,news corpus,opt-out",
            "semi_official",
            7,
        ),
        (
            "intel_meta_fr_review",
            "French authors and publishers v. Meta remains document-capture priority",
            "The reported Meta/Llama training-data action is kept as P1 until an official court document, case number or judgment is captured.",
            "https://www.legifrance.gouv.fr/",
            "Official document pending",
            "official_portal",
            "France",
            "org_sgdl",
            "case_fr_meta_books3",
            "P1",
            "review",
            "news",
            "Meta,Llama,Books3,SGDL,SNE,SNAC",
            "media_lead",
            6,
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
        [row + (now, now, now, now if row[10] == "published" else None) for row in intel_cards],
    )


def rows(conn, query, params=()):
    return [dict(row) for row in conn.execute(query, params)]


def row(conn, query, params=()):
    item = conn.execute(query, params).fetchone()
    return dict(item) if item else None


def run_monitor():
    now = utc_now()
    with connect() as conn:
        source_rows = rows(conn, "SELECT * FROM sources ORDER BY name")
        run_id = "run_" + now.replace(":", "").replace("+", "Z")
        conn.execute(
            "INSERT INTO monitor_runs (id, status, started_at, completed_at, notes) VALUES (?, ?, ?, ?, ?)",
            (
                run_id,
                "completed",
                now,
                utc_now(),
                "Connector dry run completed. Official-source adapters are configured; production fetch requires source credentials and legal review.",
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
                if parsed.path == "/api/documents":
                    return self.send_json(rows(conn, "SELECT * FROM documents ORDER BY captured_at DESC, created_at DESC"))
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
                            ORDER BY ic.priority, ic.created_at DESC
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
                              ic.priority,
                              ic.created_at DESC
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
        if args.init_db and not args.reset_db:
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
