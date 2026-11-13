"""Bounded, sequential HTTPS checks for an exact deployed remote-client build."""

import argparse
import hashlib
import json
from pathlib import Path
import re
from urllib.error import HTTPError
from urllib.request import Request, urlopen

MAX_RESPONSE_BYTES = 8 * 1024 * 1024
REQUEST_TIMEOUT_SECONDS = 10


def fetch(origin, path):
    request = Request(origin.rstrip("/") + path, headers={"Cache-Control": "no-cache"})
    with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        data = response.read(MAX_RESPONSE_BYTES + 1)
        if len(data) > MAX_RESPONSE_BYTES:
            raise ValueError("verification response too large")
        return data, response.headers


def verify(origin, *, commit, dist):
    metadata, headers = fetch(origin, "/deployment.json")
    if json.loads(metadata)["commit"] != commit or "no-cache" not in headers["Cache-Control"]:
        raise ValueError("active deployment does not match the requested commit")
    index, headers = fetch(origin, "/")
    if index != (dist / "index.html").read_bytes() or "no-cache" not in headers["Cache-Control"]:
        raise ValueError("deployed HTML differs from the verified build")
    assets = re.findall(r'(?:src|href)="(/assets/[^"?]+\.(?:js|css))"', index.decode())
    if not assets:
        raise ValueError("HTML has no build entry assets")
    for path in assets[:3]:
        data, headers = fetch(origin, path)
        expected = hashlib.sha256((dist / path.lstrip("/")).read_bytes()).digest()
        if hashlib.sha256(data).digest() != expected or "immutable" not in headers["Cache-Control"]:
            raise ValueError(f"asset content/cache mismatch: {path}")
        if "text/html" in headers["Content-Type"]:
            raise ValueError("asset incorrectly returned SPA HTML")
    try:
        fetch(origin, "/assets/oracle-verification-missing.js")
    except HTTPError as error:
        if error.code != 404 or "no-store" not in error.headers.get("Cache-Control", ""):
            raise ValueError("missing assets must return uncached 404") from error
    else:
        raise ValueError("missing asset unexpectedly succeeded")
    return {"verified": commit, "entryAssets": assets[:3]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--dist", type=Path, required=True)
    options = parser.parse_args()
    print(json.dumps(verify(options.origin, commit=options.commit, dist=options.dist)))
