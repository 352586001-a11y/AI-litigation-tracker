import json
import sys
from urllib.request import Request, urlopen


def post_json(url):
    request = Request(url, method="POST")
    with urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python scripts/run_monitor_once.py https://your-service.onrender.com")
    base_url = sys.argv[1].rstrip("/")
    results = {
        "monitor": post_json(f"{base_url}/api/monitor/run"),
        "official_documents": post_json(f"{base_url}/api/official-documents/run"),
    }
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
