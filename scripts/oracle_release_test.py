"""Exercise the real release filesystem, archive boundary and rollback contract."""

import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

from oracle_release import activate, handle_command, receive
from oracle_bundle import build_bundle

FIRST = "a" * 40
SECOND = "b" * 40


def archive(revision=FIRST, extra=None):
    files = {
        "index.html": b'<script src="/assets/main-123.js"></script>',
        "remote.html": b"remote",
        "sw.js": b"worker",
        "assets/main-123.js": b"old chunk",
        "deployment.json": json.dumps({"commit": revision}).encode(),
    }
    files.update(extra or {})
    result = io.BytesIO()
    with tarfile.open(fileobj=result, mode="w:gz") as bundle:
        for name, contents in files.items():
            entry = tarfile.TarInfo(name)
            entry.size = len(contents)
            bundle.addfile(entry, io.BytesIO(contents))
    return result.getvalue()


class ReleaseTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def upload(self, data, revision=FIRST):
        return receive(self.root, source=io.BytesIO(data), revision=revision,
                       checksum=hashlib.sha256(data).hexdigest())

    def test_release_retains_assets_and_rollback_uses_compare_and_swap(self):
        self.upload(archive())
        result = self.upload(archive(SECOND, {"assets/new-456.js": b"new chunk"}), SECOND)
        self.assertEqual(result, {"current": SECOND, "previous": FIRST})
        self.assertEqual((self.root / "assets/main-123.js").read_bytes(), b"old chunk")
        activate(self.root, FIRST, expected=SECOND)
        self.assertEqual((self.root / "current/deployment.json").read_text(),
                         json.dumps({"commit": FIRST}))
        self.assertEqual((self.root / "assets/new-456.js").read_bytes(), b"new chunk")
        with self.assertRaisesRegex(ValueError, "changed"):
            activate(self.root, SECOND, expected=SECOND)

    def test_repeated_identical_upload_is_safe(self):
        data = archive()
        self.upload(data)
        self.assertEqual(self.upload(data)["current"], FIRST)

    def test_receiver_health_failure_restores_previous_before_acknowledgement(self):
        self.upload(archive())
        data = archive(SECOND, {"assets/new.js": b"new"})
        def reject(_path, _revision):
            raise TimeoutError("health failed")
        with self.assertRaisesRegex(TimeoutError, "health failed"):
            receive(self.root, source=io.BytesIO(data), revision=SECOND,
                    checksum=hashlib.sha256(data).hexdigest(), health_check=reject)
        self.assertEqual((self.root / "current").readlink().name, FIRST)
        self.assertTrue((self.root / "assets/new.js").is_file())

    def test_checksum_failure_preserves_active_release(self):
        self.upload(archive())
        with self.assertRaisesRegex(ValueError, "checksum"):
            receive(self.root, source=io.BytesIO(archive(SECOND)), revision=SECOND,
                    checksum="0" * 64)
        self.assertEqual((self.root / "current").readlink().name, FIRST)

    def test_malicious_paths_and_links_are_rejected_before_activation(self):
        for name in ("../escaped", "/absolute", "assets/../../escape", "a\\b", "a//b"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.upload(archive(extra={name: b"bad"}))
        data = io.BytesIO()
        with tarfile.open(fileobj=data, mode="w:gz") as bundle:
            link = tarfile.TarInfo("assets/link")
            link.type = tarfile.SYMTYPE
            link.linkname = "/etc/passwd"
            bundle.addfile(link)
        with self.assertRaisesRegex(ValueError, "regular"):
            self.upload(data.getvalue())
        self.assertFalse((self.root / "current").exists())

    def test_duplicate_paths_are_rejected(self):
        data = io.BytesIO()
        with tarfile.open(fileobj=data, mode="w:gz") as bundle:
            for _ in range(2):
                entry = tarfile.TarInfo("index.html")
                bundle.addfile(entry, io.BytesIO())
        with self.assertRaisesRegex(ValueError, "duplicate"):
            self.upload(data.getvalue())

    def test_size_limits_cover_compressed_and_expanded_input(self):
        with patch("oracle_release.MAX_ARCHIVE_BYTES", 10):
            with self.assertRaisesRegex(ValueError, "large"):
                self.upload(archive())
        with patch("oracle_release.MAX_EXPANDED_BYTES", 10):
            with self.assertRaisesRegex(ValueError, "large"):
                self.upload(archive())

    def test_revision_mismatch_and_incomplete_release_never_activate(self):
        for extra in ({"deployment.json": b'{"commit":"wrong"}'}, {"index.html": b""}):
            with self.subTest(extra=extra), self.assertRaises(ValueError):
                self.upload(archive(extra=extra))
        self.assertFalse((self.root / "current").exists())

    def test_immutable_asset_collision_preserves_current(self):
        self.upload(archive())
        with self.assertRaisesRegex(ValueError, "immutable"):
            self.upload(archive(SECOND, {"assets/main-123.js": b"changed"}), SECOND)
        self.assertEqual((self.root / "current").readlink().name, FIRST)

    def test_same_revision_different_bundle_is_rejected(self):
        self.upload(archive())
        with self.assertRaisesRegex(ValueError, "different bundle"):
            self.upload(archive(extra={"sw.js": b"different"}))

    def test_forced_command_accepts_only_release_and_cas_rollback(self):
        for command in ("bash", "release ../x y", "rollback a b", "release " + FIRST + " " + "0" * 64 + ";id"):
            with self.subTest(command=command), self.assertRaises(ValueError):
                handle_command(self.root, command, io.BytesIO())
        self.upload(archive())
        self.upload(archive(SECOND), SECOND)
        result = handle_command(self.root, f"rollback {SECOND} {FIRST}", io.BytesIO())
        self.assertEqual(result["current"], FIRST)

    def test_in_progress_release_is_not_overwritten(self):
        import fcntl
        with (self.root / ".deploy.lock").open("w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaises(BlockingIOError):
                handle_command(self.root, f"rollback {SECOND} {FIRST}", io.BytesIO())

    def test_bundle_is_reproducible_and_can_be_received(self):
        import os
        dist = self.root / "dist"
        dist.mkdir()
        for name, data in (("remote.html", b"remote"), ("sw.js", b"worker"),
                           ("assets/main.js", b"chunk")):
            path = dist / name
            path.parent.mkdir(exist_ok=True)
            path.write_bytes(data)
        first, second = self.root / "first.tgz", self.root / "second.tgz"
        checksum = build_bundle(dist, commit=FIRST, output=first)
        for path in dist.rglob("*"):
            os.utime(path, (123456, 123456))
        self.assertEqual(build_bundle(dist, commit=FIRST, output=second), checksum)
        self.upload(first.read_bytes())
        self.assertEqual((self.root / "current/index.html").read_bytes(), b"remote")


if __name__ == "__main__":
    unittest.main()
