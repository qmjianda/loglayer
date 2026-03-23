#!/usr/bin/env python3
"""
LogLayer Release Builder
=========================

Standard release package builder for LogLayer desktop application.

Features:
- Version management (from pyproject.toml or git tag)
- Frontend + Backend build
- Multiple output formats (tar.gz, zip)
- Platform-specific binaries
- Checksums (SHA256)
- Optional standalone executable (PyInstaller)

Usage:
    python tools/package.py                      # Build release package
    python tools/package.py --exe                # Include standalone exe
    python tools/package.py --format zip         # ZIP format only
    python tools/package.py --output releases/   # Custom output dir
    python tools/package.py --version 1.0.0      # Explicit version
"""

import hashlib
import os
import re
import shutil
import subprocess
import sys
import argparse
import platform
from datetime import datetime
from pathlib import Path


class ReleaseBuilder:
    def __init__(self, root_dir: Path):
        self.root = root_dir
        self.version = self._get_version()
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.build_dir = root_dir / "build"
        self.dist_dir = root_dir / "releases"

    def _get_version(self) -> str:
        pyproject = self.root / "pyproject.toml"
        if pyproject.exists():
            content = pyproject.read_text()
            match = re.search(r'version\s*=\s*"([^"]+)"', content)
            if match:
                return match.group(1)

        try:
            result = subprocess.run(
                ["git", "describe", "--tags", "--always"],
                cwd=self.root,
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode == 0:
                return result.stdout.strip().lstrip("v")
        except Exception:
            pass

        return "0.0.0"

    def _run(self, cmd: list[str], cwd: Path | None = None, check: bool = True):
        print(f"  $ {' '.join(cmd)}")
        result = subprocess.run(cmd, cwd=cwd or self.root, capture_output=True, text=True)
        if check and result.returncode != 0:
            print(f"  ERROR: {result.stderr}")
            sys.exit(1)
        return result

    def clean(self):
        print("\n[1/6] Cleaning previous builds...")
        for d in [self.build_dir, self.dist_dir]:
            if d.exists():
                shutil.rmtree(d)
        self.dist_dir.mkdir(parents=True, exist_ok=True)

    def build_frontend(self):
        print("\n[2/6] Building Frontend...")

        if not (self.root / "node_modules").exists():
            self._run(["npm", "install"])

        self._run(["npm", "run", "build"])

        frontend_dist = self.root / "dist"
        if not frontend_dist.exists():
            print("  ERROR: Frontend dist not found!")
            sys.exit(1)

    def prepare_backend(self):
        print("\n[3/6] Preparing Backend...")

        app_dir = self.build_dir / "app"
        app_dir.mkdir(parents=True, exist_ok=True)

        backend_dir = self.root / "backend"
        shutil.copytree(
            backend_dir,
            app_dir / "backend",
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "venv", ".env", ".git"),
        )

        if (self.root / "README.md").exists():
            shutil.copy2(self.root / "README.md", app_dir / "README.md")

        if (self.root / "pyproject.toml").exists():
            shutil.copy2(self.root / "pyproject.toml", app_dir / "pyproject.toml")

        bin_dir = self.root / "bin"
        target_bin = app_dir / "backend" / "bin"
        if bin_dir.exists():
            target_bin.mkdir(parents=True, exist_ok=True)
            current = "windows" if platform.system() == "Windows" else "linux"
            src = bin_dir / current
            if src.exists():
                shutil.copytree(src, target_bin / current, dirs_exist_ok=True)

        www_dir = self.root / "dist"
        target_www = app_dir / "www"
        shutil.copytree(www_dir, target_www)

        return app_dir

    def create_launchers(self, app_dir: Path):
        print("\n[4/6] Creating Launchers...")

        bat = """@echo off
cd /d "%~dp0"
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python 3.10+ required
    pause
    exit /b 1
)
python app\\backend\\main.py %*
"""
        (self.dist_dir / "LogLayer.bat").write_text(bat, encoding="utf-8")

        sh = """#!/bin/bash
cd "$(dirname "$0")"
find app -name "rg" -exec chmod +x {} \\; 2>/dev/null
python3 app/backend/main.py "$@"
"""
        sh_path = self.dist_dir / "LogLayer.sh"
        sh_path.write_text(sh, encoding="utf-8", newline="\n")
        os.chmod(sh_path, os.stat(sh_path).st_mode | 0o111)

    def build_executable(self, app_dir: Path):
        print("\n[5/6] Building Standalone Executable...")

        try:
            self._run(["pyinstaller", "--version"], check=True)
        except Exception:
            print("  WARNING: PyInstaller not installed, skipping exe build")
            return

        add_data_sep = ";" if sys.platform == "win32" else ":"

        cmd = [
            "pyinstaller",
            "--noconfirm",
            "--onedir",
            "--windowed",
            f"--add-data=app{add_data_sep}app",
            f"--add-data=app/backend/bin{add_data_sep}bin",
            "--paths=backend",
            "--name=LogLayer",
            "--clean",
            "--exclude-module=matplotlib",
            "--exclude-module=pytest",
            "backend/main.py",
        ]

        self._run(cmd)

        src = self.root / "dist" / "LogLayer"
        dst = self.dist_dir / f"LogLayer-{self.version}-{platform.system()}-Standalone"
        if src.exists():
            shutil.move(str(src), str(dst))

            if platform.system() != "Windows":
                exe = dst / "LogLayer"
                if exe.exists():
                    os.chmod(exe, os.stat(exe).st_mode | 0o111)

    def create_archives(self, app_dir: Path):
        print("\n[6/6] Creating Release Archives...")

        base_name = f"LogLayer-{self.version}-{platform.system()}-x64"

        shutil.make_archive(
            str(self.dist_dir / base_name), "gzip", root_dir=self.dist_dir, base_dir="app"
        )

        shutil.make_archive(
            str(self.dist_dir / base_name), "zip", root_dir=self.dist_dir, base_dir="app"
        )

        self._generate_checksums()

    def _generate_checksums(self):
        print("\n  Generating checksums...")
        checksums = []

        for f in self.dist_dir.iterdir():
            if f.is_file() and f.suffix in [".tar", ".zip"]:
                sha256 = hashlib.sha256()
                with open(f, "rb") as fp:
                    for chunk in iter(lambda: fp.read(8192), b""):
                        sha256.update(chunk)

                checksums.append(f"{sha256.hexdigest()}  {f.name}")
                print(f"    {f.name}: {sha256.hexdigest()[:16]}...")

        (self.dist_dir / "SHA256SUMS.txt").write_text("\n".join(checksums))

    def build(self, create_exe: bool = False):
        print("=" * 50)
        print(f"LogLayer Release Builder v{self.version}")
        print("=" * 50)
        print(f"Platform: {platform.system()}")
        print(f"Timestamp: {self.timestamp}")

        self.clean()
        self.build_frontend()
        app_dir = self.prepare_backend()
        self.create_launchers(app_dir)

        if create_exe:
            self.build_executable(app_dir)

        self.create_archives(app_dir)

        print("\n" + "=" * 50)
        print("Release Build Complete!")
        print("=" * 50)
        print(f"\nOutput directory: {self.dist_dir}")
        print("\nGenerated files:")
        for f in sorted(self.dist_dir.iterdir()):
            size = f.stat().st_size / (1024 * 1024)
            print(f"  {f.name} ({size:.1f} MB)")


def main():
    parser = argparse.ArgumentParser(description="LogLayer Release Builder")
    parser.add_argument("--exe", action="store_true", help="Build standalone executable")
    parser.add_argument("--format", choices=["all", "zip", "tar.gz"], default="all")
    parser.add_argument("--output", type=Path, default=Path("releases"), help="Output directory")
    parser.add_argument("--version", help="Override version")

    args = parser.parse_args()

    builder = ReleaseBuilder(Path(__file__).parent.parent)

    if args.version:
        builder.version = args.version

    builder.build(create_exe=args.exe)


if __name__ == "__main__":
    main()
