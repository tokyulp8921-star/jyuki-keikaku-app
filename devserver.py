#!/usr/bin/env python3
"""開発用ローカルサーバー。全レスポンスにキャッシュ禁止ヘッダーを付与し、
ブラウザの独自キャッシュ判断(ヒューリスティックキャッシュ)による古いファイル参照を防ぐ。"""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8791
    server = HTTPServer(('0.0.0.0', port), NoCacheHandler)
    print(f'Serving on 0.0.0.0:{port} with no-cache headers')
    server.serve_forever()
