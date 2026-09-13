#!/usr/bin/env python3
"""Generate Arena3 screens via Google Stitch MCP. Key from .secrets/google.env."""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path("/workspace")
OUT = ROOT / "artifacts" / "stitch"
OUT.mkdir(parents=True, exist_ok=True)

def load_key() -> str:
    envp = ROOT / ".secrets" / "google.env"
    if envp.exists():
        for line in envp.read_text().splitlines():
            if line.startswith("STITCH_API_KEY=") or line.startswith("GOOGLE_API_KEY="):
                return line.split("=", 1)[1].strip()
    return os.environ.get("STITCH_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""


KEY = load_key()
URL = "https://stitch.googleapis.com/mcp"
if not KEY:
    sys.exit("missing STITCH_API_KEY")


def parse_body(raw: str):
    raw = raw.strip()
    if not raw:
        return None
    if raw.startswith("event:") or raw.startswith("data:"):
        for line in raw.splitlines():
            if line.startswith("data:"):
                return json.loads(line[5:].strip())
        return {"raw": raw}
    return json.loads(raw)


def post(payload: dict, timeout: int = 60):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "X-Goog-Api-Key": KEY,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode()
            return r.status, parse_body(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            body = parse_body(raw)
        except Exception:
            body = {"raw": raw[:2000]}
        return e.code, body
    except Exception as e:
        return 0, {"error": str(e)}


def call(name: str, arguments: dict, timeout: int = 60, retries: int = 0):
    payload = {
        "jsonrpc": "2.0",
        "id": int(time.time() * 1000) % 10_000_000,
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    }
    status, body = post(payload, timeout=timeout)
    return status, body


def unwrap(body):
    if not isinstance(body, dict):
        return body
    if "error" in body and "result" not in body:
        return body
    result = body.get("result") or body
    if isinstance(result, dict) and "content" in result:
        chunks = []
        for c in result["content"]:
            if isinstance(c, dict) and c.get("type") == "text":
                chunks.append(c.get("text") or "")
            elif isinstance(c, dict) and "text" in c:
                chunks.append(c["text"])
        text = "\n".join(chunks).strip()
        if text.startswith("{") or text.startswith("["):
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return {"text": text, "structured": result.get("structuredContent")}
        return {"text": text, "structured": result.get("structuredContent"), "raw_result": result}
    if isinstance(result, dict) and "structuredContent" in result:
        return result["structuredContent"]
    return result


def dump(name: str, obj):
    path = OUT / f"{name}.json"
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False, default=str))
    print(f"wrote {path}")


def main():
    print("init…")
    st, body = post(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "arena3-stitch", "version": "1.0"},
            },
        }
    )
    print("initialize", st)
    post({"jsonrpc": "2.0", "method": "notifications/initialized"})

    print("create_project…")
    st, body = call("create_project", {"title": "Arena3 Slice 1"})
    created = unwrap(body)
    dump("create_project", {"status": st, "body": body, "unwrapped": created})
    print("create_project", st, json.dumps(created, default=str)[:800])

    project_id = None
    name = None
    if isinstance(created, dict):
        name = created.get("name") or created.get("project") or ""
        project_id = created.get("projectId") or created.get("id")
        if not project_id and isinstance(name, str) and name.startswith("projects/"):
            project_id = name.split("/", 1)[1]
        # sometimes nested
        for k in ("project", "result"):
            v = created.get(k)
            if isinstance(v, dict):
                project_id = project_id or v.get("projectId") or v.get("id")
                name = name or v.get("name")
    if not project_id:
        print("FATAL no project id")
        sys.exit(1)
    print("PROJECT", project_id, name)
    (OUT / "project_id.txt").write_text(project_id)

    ds = {
        "displayName": "Arena3 Editorial",
        "theme": {
            "bodyFont": "BE_VIETNAM_PRO",
            "headlineFont": "NEWSREADER",
            "labelFont": "BE_VIETNAM_PRO",
            "colorMode": "LIGHT",
            "colorVariant": "FIDELITY",
            "customColor": "#1F5C43",
            "overridePrimaryColor": "#1F5C43",
            "overrideSecondaryColor": "#E6DECD",
            "overrideTertiaryColor": "#7A4E0C",
            "overrideNeutralColor": "#141C12",
            "roundness": "ROUND_TWELVE",
        },
    }
    print("create_design_system…")
    st, body = call("create_design_system", {"projectId": project_id, "designSystem": ds}, timeout=90)
    created_ds = unwrap(body)
    dump("design_system", {"status": st, "unwrapped": created_ds, "body": body})
    print("design_system", st, json.dumps(created_ds, default=str)[:800])
    ds_id = None
    if isinstance(created_ds, dict):
        ds_id = created_ds.get("name") or created_ds.get("assetId") or created_ds.get("id")
        if isinstance(ds_id, str) and ds_id.startswith("assets/"):
            ds_id = ds_id.split("/", 1)[1]
        inner = created_ds.get("designSystem") or created_ds.get("asset") or {}
        if isinstance(inner, dict):
            ds_id = ds_id or inner.get("name") or inner.get("assetId")
    print("DS_ID", ds_id)

    screens = [
        {
            "slug": "member-home",
            "deviceType": "MOBILE",
            "prompt": (
                "Vietnamese PWA home for a member of Arena3 indoor sports center (Ho Chi Minh City). "
                "Editorial club app, not a generic fitness template. Light warm paper background #E6DECD, "
                "cream cards #FFFAF2, forest primary #1F5C43, ink text #141C12. Headlines in Newsreader serif, "
                "UI in Be Vietnam Pro. High WCAG AA contrast. No emoji, no purple, no glassmorphism. "
                "MOBILE 390x844. "
                "Top app bar: small mark + Arena3. Greeting 'Xin chào, Nam' and member code TV-0101 in muted ink. "
                "Membership pass is a SOLID dark forest green card (#163528) with cream text — NEVER put body text on a photograph. "
                "Card content: 'Thẻ thành viên', plan 'All-access 3 môn', sport scope, expiry 13/12/2026, quota 11 giờ sân, code TV-0101. Subtle court-line pattern. "
                "Small amber banner: gói sắp hết hạn — Gia hạn. "
                "Today section: timeline 20:00 · Sân CL-04 · CRT-20260913-0001 with a Hủy outline button. "
                "Three quick actions as CREAM cards with an icon and label (Đặt sân, Lớp, Gói) — labels sit on solid cream, photos only as 40px thumbs. "
                "Bottom tab bar FOUR items: Lịch (active), Đặt sân, Lớp, Gói. Active tab forest green. "
                "Vietnamese copy. Calm, expensive, concentric radii 12/16/24."
            ),
        },
        {
            "slug": "book-court",
            "deviceType": "MOBILE",
            "prompt": (
                "Vietnamese PWA court booking screen for Arena3. Same design system: paper #E6DECD, cream cards, "
                "forest #1F5C43, ink #141C12, Newsreader + Be Vietnam Pro. MOBILE 390x844. "
                "Title 'Đặt sân'. Horizontal date chips (Nay, T2…). Segmented control: Tất cả / Cầu lông / Bóng rổ / Bóng chuyền. "
                "Legend: Trống / Giữ / Đã bán / Lớp. "
                "Court availability as a clean heatmap: rows CL-01…CL-08, columns 06–21h. Free cells are cream with a hairline; "
                "booked cells forest tint; class cells ink; hold cells amber. Hour labels always dark ink on cream — never white on photo. "
                "A photo banner at top uses a STRONG dark scrim and only a large serif title 'Cầu lông · slot 60′' in cream. "
                "Bottom tab: Lịch, Đặt sân (active), Lớp, Gói. No emoji. High contrast."
            ),
        },
        {
            "slug": "login",
            "deviceType": "MOBILE",
            "prompt": (
                "Vietnamese login screen for Arena3 sports center staff and members. Same design system. MOBILE. "
                "Top: editorial photo of indoor badminton hall with a heavy dark scrim and cream wordmark Arena3. "
                "Title 'Đăng nhập' in Newsreader. Subtitle 'SĐT hoặc email'. "
                "Cream card form: phone field, password field with show/hide, primary forest button 'Vào'. "
                "Demo accounts as a list of cream rows with role chip (Quản lý / Lễ tân / HLV / TV) and name — text on solid cream. "
                "High contrast, 44px tap targets, no emoji."
            ),
        },
        {
            "slug": "landing",
            "deviceType": "DESKTOP",
            "prompt": (
                "Desktop marketing landing for Arena3 indoor sports center. 1440x900. Same design system. "
                "Sticky cream header: mark + Arena3, links HLV, Đăng nhập, primary Đăng ký. "
                "Full-bleed hall photo hero with a strong left-to-right dark scrim. Huge Newsreader headline "
                "'Sân, lớp, gói — một lịch.' Cream primary CTA 'Trở thành thành viên' and outline 'Xem sân & giá'. "
                "Section 'Sân đang mở': three tall editorial photos (cầu lông, bóng rổ, bóng chuyền) with titles on a bottom scrim only. "
                "Stats row. Coaches grid with portraits. Price table on cream. Package cards. "
                "Vietnamese. High contrast. No purple, no emoji, no glass."
            ),
        },
        {
            "slug": "desk",
            "deviceType": "DESKTOP",
            "prompt": (
                "Desktop receptionist desk for Arena3. Same design system. 1440x900. "
                "App shell with top nav: Quầy (active), Sân, Dụng cụ. User 'Lễ tân ca 1'. "
                "Large search field 'Tìm thành viên — tên, SĐT, mã TV' on cream. "
                "Primary actions: Mở ca, Tạo TV, Walk-in. "
                "Shift badge 'Ca đang mở · TM 0đ'. "
                "Results as a dense table: name, phone, member code, status chip. "
                "Right rail: tạo thành viên form. "
                "All text on solid cream/paper — photos only in a thin header banner with scrim. "
                "Vietnamese, 44px controls, high contrast, no emoji."
            ),
        },
    ]

    gen_args_base = {"projectId": project_id, "modelId": "GEMINI_3_8_FLASH"}
    if ds_id:
        gen_args_base["designSystem"] = ds_id if not str(ds_id).startswith("assets/") else str(ds_id)

    for spec in screens:
        print(f"\n=== generate {spec['slug']} ===")
        args = {
            **gen_args_base,
            "deviceType": spec["deviceType"],
            "prompt": spec["prompt"],
        }
        st, body = call("generate_screen_from_text", args, timeout=300)
        un = unwrap(body)
        dump(f"gen-{spec['slug']}", {"status": st, "unwrapped": un, "body_keys": list(body.keys()) if isinstance(body, dict) else type(body)})
        print("status", st)
        print(json.dumps(un, default=str)[:1200])

        screen_name = None
        screen_id = None
        if isinstance(un, dict):
            screen_name = un.get("name")
            screen_id = un.get("screenId") or un.get("id")
            if not screen_id and isinstance(screen_name, str) and "/screens/" in screen_name:
                screen_id = screen_name.split("/screens/")[-1]
        if screen_name:
            print("get_screen", screen_name)
            st2, body2 = call("get_screen", {"name": screen_name}, timeout=90)
            got = unwrap(body2)
            dump(f"screen-{spec['slug']}", got)
            # download files
            files = []
            if isinstance(got, dict):
                for key in ("screenshot", "html", "screenshotFile", "htmlFile", "image", "files"):
                    v = got.get(key)
                    if isinstance(v, dict) and v.get("downloadUrl"):
                        files.append((key, v.get("mimeType"), v["downloadUrl"]))
                    if isinstance(v, list):
                        for f in v:
                            if isinstance(f, dict) and f.get("downloadUrl"):
                                files.append((f.get("mimeType") or key, f.get("mimeType"), f["downloadUrl"]))
                # nested
                for k, v in got.items():
                    if isinstance(v, dict) and v.get("downloadUrl"):
                        files.append((k, v.get("mimeType"), v["downloadUrl"]))
            print("files", files)
            for i, (k, mime, url) in enumerate(files):
                try:
                    ext = ".png" if (mime or "").startswith("image") or "screenshot" in k.lower() else ".html"
                    dest = OUT / f"{spec['slug']}{ext if i==0 else f'-{k}{ext}'}"
                    urllib.request.urlretrieve(url, dest)
                    print("saved", dest, dest.stat().st_size)
                except Exception as e:
                    print("download fail", k, e)

    print("\nlist_screens…")
    st, body = call("list_screens", {"projectId": project_id}, timeout=60)
    dump("list_screens", unwrap(body))
    print("done")


if __name__ == "__main__":
    main()
