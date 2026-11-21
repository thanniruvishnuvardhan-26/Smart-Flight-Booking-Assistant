import http.server
import socketserver
import sys
from pathlib import Path

DIRECTORY = Path(__file__).resolve().parent

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)

    def end_headers(self):
        # Force browser to never cache index.html, script.js, style.css
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
    with socketserver.TCPServer(("0.0.0.0", port), NoCacheHTTPRequestHandler) as httpd:
        print(f"Serving frontend from {DIRECTORY} on port {port} with Cache-Control: no-store")
        httpd.serve_forever()
