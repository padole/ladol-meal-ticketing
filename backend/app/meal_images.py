"""Meal photos: stored as files in UPLOAD_FOLDER/meals, the meal row only keeps the file name."""
import os
import uuid

from flask import abort, current_app

# ---- File type check ----
# checked against the file's first bytes, not its name, so a renamed .exe can't be uploaded as a "photo"
SIGNATURES = {b"\xff\xd8\xff": "jpg", b"\x89PNG\r\n\x1a\n": "png"}


# Folder the photos live in (created on first use)
def folder():
    path = os.path.join(current_app.config["UPLOAD_FOLDER"], "meals")
    os.makedirs(path, exist_ok=True)
    return path


# "jpg" / "png" / "webp" from the file's first bytes, or None
def image_type(head):
    for sig, ext in SIGNATURES.items():
        if head.startswith(sig):
            return ext
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


# ---- Save / delete ----
def save(file_storage):
    """Validate and store an uploaded image; returns the new file name."""
    if not file_storage or not file_storage.filename:
        abort(400, "Choose an image file")
    data = file_storage.read()
    if not data:
        abort(400, "The file is empty")
    ext = image_type(data[:12])
    if not ext:
        abort(400, "Only JPG, PNG or WebP images can be uploaded")
    name = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(folder(), name), "wb") as f:
        f.write(data)
    return name


def delete(name):
    if not name:
        return
    path = os.path.join(folder(), os.path.basename(name))
    if os.path.isfile(path):
        os.remove(path)
