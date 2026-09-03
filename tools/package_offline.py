import os
import shutil
import subprocess
import sys
import argparse
from pathlib import Path


def check_dependencies():
    """验证打包所需的 Python 依赖是否安装"""
    required = ["fastapi", "uvicorn", "websockets", "psutil"]
    missing = []
    for mod in required:
        try:
            __import__(mod)
        except ImportError:
            missing.append(mod)

    if missing:
        print(f"[ERROR] 缺少必要依赖: {', '.join(missing)}")
        print("请运行: pip install " + " ".join(missing))
        sys.exit(1)


def package_app():
    parser = argparse.ArgumentParser(description="Package LogLayer for offline use")
    parser.add_argument(
        "--exe",
        action="store_true",
        help="Bundle backend into a standalone executable using PyInstaller",
    )
    args = parser.parse_args()

    check_dependencies()

    root_dir = Path(__file__).parent.parent
    dist_dir = root_dir / "dist_offline"
    frontend_dir = root_dir / "frontend"
    backend_dir = root_dir / "backend"

    print(f"[1/4] Building Frontend (cwd={root_dir})...")
    try:
        # Check if node_modules exists in ROOT
        if not (root_dir / "node_modules").exists():
            print("Installing dependencies...")
            subprocess.check_call("npm install", shell=True, cwd=root_dir)

        subprocess.check_call("npm run build", shell=True, cwd=root_dir)
    except subprocess.CalledProcessError as e:
        print("Frontend build failed!")
        sys.exit(1)

    print(f"[2/4] Cleaning dist directory: {dist_dir}...")
    if dist_dir.exists():
        shutil.rmtree(dist_dir)
    dist_dir.mkdir(parents=True)

    print("[3/4] Copying Backend and Assets...")
    # Create app directory
    app_dir = dist_dir / "app"
    try:
        shutil.copytree(
            backend_dir,
            app_dir,
            ignore=shutil.ignore_patterns(
                "__pycache__", "*.pyc", "venv", ".env", ".git"
            ),
        )
        # Copy README.md to dist_dir
        if (root_dir / "README.md").exists():
            shutil.copy2(root_dir / "README.md", dist_dir / "README.md")
            print("Copied README.md")
        # Copy requirements.txt to dist_dir
        if (root_dir / "requirements.txt").exists():
            shutil.copy2(root_dir / "requirements.txt", dist_dir / "requirements.txt")
            print("Copied requirements.txt")
    except Exception as e:
        print(f"Failed to copy backend/README: {e}")
        sys.exit(1)

    print("[3.5/4] Copying and Filtering Binary Dependencies...")
    bin_dir = root_dir / "bin"
    target_bin = app_dir / "bin"
    if bin_dir.exists():
        # 拷贝全部支持平台的二进制（windows/ + linux/），单包跨平台可用。
        # 运行时 find_rg_binary() 按当前平台目录选择，缺执行位时自检补齐。
        target_bin.mkdir(parents=True, exist_ok=True)
        shutil.copytree(
            bin_dir,
            target_bin,
            ignore=shutil.ignore_patterns("ripgrep-*", "*.zip", "*.tar.gz"),
            dirs_exist_ok=True,
        )
        print(f"Bundling binaries for all platforms: {', '.join(sorted(p.name for p in bin_dir.iterdir() if p.is_dir()))}")
    else:
        print("Warning: bin directory not found! Global search features will fail.")

    print("[4/4] Copying Frontend Build...")
    frontend_dist = root_dir / "dist"
    target_www = app_dir / "www"

    if not frontend_dist.exists():
        print(f"Error: Frontend dist folder not found at {frontend_dist}!")
        sys.exit(1)

    shutil.copytree(frontend_dist, target_www)

    # PyInstaller Step
    if args.exe:
        print("\n" + "-" * 20)
        print("[EXTRA] Bundling with PyInstaller...")
        print("-" * 20)

        try:
            subprocess.check_call("pyinstaller --version", shell=True)
            add_data_sep = ";" if sys.platform == "win32" else ":"

            pyinst_cmd = [
                "pyinstaller",
                "--noconfirm",
                "--onedir",
                f"--add-data=dist{add_data_sep}www",
                f"--add-data=dist_offline/app/bin{add_data_sep}bin",
                "--paths=backend",
                "--hidden-import=appdirs",
                "--name=LogLayer",
                "--clean",
                "--exclude-module=matplotlib",
                "--exclude-module=tkinter",
                "--exclude-module=PyQt5",
                "--exclude-module=PyQt6",
                "--exclude-module=PySide6",
                "backend/main.py",
            ]

            print(f"Running: {' '.join(pyinst_cmd)}")
            subprocess.check_call(" ".join(pyinst_cmd), shell=True, cwd=root_dir)

            frozen_dist = root_dir / "dist" / "LogLayer"
            frozen_target = dist_dir / "LogLayer_Standalone"
            if frozen_target.exists():
                shutil.rmtree(frozen_target)

            print(f"Moving frozen output to {frozen_target}...")
            shutil.move(str(frozen_dist), str(frozen_target))

            external_plugins = frozen_target / "plugins"
            external_plugins.mkdir(parents=True, exist_ok=True)
            sample_plugins = root_dir / "examples" / "plugins"
            if sample_plugins.exists():
                for sample_file in sample_plugins.iterdir():
                    if sample_file.name == "__pycache__":
                        continue
                    target = external_plugins / sample_file.name
                    if sample_file.is_dir():
                        shutil.copytree(sample_file, target, dirs_exist_ok=True)
                    else:
                        shutil.copy2(sample_file, target)
            readme = external_plugins / "README.txt"
            if not readme.exists():
                readme.write_text(
                    "LogLayer external plugin directory\n"
                    "Place trusted plugins here; they load beside the executable.\n",
                    encoding="utf-8",
                )

        except Exception as e:
            print(f"PyInstaller build failed: {e}")
            sys.exit(1)

    print("\n" + "=" * 40)
    print(f"Done! Offline package created at:\n{dist_dir.absolute()}")
    print("=" * 40)


if __name__ == "__main__":
    package_app()
