# /// script
# requires-python = ">=3.10"
# dependencies = ["websocket-client>=1.7"]
# ///
"""Smoke test for the leaderboard page in headless Chrome (via the DevTools protocol).

Serves the repo over http on 127.0.0.1 (like GitHub Pages), loads the page at desktop and phone widths, clicks every
segmented control, tab, sortable column header and treemap tile, types into the search box, opens the compare dialog
and closes it with a real Escape key press, and fails on any uncaught exception, console error, sideways page scroll or
section that rendered its "failed to render" card.

    uv run tools/smoke.py [--url https://.../index.html]
"""
from __future__ import annotations

import argparse
import functools
import http.server
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from pathlib import Path

import websocket

ROOT = Path(__file__).resolve().parent.parent
CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]

# Runs inside the page. Exercises the interactive controls and reports what it found.
EXERCISE = r"""
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { sections: [], failed: [], clicks: 0, dialog: null, sorted: 0, searched: null, tiles: 0 };
  out.sections = [...document.querySelectorAll("#lb-main > section")].map((s) => s.id);
  out.failed = [...document.querySelectorAll("#lb-main .lb-empty")].map((e) => e.textContent).filter((t) => /failed to render/.test(t));
  const click = async (el) => { el.click(); out.clicks++; await sleep(20); };
  for (const sec of document.querySelectorAll("#lb-main > section")) {
    for (const group of sec.querySelectorAll(".lb-seg, .lb-tabs")) {
      const buttons = [...group.querySelectorAll("button")];
      for (const b of buttons) await click(b);
      if (buttons[0]) await click(buttons[0]);
    }
    for (const sel of sec.querySelectorAll("select")) {
      for (let i = 0; i < sel.options.length; i++) {
        sel.selectedIndex = i; sel.dispatchEvent(new Event("change", { bubbles: true })); out.clicks++; await sleep(10);
      }
      sel.selectedIndex = 0; sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  for (const t of document.querySelectorAll("#heatmap button[class*='hm-tile']")) { await click(t); out.tiles++; }
  for (const th of document.querySelectorAll("#models thead th")) {
    const target = th.querySelector("button") || th;
    await click(target); await click(target); out.sorted++;
  }
  const search = document.querySelector("#models input");
  if (search) {
    const rows = () => document.querySelectorAll("#models tbody tr").length;
    const before = rows();
    search.value = "glm"; search.dispatchEvent(new Event("input", { bubbles: true })); await sleep(50);
    const during = rows();
    search.value = ""; search.dispatchEvent(new Event("input", { bubbles: true })); await sleep(50);
    out.searched = { before, during, after: rows() };
  }
  if (window.LB && typeof LB.openCompare === "function") {
    LB.openCompare(); await sleep(150);
    const dlg = document.querySelector("[role=dialog]");
    const visible = !!dlg && dlg.getClientRects().length > 0;
    let rows = 0;
    if (dlg) {
      rows = dlg.querySelectorAll("[class*='cmp-row']").length;
      for (const sel of dlg.querySelectorAll("select")) {
        for (let i = 0; i < Math.min(sel.options.length, 6); i++) {
          sel.selectedIndex = i; sel.dispatchEvent(new Event("change", { bubbles: true })); await sleep(20);
        }
      }
    }
    out.dialog = { opened: visible, rows };
  }
  out.overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  return JSON.stringify(out);
})()
"""
DIALOG_OPEN = "(() => { const d = document.querySelector('[role=dialog]'); return !!d && d.getClientRects().length > 0; })()"


class CDP:
    def __init__(self, ws_url: str):
        self.ws = websocket.create_connection(ws_url, timeout=60, suppress_origin=True)
        self.next_id = 0
        self.events: list[dict] = []

    def call(self, method: str, **params):
        self.next_id += 1
        mid = self.next_id
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})
            self.events.append(msg)

    def wait_for(self, method: str, timeout: float = 30):
        end = time.time() + timeout
        for i, e in enumerate(self.events):
            if e.get("method") == method:
                return self.events.pop(i)
        while time.time() < end:
            msg = json.loads(self.ws.recv())
            if msg.get("method") == method:
                return msg
            self.events.append(msg)
        raise TimeoutError(method)

    def evaluate(self, expr: str, await_promise: bool = False):
        r = self.call("Runtime.evaluate", expression=expr, awaitPromise=await_promise, returnByValue=True)
        if "exceptionDetails" in r:
            raise RuntimeError(json.dumps(r["exceptionDetails"])[:600])
        return r["result"].get("value")


def problems(events: list[dict]) -> list[str]:
    out = []
    for e in events:
        m, p = e.get("method"), e.get("params", {})
        if m == "Runtime.exceptionThrown":
            d = p.get("exceptionDetails", {})
            out.append("exception: " + (d.get("exception", {}).get("description") or d.get("text", ""))[:400])
        elif m == "Runtime.consoleAPICalled" and p.get("type") in ("error", "assert"):
            out.append("console.error: " + " ".join(str(a.get("value", a.get("description", ""))) for a in p.get("args", []))[:400])
        elif m == "Log.entryAdded" and p.get("entry", {}).get("level") == "error":
            out.append("log: " + p["entry"].get("text", "")[:400])
    return out


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="", help="page to test (default: this repo served over http, like GitHub Pages)")
    args = ap.parse_args()
    chrome = next((p for p in CHROME_PATHS if os.path.exists(p)), None)
    if not chrome:
        print("Chrome/Edge not found")
        return 2
    server = None
    if not args.url:
        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a):
                pass
        handler = functools.partial(Quiet, directory=str(ROOT))
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        args.url = f"http://127.0.0.1:{server.server_address[1]}/index.html"
    print("testing", args.url)
    port = free_port()
    # Let Chrome create its profile folder: on Windows, Python 3.13+ gives tempfile.mkdtemp() folders an owner-only ACL,
    # which Chrome's sandboxed processes can't use (Chrome then exits silently).
    profile = os.path.join(tempfile.gettempdir(), f"lb-smoke-{os.getpid()}-{port}")
    proc = subprocess.Popen([chrome, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                             "--disable-extensions", f"--remote-debugging-port={port}", f"--user-data-dir={profile}",
                             "--window-size=1440,1000", "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    failures = 0
    try:
        ws_url = None
        for _ in range(100):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=2) as r:
                    pages = [t for t in json.load(r) if t.get("type") == "page"]
                if pages:
                    ws_url = pages[0]["webSocketDebuggerUrl"]
                    break
            except OSError:
                pass
            time.sleep(0.2)
        if not ws_url:
            print("could not connect to headless Chrome")
            return 2
        cdp = CDP(ws_url)
        for m in ("Runtime.enable", "Log.enable", "Page.enable"):
            cdp.call(m)
        for name, width, height, mobile in (("desktop 1440", 1440, 1000, False), ("phone 390", 390, 844, True)):
            cdp.call("Emulation.setDeviceMetricsOverride", width=width, height=height, deviceScaleFactor=1, mobile=mobile)
            cdp.events.clear()
            cdp.call("Page.navigate", url=args.url)
            cdp.wait_for("Page.loadEventFired")
            for _ in range(100):
                if cdp.evaluate("document.body && document.body.dataset.ready === '1'"):
                    break
                time.sleep(0.1)
            result = json.loads(cdp.evaluate(EXERCISE, await_promise=True))
            if result["dialog"]:
                # A real key press: a synthetic KeyboardEvent can't trigger the native <dialog> cancel on Escape.
                for kind in ("keyDown", "keyUp"):
                    cdp.call("Input.dispatchKeyEvent", type=kind, key="Escape", code="Escape", windowsVirtualKeyCode=27)
                time.sleep(0.3)
                result["dialog"]["closedByEsc"] = not cdp.evaluate(DIALOG_OPEN)
            errs = problems(cdp.events)
            bad = errs + [f"section failed: {t}" for t in result["failed"]]
            if result["dialog"] and not (result["dialog"]["opened"] and result["dialog"]["closedByEsc"]):
                bad.append(f"compare dialog: {result['dialog']}")
            if result["overflowX"] > 1:
                bad.append(f"page scrolls sideways by {result['overflowX']} px")
            print(f"[{name}] sections={len(result['sections'])} ({', '.join(result['sections'])})")
            print(f"[{name}] clicks={result['clicks']} tiles={result['tiles']} sortable={result['sorted']} "
                  f"search={result['searched']} dialog={result['dialog']}")
            for b in bad:
                print(f"[{name}] PROBLEM {b}")
            failures += len(bad)
        print("OK" if not failures else f"{failures} problem(s)")
        return 1 if failures else 0
    finally:
        if server:
            server.shutdown()
        close_chrome(port, profile)
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        shutil.rmtree(profile, ignore_errors=True)


def close_chrome(port: int, profile: str) -> None:
    """On Windows chrome.exe hands off to a browser process tree that outlives the launcher, so terminating the
    launcher leaves headless Chrome running: close it through DevTools, and kill whatever still uses the profile."""
    def alive() -> bool:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=2):
                return True
        except OSError:
            return False

    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=3) as r:
            ws = websocket.create_connection(json.load(r)["webSocketDebuggerUrl"], timeout=10, suppress_origin=True)
        ws.send(json.dumps({"id": 1, "method": "Browser.close"}))
        try:
            ws.recv()
        except Exception:  # noqa: BLE001 - the connection drops as the browser exits
            pass
        ws.close()
    except Exception:  # noqa: BLE001
        pass
    for _ in range(50):
        if not alive():
            break
        time.sleep(0.2)
    if os.name == "nt":
        ps = ("Get-CimInstance Win32_Process -Filter \"Name='chrome.exe' OR Name='msedge.exe'\" | "
              f"Where-Object {{ $_.CommandLine -like '*{profile}*' }} | "
              "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }")
        subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, timeout=60)


if __name__ == "__main__":
    sys.exit(main())
