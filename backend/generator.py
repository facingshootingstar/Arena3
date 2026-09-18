import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JAVA_ROOT = os.path.join(BASE_DIR, "src", "main", "java", "com", "arena3")
RES_ROOT = os.path.join(BASE_DIR, "src", "main", "resources")

def write_file(subpath, content):
    full_path = os.path.join(BASE_DIR, subpath)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    print("Wrote:", subpath)

print("Generator script initialized.")
