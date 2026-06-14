import json
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import app


def get_json(path):
    with urllib.request.urlopen(f"http://127.0.0.1:8899{path}", timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def main():
    app.init_db(reset=False)
    server = ThreadingHTTPServer(("127.0.0.1", 8899), app.Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.2)

    health = get_json("/api/health")
    cases = get_json("/api/cases")
    organizations = get_json("/api/organizations")
    intel = get_json("/api/intel?status=published")
    admin_intel = get_json("/api/admin/intel")
    sacd = get_json("/api/cases/case_watch_sacd_ai")
    monitor_result = urllib.request.Request("http://127.0.0.1:8899/api/monitor/run", method="POST")
    with urllib.request.urlopen(monitor_result, timeout=5) as response:
        run = json.loads(response.read().decode("utf-8"))

    assert health["ok"] is True
    assert len(cases) >= 4
    assert any(item["name"] == "SACD" and item["priority"] == "P0" for item in organizations)
    assert any(item["name"] == "Le Figaro / Groupe Figaro" and item["priority"] == "P0" for item in organizations)
    assert any(item["signal_type"] == "news" for item in intel)
    assert any(item["signal_type"] == "official_court_document" for item in intel)
    assert any(item["signal_type"] in {"news", "rights_holder_statement"} for item in admin_intel)
    assert sacd["priority"] == "P0"
    assert run["status"] == "completed"

    print("smoke ok")
    print(f"cases={len(cases)} organizations={len(organizations)} intel={len(intel)} checked_sources={run['checked_sources']}")
    server.shutdown()


if __name__ == "__main__":
    main()
