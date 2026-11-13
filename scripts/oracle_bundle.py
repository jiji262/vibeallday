"""Package an already-built remote client with its immutable source revision."""

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re
import shutil
import tarfile


def build_bundle(dist, *, commit, output):
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("a full source commit is required")
    shutil.copyfile(dist / "remote.html", dist / "index.html")
    (dist / "deployment.json").write_text(json.dumps({"commit": commit}) + "\n")
    with output.open("wb") as target, gzip.GzipFile(filename="", mode="wb", fileobj=target, mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w") as archive:
            add_files(archive, dist)
    with output.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def add_files(archive, dist):
    for path in sorted(dist.rglob("*")):
        if path.is_symlink():
            raise ValueError("symlinks are not allowed in deployment output")
        if path.is_file():
            entry = archive.gettarinfo(path, arcname=path.relative_to(dist).as_posix())
            entry.uid = entry.gid = entry.mtime = 0
            entry.uname = entry.gname = ""
            entry.mode = 0o644
            entry.pax_headers = {}
            with path.open("rb") as source:
                archive.addfile(entry, source)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--output", type=Path, required=True)
    options = parser.parse_args()
    print(build_bundle(options.dist, commit=options.commit, output=options.output))
