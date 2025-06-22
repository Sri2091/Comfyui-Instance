#!/usr/bin/env python3
"""
ComfyUI Model Downloader Script
Downloads all required models for ComfyUI with parallel processing (INFO logging only)
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
    log_dir = Path("/workspace/logs"); log_dir.mkdir(exist_ok=True)
    log_file = log_dir.joinpath("comfyui_model_downloads.log")
    formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s", "%Y-%m-%d %H:%M:%S")
    logger = logging.getLogger(); logger.setLevel(logging.INFO)
    file_handler = logging.FileHandler(log_file, encoding="utf-8"); file_handler.setFormatter(formatter); logger.addHandler(file_handler)
    console_handler = logging.StreamHandler(sys.stdout); console_handler.setFormatter(formatter); logger.addHandler(console_handler)
    return logger, log_file

def create_directory(path): Path(path).mkdir(parents=True, exist_ok=True)

def file_exists(directory, filename):
    return Path(directory).joinpath(filename).exists()

def download_with_aria2c(directory, filename, url):
    if file_exists(directory, filename):
        logging.info(f"Skipping {filename}, already exists.")
        return True
    create_directory(directory)
    hf_token = os.environ.get("HF_TOKEN", "")
    cmd = ["aria2c", "-c", "-x", "16", "-s", "16", "--header", f"Authorization: Bearer {hf_token}", "-d", directory, "-o", filename, url]
    start_time = time.time()
    logging.info(f"Downloading {filename}")
    try:
        process = subprocess.run(cmd, capture_output=True, text=True)
        elapsed = time.time() - start_time
        if process.returncode == 0:
            size = get_file_size(os.path.join(directory, filename))
            logging.info(f"✓ {filename} ({size}) in {elapsed:.1f}s")
            return True
        else:
            logging.error(f"✗ Failed {filename}: {process.stderr}")
            return False
    except Exception as e:
        logging.error(f"✗ Exception downloading {filename}: {str(e)}")
        return False

def get_file_size(filepath):
    if not os.path.exists(filepath): return "N/A"
    size = os.path.getsize(filepath)
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024.0: return f"{size:.1f}{unit}"
        size /= 1024.0
    return f"{size:.1f}TB"

def download_with_curl(directory, filename, url):
    if file_exists(directory, filename):
        logging.info(f"Skipping {filename}, already exists.")
        return True
    create_directory(directory)
    civitai_token = os.environ.get("CIVITAI_TOKEN", "")
    filepath = os.path.join(directory, filename)
    cmd = ["curl", "-L", "-H", f"Authorization: Bearer {civitai_token}", "-o", filepath, url]
    start_time = time.time()
    logging.info(f"Downloading {filename} (CivitAI)")
    try:
        process = subprocess.run(cmd, capture_output=True, text=True)
        elapsed = time.time() - start_time
        if process.returncode == 0:
            size = get_file_size(filepath)
            logging.info(f"✓ {filename} ({size}) in {elapsed:.1f}s")
            return True
        else:
            logging.error(f"✗ Failed {filename}: {process.stderr}")
            return False
    except Exception as e:
        logging.error(f"✗ Exception downloading {filename}: {str(e)}")
        return False

def clone_git_repo(directory, repo_url, rename_to=None):
    create_directory(directory)
    start_time = time.time()
    logging.info(f"Cloning {repo_url}")
    try:
        original_dir = os.getcwd(); os.chdir(directory)
        process = subprocess.run(["git", "clone", repo_url], capture_output=True, text=True)
        elapsed = time.time() - start_time
        if process.returncode == 0:
            logging.info(f"✓ Cloned {repo_url} in {elapsed:.1f}s")
            if rename_to:
                repo_name = repo_url.split("/")[-1]
                if os.path.exists(repo_name) and not os.path.exists(rename_to): os.rename(repo_name, rename_to)
        else:
            logging.error(f"✗ Failed clone {repo_url}: {process.stderr}")
            return False
        os.chdir(original_dir)
        return True
    except Exception as e:
        logging.error(f"✗ Exception cloning {repo_url}: {str(e)}")
        os.chdir(original_dir)
        return False

def main():
    logger, log_file = setup_logging()
    logging.info("ComfyUI Downloader Started")
    if not os.environ.get("HF_TOKEN"): logging.warning("HF_TOKEN not set")
    if not os.environ.get("CIVITAI_TOKEN"): logging.warning("CIVITAI_TOKEN not set")

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [(executor.submit(download_with_aria2c, d, f, u), f) for d, f, u in downloads]
        futures.append((executor.submit(download_with_curl, civitai_download["dir"], civitai_download["file"], civitai_download["url"]), civitai_download["file"]))
        results = [(f.result(), name) for f, name in futures]

    success = [name for ok, name in results if ok]
    failed = [name for ok, name in results if not ok]

    logging.info(f"Total Downloads: {len(results)}")
    logging.info(f"Successful: {len(success)}")
    logging.info(f"Failed: {len(failed)}")
    if failed: logging.warning("Failed files: " + ", ".join(failed))

    for group in git_repos:
        for url, rename in group["repos"]:
            clone_git_repo(group["dir"], url, rename)

if __name__ == "__main__":
    main()
