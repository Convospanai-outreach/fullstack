"""
Create the public `landing-images` Supabase Storage bucket
==========================================================
apps/api's imageGenerationService.ts uploads AI-generated landing page images
to this bucket and puts its public URL into the page.

1. Creates the bucket as public, or makes an existing one public
2. Uploads a 1x1 test PNG, checks its public URL loads, then deletes it

Safe to run more than once. Uses only the standard library.

Usage (PowerShell):
    $env:SUPABASE_URL = "https://<project-ref>.supabase.co"
    $env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"
    python scripts\\create_landing_images_bucket.py
"""

import base64
import json
import os
import sys
import urllib.error
import urllib.request

BUCKET = "landing-images"
TEST_OBJECT = "_setup-check.png"
TEST_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


def request(method, url, key=None, body=None, content_type="application/json"):
    headers = {}
    if key:
        headers = {"Authorization": f"Bearer {key}", "apikey": key}
    data = None
    if body is not None:
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status, res.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")


def main():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first (see the top of this file).")
    storage = f"{url}/storage/v1"

    status, text = request("GET", f"{storage}/bucket/{BUCKET}", key)
    if status == 200:
        if json.loads(text).get("public"):
            print(f"Bucket '{BUCKET}' already exists and is public.")
        else:
            status, text = request("PUT", f"{storage}/bucket/{BUCKET}", key, {"public": True})
            if status != 200:
                sys.exit(f"Could not make '{BUCKET}' public: {status} {text}")
            print(f"Bucket '{BUCKET}' existed but was private; it is now public.")
    elif "not found" in text.lower():
        status, text = request("POST", f"{storage}/bucket", key, {"id": BUCKET, "name": BUCKET, "public": True})
        if status != 200:
            sys.exit(f"Could not create '{BUCKET}': {status} {text}")
        print(f"Created public bucket '{BUCKET}'.")
    else:
        sys.exit(f"Could not check bucket '{BUCKET}': {status} {text}")

    status, text = request(
        "POST",
        f"{storage}/object/{BUCKET}/{TEST_OBJECT}",
        key,
        TEST_PNG,
        content_type="image/png",
    )
    if status != 200:
        sys.exit(f"Test upload failed: {status} {text}")
    public_url = f"{storage}/object/public/{BUCKET}/{TEST_OBJECT}"
    status, _ = request("GET", public_url)
    request("DELETE", f"{storage}/object/{BUCKET}/{TEST_OBJECT}", key)
    if status != 200:
        sys.exit(f"Test image uploaded but its public URL returned {status}: {public_url}")
    print("Test upload worked and the public URL loads. Landing page images can be stored.")


if __name__ == "__main__":
    main()
