"""Restricted SSH receiver for static Oracle releases (Python stdlib only)."""

import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import sys
import tarfile
import tempfile

MAX_ARCHIVE_BYTES = 128 * 1024 * 1024
MAX_EXPANDED_BYTES = 512 * 1024 * 1024
MAX_FILES = 5000
COPY_BYTES = 1024 * 1024
REVISION = r"[0-9a-f]{40}"
CHECKSUM = r"[0-9a-f]{64}"


def digest(path):
    checksum = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(COPY_BYTES):
            checksum.update(chunk)
    return checksum.hexdigest()


def spool(source, destination):
    total = 0
    checksum = hashlib.sha256()
    while chunk := source.read(COPY_BYTES):
        total += len(chunk)
        if total > MAX_ARCHIVE_BYTES:
            raise ValueError("archive too large")
        checksum.update(chunk)
        destination.write(chunk)
    destination.seek(0)
    return checksum.hexdigest()


def validate_entries(bundle):
    entries, names, total = [], set(), 0
    for entry in bundle:
        path = PurePosixPath(entry.name)
        if (path.is_absolute() or ".." in path.parts or "\\" in entry.name
                or str(path) != entry.name or not path.parts):
            raise ValueError("unsafe archive path")
        if not entry.isfile():
            raise ValueError("only regular files are allowed")
        if entry.name in names:
            raise ValueError("duplicate archive path")
        total += entry.size
        if total > MAX_EXPANDED_BYTES or len(entries) >= MAX_FILES:
            raise ValueError("expanded archive too large")
        names.add(entry.name)
        entries.append(entry)
    return entries


def unpack(source, destination):
    with tarfile.open(fileobj=source, mode="r:gz") as bundle:
        entries = validate_entries(bundle)
        for entry in entries:
            path = destination / entry.name
            path.parent.mkdir(parents=True, exist_ok=True)
            with bundle.extractfile(entry) as content, path.open("xb") as output:
                shutil.copyfileobj(content, output, COPY_BYTES)
            path.chmod(0o644)


def validate_release(path, revision):
    for name in ("index.html", "remote.html", "sw.js", "deployment.json"):
        if not (path / name).is_file() or (path / name).stat().st_size == 0:
            raise ValueError(f"missing required release file: {name}")
    if json.loads((path / "deployment.json").read_text())["commit"] != revision:
        raise ValueError("deployment revision mismatch")
    if not (path / "assets").is_dir() or not any((path / "assets").iterdir()):
        raise ValueError("missing release assets")


def retain_assets(root, release):
    assets = root / "assets"
    assets.mkdir(exist_ok=True)
    sources = sorted((release / "assets").rglob("*"))
    for source in sources:
        if source.is_file():
            target = assets / source.relative_to(release / "assets")
            if target.exists() and digest(target) != digest(source):
                raise ValueError(f"immutable asset collision: {source.name}")
    for source in sources:
        if source.is_file():
            target = assets / source.relative_to(release / "assets")
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                temporary = target.with_name(target.name + ".incoming")
                shutil.copyfile(source, temporary)
                temporary.chmod(0o644)
                temporary.replace(target)


def activate(root, revision, *, expected=None):
    if not re.fullmatch(REVISION, revision):
        raise ValueError("invalid revision")
    target = root / "releases" / revision
    if not target.is_dir():
        raise ValueError("release does not exist")
    current = root / "current"
    previous = current.readlink().name if current.is_symlink() else None
    if expected is not None and previous != expected:
        raise ValueError("active release changed; refusing rollback")
    temporary = root / ".current-next"
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(Path("releases") / revision)
    temporary.replace(current)
    return {"current": revision, "previous": previous}


def receive(root, *, source, revision, checksum, health_check=None):
    if not re.fullmatch(REVISION, revision) or not re.fullmatch(CHECKSUM, checksum):
        raise ValueError("invalid release identity")
    releases = root / "releases"
    releases.mkdir(exist_ok=True)
    with tempfile.TemporaryFile() as archive:
        if spool(source, archive) != checksum:
            raise ValueError("archive checksum mismatch")
        with tempfile.TemporaryDirectory(prefix=".incoming-", dir=root) as temporary:
            staging = Path(temporary) / "release"
            staging.mkdir()
            unpack(archive, staging)
            validate_release(staging, revision)
            target = releases / revision
            if target.exists():
                if (target / ".bundle-sha256").read_text() != checksum:
                    raise ValueError("revision already has a different bundle")
            else:
                retain_assets(root, staging)
                (staging / ".bundle-sha256").write_text(checksum)
                staging.rename(target)
    result = activate(root, revision)
    try:
        if health_check is not None:
            health_check(target, revision)
    except Exception:
        if result["previous"] and result["previous"] != revision:
            activate(root, result["previous"], expected=revision)
        raise
    return result


def handle_command(root, command, source, *, health_check=None):
    release = re.fullmatch(rf"release ({REVISION}) ({CHECKSUM})", command)
    rollback = re.fullmatch(rf"rollback ({REVISION}) ({REVISION})", command)
    if not release and not rollback:
        raise ValueError("only release or compare-and-swap rollback is permitted")
    with (root / ".deploy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if release:
            return receive(root, source=source, revision=release[1], checksum=release[2],
                           health_check=health_check)
        return activate(root, rollback[2], expected=rollback[1])


def interrupted(_signum, _frame):
    raise TimeoutError("release interrupted")


if __name__ == "__main__":
    from oracle_verify import verify
    signal.signal(signal.SIGTERM, interrupted)
    try:
        result = handle_command(Path(sys.argv[1]), os.environ.get("SSH_ORIGINAL_COMMAND", ""),
                                sys.stdin.buffer, health_check=lambda path, revision:
                                verify(sys.argv[2], commit=revision, dist=path))
        print(json.dumps(result))
    except (ValueError, OSError, tarfile.TarError, KeyError) as error:
        print(f"release rejected: {error}", file=sys.stderr)
        sys.exit(1)
