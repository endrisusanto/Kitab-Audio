#!/usr/bin/env python3
"""
Lightweight Web Server with LMStudio AI Chat Integration for Kitab Audio.
Zero external dependencies (uses standard library http.server and urllib).
"""

import http.server
import socketserver
import os
import sys
import json
import urllib.request
import re

PORT = int(os.environ.get("PORT", 8080))
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
LMSTUDIO_BASE_URL = os.environ.get("LMSTUDIO_BASE_URL", "https://lmstudio.endrisusanto.my.id/v1")
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Load database in memory for quick RAG retrieval
AUDIO_DB = None

def get_audio_db():
    global AUDIO_DB
    if AUDIO_DB is None:
        db_path = os.path.join(WEB_DIR, "data", "audio_data.json")
        if os.path.exists(db_path):
            try:
                with open(db_path, "r", encoding="utf-8") as f:
                    AUDIO_DB = json.load(f)
            except Exception as e:
                print(f"Error loading audio DB: {e}")
    return AUDIO_DB

def retrieve_relevant_gear(query, max_results=8):
    db = get_audio_db()
    if not db or "categories" not in db:
        return []

    q_lower = query.lower()
    keywords = [w for w in re.split(r'\W+', q_lower) if len(w) >= 2]
    
    scored_items = []
    for cat in db["categories"]:
        cat_name = cat["name"]
        cat_match = 3 if cat_name.lower() in q_lower else 0

        for item in cat.get("items", []):
            score = cat_match
            name_low = item.get("name", "").lower()
            tagline_low = item.get("tagline", "").lower()
            review_low = item.get("review", "").lower()
            
            for kw in keywords:
                if kw in name_low:
                    score += 5
                if kw in tagline_low:
                    score += 2
                if kw in review_low:
                    score += 1
            
            # Boost higher tier items
            tier = item.get("tier", "").upper()
            if tier in ["SS", "SSS", "S++", "S+"]:
                score += 3
            elif tier == "S":
                score += 2
            elif tier in ["A+", "A"]:
                score += 1

            if score > 0:
                scored_items.append((score, item))

    scored_items.sort(key=lambda x: x[0], reverse=True)
    return [it[1] for it in scored_items[:max_results]]

class CustomHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/models":
            self.handle_get_models()
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/chat":
            self.handle_post_chat()
            return
        if self.path == "/api/upload-excel":
            self.handle_post_upload_excel()
            return
        self.send_error(404, "Endpoint not found")

    def handle_post_upload_excel(self):
        global AUDIO_DB
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "error": "File kosong / tidak ada data"}).encode("utf-8"))
            return

        body = self.rfile.read(content_length)
        content_type = self.headers.get("Content-Type", "")
        
        file_bytes = body
        if "multipart/form-data" in content_type:
            boundary_match = re.search(r'boundary=([^;]+)', content_type)
            if boundary_match:
                boundary = boundary_match.group(1).strip().strip('"').encode("utf-8")
                parts = body.split(b"--" + boundary)
                for p in parts:
                    if b"filename=" in p and b"\r\n\r\n" in p:
                        _, content_part = p.split(b"\r\n\r\n", 1)
                        file_bytes = content_part.rstrip(b"\r\n").rstrip(b"--")
                        break

        upload_dir = os.path.join(WEB_DIR, "data")
        os.makedirs(upload_dir, exist_ok=True)
        upload_path = os.path.join(upload_dir, "uploaded_latest.xlsx")
        
        try:
            with open(upload_path, "wb") as f:
                f.write(file_bytes)

            from scripts.parse_excel import parse_xlsx
            new_db = parse_xlsx(upload_path)
            
            json_path = os.path.join(upload_dir, "audio_data.json")
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(new_db, f, ensure_ascii=False, indent=2)

            AUDIO_DB = new_db

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            resp = {
                "success": True,
                "message": "Database berhasil diperbarui dari file Excel!",
                "stats": new_db.get("stats", {})
            }
            self.wfile.write(json.dumps(resp).encode("utf-8"))

        except Exception as e:
            print(f"Error parsing uploaded Excel: {e}")
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            err_resp = {
                "success": False,
                "error": f"Gagal memproses file Excel: {str(e)}"
            }
            self.wfile.write(json.dumps(err_resp).encode("utf-8"))

    def handle_get_models(self):
        try:
            req = urllib.request.Request(
                f"{LMSTUDIO_BASE_URL}/models",
                headers={"User-Agent": USER_AGENT}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = resp.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(data)
        except Exception as e:
            # Fallback default models if remote fails
            fallback = {
                "data": [
                    {"id": "google/gemma-4-e4b"},
                    {"id": "qwen3.6-35b-a3b-uncensored-hauhaucs-aggressive"},
                    {"id": "google/gemma-4-12b-qat"}
                ]
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(fallback).encode("utf-8"))

    def handle_post_chat(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        
        try:
            req_data = json.loads(body.decode("utf-8"))
            model = req_data.get("model", "google/gemma-4-e4b")
            messages = req_data.get("messages", [])
            user_query = ""
            for m in reversed(messages):
                if m.get("role") == "user":
                    user_query = m.get("content", "")
                    break

            # Retrieve context gear from local Kitab Audio database
            relevant_gear = retrieve_relevant_gear(user_query, max_results=6)
            
            context_text = ""
            if relevant_gear:
                context_text = "Referensi Data Nyata Kitab Audio Fernanda Gunsan:\n"
                for g in relevant_gear:
                    context_text += f"- [{g.get('category')}] {g.get('name')} (Tier: {g.get('tier', '-')}, VFM: {g.get('value_for_money', '-')}, Harga: {g.get('price_formatted') or g.get('price_raw') or 'Cek Link'})\n"
                    if g.get('tagline'): context_text += f"  Highlight: {g.get('tagline')}\n"
                    if g.get('review'): context_text += f"  Review Catatan: {g.get('review')[:250]}...\n"
                    if g.get('driver'): context_text += f"  Driver: {g.get('driver')}\n"
                    if g.get('codec'): context_text += f"  Codec: {g.get('codec')}\n"

            system_instruction = (
                "Anda adalah Asisten Audio Kitab Audio (Fernanda Gunsan). Anda ahli dalam merekomendasikan TWS, IEM, Headphone, DAC, Speaker, Mic, dan audio gear lainnya.\n"
                "Pedoman Respon:\n"
                "1. Jawab dalam Bahasa Indonesia yang santai, jujur, to-the-point, dan berbobot seperti seorang audiophile berpengalaman.\n"
                "2. Jangan gunakan jargon AI klise seperti 'revolusioner', 'didukung AI canggih', atau kata-kata marketing kosong.\n"
                "3. Jangan gunakan tanda em dash (—), gunakan koma, titik dua, atau tanda kurung.\n"
                "4. Rekomendasikan nama gear spesifik dengan menyebutkan kelebihan, karakter suara (Bass, Mid, Treble, Soundstage), dan perkiraan harganya.\n"
                "5. Utamakan data dari Kitab Audio berikut jika relevan:\n"
                f"{context_text}"
            )

            augmented_messages = [{"role": "system", "content": system_instruction}]
            for m in messages:
                if m.get("role") != "system":
                    augmented_messages.append(m)

            payload = {
                "model": model,
                "messages": augmented_messages,
                "max_tokens": 1200,
                "temperature": 0.7
            }

            api_req = urllib.request.Request(
                f"{LMSTUDIO_BASE_URL}/chat/completions",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "User-Agent": USER_AGENT,
                    "Content-Type": "application/json"
                }
            )

            with urllib.request.urlopen(api_req, timeout=45) as resp:
                resp_bytes = resp.read()
                # Parse to ensure clean content extraction if reasoning_content is returned
                resp_json = json.loads(resp_bytes.decode("utf-8"))
                choice = resp_json.get("choices", [{}])[0]
                msg = choice.get("message", {})
                
                # If content is empty but reasoning_content exists, fallback to reasoning or note
                if not msg.get("content") and msg.get("reasoning_content"):
                    msg["content"] = msg.get("reasoning_content")

                # Attach retrieved gear so frontend can render product cards
                resp_json["relevant_gear"] = relevant_gear

                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps(resp_json).encode("utf-8"))

        except Exception as e:
            print(f"Chat completion error: {e}")
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            err_resp = {
                "error": f"Gagal menghubungi model AI: {str(e)}",
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": "Maaf, koneksi ke server model AI LMStudio sedang mengalami gangguan. Silakan coba lagi beberapa saat."
                    }
                }]
            }
            self.wfile.write(json.dumps(err_resp).encode("utf-8"))

    def guess_type(self, path):
        ctype = super().guess_type(path)
        if path.endswith(".js"): return "application/javascript; charset=utf-8"
        if path.endswith(".json"): return "application/json; charset=utf-8"
        if path.endswith(".css"): return "text/css; charset=utf-8"
        if path.endswith(".html"): return "text/html; charset=utf-8"
        if path.endswith(".svg"): return "image/svg+xml"
        return ctype

def main():
    data_file = os.path.join(WEB_DIR, "data", "audio_data.json")
    if not os.path.exists(data_file):
        print("Data file not found, running parse_excel.py...")
        from scripts.parse_excel import main as parse_main
        parse_main()

    handler = CustomHTTPHandler
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"Kitab Audio Web App with LMStudio AI running at http://localhost:{PORT}")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == "__main__":
    main()
