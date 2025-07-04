#!/usr/bin/env python3
"""
ComfyUI Model Downloader Script
Downloads all required models for ComfyUI with parallel processing
"""

import os
import subprocess
import concurrent.futures
from pathlib import Path
import time
import logging
from datetime import datetime
import sys

# Define all downloads as tuples: (directory, filename, url)
downloads = [
    # UNETS
    (
        "/workspace/ComfyUI/models/unet",
        "flux1-dev.safetensors",
        "https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/flux1-dev.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/unet",
        "flux1-fill-dev.safetensors",
        "https://huggingface.co/Sri2901/Flux_Models/resolve/main/flux1-fill-dev.safetensors?download=true",
    ),

    # DIffusion models
    (
        "/workspace/ComfyUI/models/diffusion_models",
        "model.safetensors",
        "https://huggingface.co/jasperai/LBM_relighting/resolve/main/model.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/diffusion_models",
        "flux1-kontext-dev.safetensors",
        "https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev/resolve/main/flux1-kontext-dev.safetensors?download=true",
    ),
   
    # UPSCALE MODELS
    (
        "/workspace/ComfyUI/models/upscale_models",
        "4xNomos8kSC.pth",
        "https://huggingface.co/RippleLinks/Flux_Models/resolve/main/4xNomos8kSC.pth",
    ),
    (
        "/workspace/ComfyUI/models/upscale_models",
        "1xDeH264_realplksr.pth",
        "https://huggingface.co/RippleLinks/Flux_Models/resolve/main/1xDeH264_realplksr.pth?download=true",
    ),
    (
        "/workspace/ComfyUI/models/upscale_models",
        "4xFaceUpDAT.pth",
        "https://huggingface.co/Sri2901/Flux_Models/resolve/main/4xFaceUpDAT.pth?download=true",
    ),
    (
        "/workspace/ComfyUI/models/upscale_models",
        "4x_NMKD-Siax_200k.pth",
        "https://huggingface.co/Sri2901/Flux_Models/resolve/main/4x_NMKD-Siax_200k.pth?download=true",
    ),
    (
        "/workspace/ComfyUI/models/upscale_models",
        "4x-ClearRealityV1.pth",
        "https://huggingface.co/Sri2901/Flux_Models/resolve/main/4x-ClearRealityV1.pth?download=true",
    ),
    (
        "/workspace/ComfyUI/models/upscale_models",
        "1xDeJPG_realplksr_otf.pth",
        "https://huggingface.co/Sri2901/Flux_Models/resolve/main/1xDeJPG_realplksr_otf.pth?download=true",
    ),
    # VAE
    (
        "/workspace/ComfyUI/models/vae",
        "ae.safetensors",
        "https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/ae.safetensors?download=true",
    ),
    # CLIP
    (
        "/workspace/ComfyUI/models/clip",
        "t5xxl_fp8_e4m3fn.safetensors",
        "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/clip",
        "ViT-L-14-TEXT-detail-improved-hiT-GmP-TE-only-HF.safetensors",
        "https://huggingface.co/Sri2901/Flux_Models/resolve/main/ViT-L-14-TEXT-detail-improved-hiT-GmP-TE-only-HF.safetensors?download=true",
    ),
    # CLIP VISION
    (
        "/workspace/ComfyUI/models/clip_vision",
        "sigclip_vision_patch14_384.safetensors",
        "https://huggingface.co/Sri2901/Flux_Models/resolve/main/sigclip_vision_patch14_384.safetensors?download=true",
    ),
    # LORAS
    (
        "/workspace/ComfyUI/models/loras",
        "amateurphoto-v6-forcu.safetensors",
        "https://huggingface.co/Sri2901/Flux_Models/resolve/main/amateurphoto-v6-forcu.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/loras",
        "flux1-canny-dev-lora.safetensors",
        "https://huggingface.co/Sri2901/Flux_Models/resolve/main/flux1-canny-dev-lora.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/loras",
        "flux1-depth-dev-lora.safetensors",
        "https://huggingface.co/Sri2901/Flux_Models/resolve/main/flux1-depth-dev-lora.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/loras",
        "skin_texture_style_v5.safetensors",
        "https://huggingface.co/Sri2901/Flux_Models/resolve/main/skin_texture_style_v5.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/loras",
        "MidJourneyXFlux.safetensors",
        "https://huggingface.co/RippleLinks/Flux_Models/resolve/main/Lora/MidJourneyXFlux.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/loras",
        "mjV6.safetensors",
        "https://huggingface.co/Sri2901/Flux_Models/resolve/main/Strangerzone/mjV6.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/loras",
        "boreal-v2.safetensors",
        "https://huggingface.co/RippleLinks/Flux_Models/resolve/main/Lora/boreal-v2.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/loras",
        "cinematic-shot.safetensors",
        "https://huggingface.co/RippleLinks/Flux_Models/resolve/main/Lora/cinematic-shot.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/loras",
        "catalouge_1_v2_shift.safetensors",
        "https://huggingface.co/Sri2901/catalouge_1_v2_shift/resolve/main/catalouge_1_v2_shift.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/loras",
        "comsos_4_v2_shift_0.2Lr.safetensors",
        "https://huggingface.co/Sri2901/comsos_4_v2_shift_0.2Lr/resolve/main/comsos_4_v2_shift_0.2Lr.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/loras",
        "01_pedo_v1.safetensors",
        "https://huggingface.co/Sri2901/01_pedo_v1/resolve/main/01_pedo_v1.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/loras",
        "lehenga-generator.safetensors",
        "https://huggingface.co/tryonlabs/FLUX.1-dev-LoRA-Lehenga-Generator/resolve/main/lehenga-generator.safetensors?download=true",
    ),  
    (
        "/workspace/ComfyUI/models/loras",
        "04_cosmos_v3.safetensors",
        "https://huggingface.co/Sri2901/04_cosmos_v3/resolve/main/04_cosmos_v3.safetensors?download=true",
    ),  
    (
        "/workspace/ComfyUI/models/loras",
        "04_cosmos_v3_shift.safetensors",
        "https://huggingface.co/Sri2901/04_cosmos_v3_Shift/resolve/main/04_cosmos_v3_shift.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/loras",
        "cosmos_v2_000004500.safetensors",
        "https://huggingface.co/Sri2901/cosmos_4_v2/resolve/main/cosmos_v2_000004500.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/loras",
        "01_pedo_v1_shift.safetensors",
        "https://huggingface.co/Sri2901/01_pedo_v1_shift/resolve/main/01_pedo_v1_shift.safetensors?download=true",
    ),
    (
        "/workspace/ComfyUI/models/loras",
        "indian_kids_shift.safetensors",
        "https://huggingface.co/Sri2901/Indian_Kids_Shift/resolve/main/indian_kids_shift.safetensors?download=true",
    ),

    # STYLE MODELS
    (
        "/workspace/ComfyUI/models/style_models",
        "flux1-redux-dev.safetensors",
        "https://huggingface.co/Sri2901/Flux_Models/resolve/main/flux1-redux-dev.safetensors?download=true",
    ),
    # PULID MODEL
    (
        "/workspace/ComfyUI/models/pulid",
        "pulid_flux_v0.9.0.safetensors",
        "https://huggingface.co/guozinan/PuLID/resolve/main/pulid_flux_v0.9.0.safetensors?download=true",
    ),

    # Miscellaneous
    (
        "/workspace/ComfyUI/models/BEN",
        "BEN2_Base.pth",
        "https://huggingface.co/chflame163/ComfyUI_LayerStyle/resolve/main/ComfyUI/models/BEN/BEN2_Base.pth?download=true",
    ),
]

# Special download for CivitAI (uses curl instead of aria2c)
civitai_download = {
    "dir": "/workspace/ComfyUI/models/loras",
    "file": "flux-lora-product-light.safetensors",
    "url": "https://civitai.com/api/download/models/790057?type=Model&format=SafeTensor",
}

# Git repositories to clone
git_repos = [
    {
        "dir": "/workspace/ComfyUI/models/",
        "repos": [
            ("https://huggingface.co/mattmdjaga/segformer_b2_clothes", None),
            ("https://huggingface.co/sayeed99/segformer_b3_clothes", None),
            (
                "https://huggingface.co/sayeed99/segformer-b3-fashion",
                "segformer_b3_fashion",
            ),
        ],
    },
    {
        "dir": "/workspace/ComfyUI/models/insightface/models/",
        "repos": [
            ("https://huggingface.co/MonsterMMORPG/tools", "antelopev2"),
        ],
    },
]


def setup_logging():
    """Setup logging to both file and console"""
    # Create logs directory
    log_dir = Path("/workspace/logs")
    log_dir.mkdir(exist_ok=True)

    # Create log filename with timestamp
    log_file = log_dir.joinpath("comfyui_model_downloads.log")

    # Create formatters
    file_formatter = logging.Formatter(
        "%(asctime)s - %(levelname)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
    )
    console_formatter = logging.Formatter("%(levelname)s: %(message)s")

    # Setup root logger
    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG)

    # File handler (detailed logs)
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)

    # Console handler (less verbose)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    return logger, log_file


def create_directory(path):
    """Create directory if it doesn't exist"""
    Path(path).mkdir(parents=True, exist_ok=True)


def download_with_aria2c(directory, filename, url):
    """Download a file using aria2c"""
    create_directory(directory)

    # Get HF_TOKEN from environment
    hf_token = os.environ.get("HF_TOKEN", "")

    cmd = [
        "aria2c",
        "-c",
        "-x",
        "16",
        "-s",
        "16",
        "--header",
        f"Authorization: Bearer {hf_token}",
        "-d",
        directory,
        "-o",
        filename,
        url,
    ]

    start_time = time.time()
    logging.info(f"Starting download: {filename}")
    logging.debug(f"Download URL: {url}")
    logging.debug(f"Target directory: {directory}")

    try:
        # Run aria2c and capture output
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            universal_newlines=True,
        )

        # Log output in real-time
        while True:
            output = process.stdout.readline()
            if output == "" and process.poll() is not None:
                break
            if output:
                logging.debug(f"aria2c [{filename}]: {output.strip()}")

        # Get final return code
        rc = process.poll()
        stderr = process.stderr.read()

        elapsed_time = time.time() - start_time

        if rc == 0:
            size = get_file_size(os.path.join(directory, filename))
            logging.info(
                f"✓ Successfully downloaded {filename} ({size}) in {elapsed_time:.1f}s"
            )
            logging.debug(f"Download completed: {filename}")
        else:
            logging.error(f"✗ Failed to download {filename} after {elapsed_time:.1f}s")
            if stderr:
                logging.error(f"Error details: {stderr}")

        return rc == 0
    except Exception as e:
        elapsed_time = time.time() - start_time
        logging.error(
            f"✗ Exception downloading {filename} after {elapsed_time:.1f}s: {str(e)}"
        )
        return False


def get_file_size(filepath):
    """Get human-readable file size"""
    if not os.path.exists(filepath):
        return "N/A"

    size = os.path.getsize(filepath)
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024.0:
            return f"{size:.1f}{unit}"
        size /= 1024.0
    return f"{size:.1f}TB"


def download_with_curl(directory, filename, url):
    """Download a file using curl (for CivitAI)"""
    create_directory(directory)

    # Get CIVITAI_TOKEN from environment
    civitai_token = os.environ.get("CIVITAI_TOKEN", "")

    filepath = os.path.join(directory, filename)
    cmd = [
        "curl",
        "-L",
        "-H",
        f"Authorization: Bearer {civitai_token}",
        "-o",
        filepath,
        url,
    ]

    start_time = time.time()
    logging.info(f"Starting download: {filename} (using curl)")
    logging.debug(f"Download URL: {url}")
    logging.debug(f"Target path: {filepath}")

    try:
        process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )

        stdout, stderr = process.communicate()
        elapsed_time = time.time() - start_time

        if process.returncode == 0:
            size = get_file_size(filepath)
            logging.info(
                f"✓ Successfully downloaded {filename} ({size}) in {elapsed_time:.1f}s"
            )
        else:
            logging.error(f"✗ Failed to download {filename} after {elapsed_time:.1f}s")
            if stderr:
                logging.error(f"Error details: {stderr}")

        return process.returncode == 0
    except Exception as e:
        elapsed_time = time.time() - start_time
        logging.error(
            f"✗ Exception downloading {filename} after {elapsed_time:.1f}s: {str(e)}"
        )
        return False


def clone_git_repo(directory, repo_url, rename_to=None):
    """Clone a git repository"""
    create_directory(directory)

    start_time = time.time()
    logging.info(f"Cloning repository: {repo_url}")
    logging.debug(f"Target directory: {directory}")

    try:
        # Change to target directory
        original_dir = os.getcwd()
        os.chdir(directory)

        # Clone the repository
        process = subprocess.Popen(
            ["git", "clone", repo_url],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        stdout, stderr = process.communicate()
        elapsed_time = time.time() - start_time

        if process.returncode == 0:
            logging.info(f"✓ Successfully cloned {repo_url} in {elapsed_time:.1f}s")

            # Rename if needed
            if rename_to:
                repo_name = repo_url.split("/")[-1]
                if os.path.exists(repo_name) and not os.path.exists(rename_to):
                    os.rename(repo_name, rename_to)
                    logging.info(f"✓ Renamed {repo_name} to {rename_to}")
        else:
            logging.error(f"✗ Failed to clone {repo_url} after {elapsed_time:.1f}s")
            if stderr:
                logging.error(f"Error details: {stderr}")

        os.chdir(original_dir)
        return process.returncode == 0
    except Exception as e:
        elapsed_time = time.time() - start_time
        logging.error(
            f"✗ Exception cloning {repo_url} after {elapsed_time:.1f}s: {str(e)}"
        )
        os.chdir(original_dir)
        return False


def main():
    """Main function to orchestrate all downloads"""
    # Setup logging
    logger, log_file = setup_logging()

    logging.info("=" * 70)
    logging.info("ComfyUI Model Downloader Started")
    logging.info(f"Log file: {log_file}")
    logging.info("=" * 70)

    # Check for required environment variables
    if not os.environ.get("HF_TOKEN"):
        logging.warning("HF_TOKEN not set in environment")
    else:
        logging.info("HF_TOKEN found in environment")

    if not os.environ.get("CIVITAI_TOKEN"):
        logging.warning("CIVITAI_TOKEN not set in environment")
    else:
        logging.info("CIVITAI_TOKEN found in environment")

    logging.info(f"Total downloads: {len(downloads) + 1}")  # +1 for CivitAI
    logging.info(f"Parallel downloads: 3")
    logging.info("=" * 70)

    overall_start_time = time.time()
    successful = 0
    failed = 0
    failed_files = []

    # Use ThreadPoolExecutor for parallel downloads
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        # Submit all aria2c downloads
        futures = []
        for directory, filename, url in downloads:
            future = executor.submit(download_with_aria2c, directory, filename, url)
            futures.append((future, filename, "aria2c"))

        # Submit CivitAI download
        civitai_future = executor.submit(
            download_with_curl,
            civitai_download["dir"],
            civitai_download["file"],
            civitai_download["url"],
        )
        futures.append((civitai_future, civitai_download["file"], "curl"))

        # Wait for all downloads to complete
        for future, filename, method in futures:
            if future.result():
                successful += 1
            else:
                failed += 1
                failed_files.append(f"{filename} ({method})")

    download_time = time.time() - overall_start_time

    logging.info("\n" + "=" * 70)
    logging.info("Download Summary:")
    logging.info(f"✓ Successful: {successful}")
    logging.info(f"✗ Failed: {failed}")
    logging.info(f"Total download time: {download_time:.1f}s")

    if failed_files:
        logging.warning("Failed downloads:")
        for f in failed_files:
            logging.warning(f"  - {f}")

    logging.info("=" * 70)

    # Clone git repositories
    logging.info("\nCloning Git Repositories")
    logging.info("=" * 70)

    git_start_time = time.time()
    git_successful = 0
    git_failed = 0
    failed_repos = []

    for repo_group in git_repos:
        directory = repo_group["dir"]
        for repo_url, rename_to in repo_group["repos"]:
            if clone_git_repo(directory, repo_url, rename_to):
                git_successful += 1
            else:
                git_failed += 1
                failed_repos.append(repo_url)

    git_time = time.time() - git_start_time

    logging.info("\n" + "=" * 70)
    logging.info("Git Clone Summary:")
    logging.info(f"✓ Successful: {git_successful}")
    logging.info(f"✗ Failed: {git_failed}")
    logging.info(f"Total git clone time: {git_time:.1f}s")

    if failed_repos:
        logging.warning("Failed repositories:")
        for r in failed_repos:
            logging.warning(f"  - {r}")

    logging.info("=" * 70)

    total_time = time.time() - overall_start_time
    logging.info(f"\nAll operations completed in {total_time:.1f}s!")
    logging.info(f"Check the log file for detailed information: {log_file}")

    # Create a summary file
    summary_file = (
        Path("./logs") / f"summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    )
    with open(summary_file, "w") as f:
        f.write("ComfyUI Model Download Summary\n")
        f.write("=" * 50 + "\n")
        f.write(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Total time: {total_time:.1f}s\n\n")
        f.write(f"Downloads:\n")
        f.write(f"  Successful: {successful}\n")
        f.write(f"  Failed: {failed}\n")
        if failed_files:
            f.write(f"  Failed files:\n")
            for file in failed_files:
                f.write(f"    - {file}\n")
        f.write(f"\nGit Clones:\n")
        f.write(f"  Successful: {git_successful}\n")
        f.write(f"  Failed: {git_failed}\n")
        if failed_repos:
            f.write(f"  Failed repos:\n")
            for repo in failed_repos:
                f.write(f"    - {repo}\n")

    logging.info(f"Summary saved to: {summary_file}")


if __name__ == "__main__":
    main()
