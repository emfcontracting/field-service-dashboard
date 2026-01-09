#!/usr/bin/env python3
"""
Script to copy image files to public directory
Run this with: python copy-images.py
"""

import shutil
import os

# Get the directory where this script is located
script_dir = os.path.dirname(os.path.abspath(__file__))
public_dir = os.path.join(script_dir, 'public')

# Source files (you need to download these first)
files_to_copy = {
    'face.png': 'Path/to/downloaded/face.png',
    'legoman.png': 'Path/to/downloaded/legoman.png',
    'jurassic-park-sound.mp3': 'Path/to/downloaded/jurassic-park-sound.mp3'
}

print("Jurassic Park Error Component - File Copy Script")
print("=" * 50)
print()

# Check if files need to be downloaded
print("⚠️  IMPORTANT: Download the files first!")
print()
print("Download links:")
print("- face.png from Claude")
print("- legoman.png from Claude")  
print("- jurassic-park-sound.mp3 from Claude")
print()

# For now, just show instructions
print("Manual copy instructions:")
print(f"1. Download the 3 files from Claude")
print(f"2. Copy them to: {public_dir}")
print()
print("File paths needed:")
for filename in files_to_copy.keys():
    target_path = os.path.join(public_dir, filename)
    print(f"   - {target_path}")

print()
print("✅ Once copied, the Jurassic Park error will work!")
