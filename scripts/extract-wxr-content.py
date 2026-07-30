#!/usr/bin/env python3
"""Extract page/post content from a WordPress WXR export into structured JSON."""
import json
import re
import sys
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup

NS = {
    "wp": "http://wordpress.org/export/1.2/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "excerpt": "http://wordpress.org/export/1.2/excerpt/",
    "dc": "http://purl.org/dc/elements/1.1/",
}

BLOCK_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6", "p", "img"}


def clean_blocks(html, image_dims=None):
    image_dims = image_dims or {}
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["style", "script"]):
        tag.decompose()

    blocks = []
    seen_list_parent = None
    list_items = []
    in_faq_section = False

    def flush_list():
        nonlocal list_items, seen_list_parent
        if list_items:
            blocks.append({"type": "list", "items": list_items})
        list_items = []
        seen_list_parent = None

    for el in soup.find_all(list(BLOCK_TAGS) + ["li"]):
        if el.name == "li":
            text = el.get_text(" ", strip=True)
            if not text:
                continue
            parent = el.parent
            if seen_list_parent is not parent:
                flush_list()
                seen_list_parent = parent
            list_items.append(text)
            continue
        else:
            flush_list()

        if el.name == "img":
            src = el.get("src", "").strip()
            if not src or src.startswith("data:"):
                continue
            block = {"type": "image", "src": src, "alt": el.get("alt", "").strip()}
            dims = image_dims.get(src)
            if dims:
                block["width"], block["height"] = dims
            blocks.append(block)
            continue

        text = el.get_text(" ", strip=True)
        if not text:
            continue

        if el.name.startswith("h"):
            in_faq_section = "question" in text.lower() or "faq" in text.lower()
            blocks.append({"type": "heading", "level": int(el.name[1]), "text": text})
            continue

        # Elementor's FAQ accordion renders each question as a bare text node
        # immediately before the answer's <p> tag, with no wrapping element —
        # so the question only exists as el.previous_sibling here.
        if in_faq_section:
            prev = el.previous_sibling
            question = prev.strip() if isinstance(prev, str) else ""
            if len(question) > 8:
                blocks.append({"type": "faq", "question": question, "answer": text})
                continue

        blocks.append({"type": "paragraph", "text": text})

    flush_list()

    # de-duplicate consecutive identical blocks (Elementor repeats badges/icons often)
    deduped = []
    for b in blocks:
        if deduped and deduped[-1] == b:
            continue
        deduped.append(b)
    return deduped


def main():
    src_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not src_path:
        print("usage: extract-wxr-content.py <path-to-wxr.xml>", file=sys.stderr)
        sys.exit(1)

    tree = ET.parse(src_path)
    root = tree.getroot()
    channel = root.find("channel")

    pages = {}
    posts = []
    image_urls = set()

    # WordPress stores each attachment's real pixel dimensions as PHP-serialized
    # postmeta (e.g. a:6:{s:5:"width";i:547;s:6:"height";i:315;...}). Capturing
    # these lets rendered <img> tags reserve their aspect ratio up front instead
    # of shifting the page as each one lazy-loads (a real cause of scroll jank).
    dim_pattern = re.compile(r'^a:\d+:\{s:5:"width";i:(\d+);s:6:"height";i:(\d+);')
    image_dims = {}
    for item in channel.findall("item"):
        if item.findtext("wp:post_type", default="", namespaces=NS) != "attachment":
            continue
        url = (item.findtext("wp:attachment_url", default="", namespaces=NS) or "").strip()
        if not url:
            continue
        for meta in item.findall("wp:postmeta", NS):
            if meta.findtext("wp:meta_key", default="", namespaces=NS) != "_wp_attachment_metadata":
                continue
            value = meta.findtext("wp:meta_value", default="", namespaces=NS) or ""
            m = dim_pattern.match(value)
            if m:
                image_dims[url] = (int(m.group(1)), int(m.group(2)))
            break

    for item in channel.findall("item"):
        post_type = item.findtext("wp:post_type", default="", namespaces=NS)
        status = item.findtext("wp:status", default="", namespaces=NS)
        title = (item.findtext("title", default="") or "").strip()
        slug = (item.findtext("wp:post_name", default="", namespaces=NS) or "").strip()
        link = (item.findtext("link", default="") or "").strip()
        content_html = item.findtext("content:encoded", default="", namespaces=NS)

        if post_type == "attachment":
            url = item.findtext("wp:attachment_url", default="", namespaces=NS)
            if url:
                image_urls.add(url.strip())
            continue

        if post_type not in ("page", "post") or status != "publish":
            continue

        blocks = clean_blocks(content_html, image_dims)
        for b in blocks:
            if b["type"] == "image":
                image_urls.add(b["src"])

        record = {
            "title": title,
            "slug": slug,
            "link": link,
            "post_type": post_type,
            "blocks": blocks,
        }

        if post_type == "page":
            pages[slug] = record
        else:
            posts.append(record)

    out = {"pages": pages, "posts": posts}
    with open("src/content/site-content.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    with open("scripts/image-urls.txt", "w", encoding="utf-8") as f:
        for url in sorted(image_urls):
            f.write(url + "\n")

    print(f"Pages extracted: {len(pages)}")
    print(f"Posts extracted: {len(posts)}")
    print(f"Unique image URLs: {len(image_urls)}")


if __name__ == "__main__":
    main()
