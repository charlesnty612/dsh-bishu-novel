#!/usr/bin/env python3
"""通用 JSON 数组追加脚本（character-add 工作流配套）。

用途：把 agent 产出里的指定数组，按 `name-key` 字段去重，append 到目标文件中的同名字段。
典型入参：
  --input cache/cm/cm_output.json --array-key character_states --name-key name

行为：
1. 读 agent 产出 JSON（可能含 markdown 围栏、智能引号、尾部逗号；用 _extract_json 兜底）
2. 读目标文件 JSON（不存在则当作 {array_key: []}）
3. 把 agent 数组里「name 不在现有集合」的条目追加
4. 写回目标文件（保留缩进 2）

产出（脚本末尾标准输出，最后一行为 WF_VAR）：
  <WF_VAR>added:["甲","乙"]</WF_VAR>
  <WF_VAR>skipped:["丙"]</WF_VAR>
  <WF_VAR>total:7</WF_VAR>
"""

import argparse
import json
import os
import re
import sys


def _extract_json(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        return text
    text = re.sub(r"^```(?:json)?\s*\n?", "", text, count=1)
    text = re.sub(r"\n?```\s*$", "", text, count=1)
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = re.sub(r",(\s*[}\]])", r"\1", text)
    return text.strip()


def _load_agent(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()
    text = _extract_json(raw)
    return json.loads(text, strict=False)


def _load_existing(path: str) -> dict:
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.loads(f.read(), strict=False)
    except Exception:
        return {}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="agent 产出 JSON 文件路径")
    parser.add_argument("--file", required=True, help="目标工作区 JSON 文件（相对 cwd，例如 cache/character/skeleton.json）")
    parser.add_argument("--array-key", required=True, help="数组字段名，如 characters / beliefs")
    parser.add_argument("--name-key", required=True, help="条目 name 字段名，如 name / character")
    args = parser.parse_args()

    try:
        agent_data = _load_agent(args.input)
    except Exception as e:
        print(f"[merge_json_append] 错误：agent 产出解析失败：{e}", file=sys.stderr)
        sys.exit(1)

    items = agent_data.get(args.array_key) if isinstance(agent_data, dict) else None
    if not isinstance(items, list):
        print(f"[merge_json_append] 错误：agent 产出不含 {args.array_key} 数组", file=sys.stderr)
        sys.exit(1)

    target_abs = os.path.abspath(args.file)
    os.makedirs(os.path.dirname(target_abs), exist_ok=True)
    existing = _load_existing(target_abs)
    if not isinstance(existing, dict):
        existing = {}
    arr = existing.get(args.array_key)
    if not isinstance(arr, list):
        arr = []
    existing_names = set()
    for it in arr:
        if isinstance(it, dict) and it.get(args.name_key):
            existing_names.add(str(it[args.name_key]))

    added = []
    skipped = []
    for it in items:
        if not isinstance(it, dict):
            skipped.append("(非法条目)")
            continue
        n = it.get(args.name_key)
        if not n:
            skipped.append("(无 name 字段)")
            continue
        n = str(n)
        if n in existing_names:
            skipped.append(n)
            continue
        arr.append(it)
        existing_names.add(n)
        added.append(n)

    if added:
        existing[args.array_key] = arr
        with open(target_abs, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)
            f.write("\n")

    total = len(arr)
    print(f"[merge_json_append] {args.file}: added={len(added)}, skipped={len(skipped)}, total={total}", file=sys.stderr)
    print(f"<WF_VAR>added:{json.dumps(added, ensure_ascii=False)}</WF_VAR>")
    print(f"<WF_VAR>skipped:{json.dumps(skipped, ensure_ascii=False)}</WF_VAR>")
    print(f"<WF_VAR>total:{total}</WF_VAR>")


if __name__ == "__main__":
    main()