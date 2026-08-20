#!/usr/bin/env python3
"""把 character-add 工作流的 `character_names` 变量归一为 JSON 数组 list 变量。

入参：
- --input <string>：原始点名字符串
  支持 JSON 数组 '["甲","乙"]'、逗号分隔 '甲,乙,丙'（中英文逗号都吃）、单名 '甲'

产出（最后一行 WF_VAR 供 loop gateway 使用）：
- <WF_VAR>character_names:["甲","乙","丙"]</WF_VAR>

⚠️ 注意：workflow 中必须把 {{character_names}} 包在引号里，如
   --input "{{character_names}}"
否则含空格的点名（如「林晚, 赵宇」）会被 tokenizeArgs 按空格切碎。
"""

import argparse
import json
import re
import sys


def parse(raw: str):
    s = str(raw or "").strip()
    if not s:
        return []
    # 1) 直接 JSON 数组
    try:
        v = json.loads(s)
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        if isinstance(v, str):
            s = v
    except Exception:
        pass
    # 2) 逗号分隔（中英文都吃）
    parts = [p.strip() for p in re.split(r"[,，]", s)]
    return [p for p in parts if p]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="原始点名字符串（直接传值）")
    args = parser.parse_args()

    names = parse(args.input)
    if not names:
        print("[parse_names] 错误：character_names 解析后为空，请检查参数", file=sys.stderr)
        sys.exit(1)

    names_json = json.dumps(names, ensure_ascii=False)
    print(f"<WF_VAR>character_names:{names_json}</WF_VAR>")
    print(f"<script_out>已归一点名角色 {len(names)} 个：{', '.join(names)}</script_out>")


if __name__ == "__main__":
    main()