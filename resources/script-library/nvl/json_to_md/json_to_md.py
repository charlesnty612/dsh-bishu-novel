#!/usr/bin/env python3
"""通用 JSON→Markdown 渲染脚本。

模式：
  tree:      递归读取目录下所有 JSON，按文件名排序，每个 JSON 渲染为一个 ## section
  character: 读取角色缓存目录下 skeleton.json + beliefs.json + *_deep.json，合并渲染
  voice:     读取 voice.json，渲染为角色声音锚 MD

可选 `--merge`：
  对 character / voice 模式开启合并渲染。
  已有角色段落（按 ## 标题解析）逐字节保留；只追加新角色段落。
  适用于 character-add 工作流——保护用户手改。
  首行 h1 标题在已有文件里保留首个；新文件按正常规则生成。

用法:
  python json-to-md.py --mode tree --input-dir {book_dir}/world --output {book_dir}/meta/world_foundation.md --title "世界观基础"
  python json-to-md.py --mode character --book-dir {book_dir} --output {book_dir}/meta/character_profiles.md
  python json-to-md.py --mode voice --voice-json cache/character/voice.json --output meta/character_voice.md
  python json-to-md.py --mode character --book-dir {book_dir} --output {book_dir}/meta/character_profiles.md --merge
"""

import argparse
import json
import os
import re
import sys


def _h(level: int, title: str) -> str:
    return f"{'#' * level} {title}"


def _p(text: str) -> str:
    return text.rstrip() + "\n"


def _table(rows: list[list[str]], headers: list[str]) -> str:
    lines = ["| " + " | ".join(headers) + " |", "|" + "|".join(["------"] * len(headers)) + "|"]
    for row in rows:
        lines.append("| " + " | ".join(str(c).replace("\n", " ") for c in row) + " |")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════
#  tree 模式：递归渲染 JSON
# ═══════════════════════════════════════════════════════════

def render_json_to_md(data: dict, filename: str) -> str:
    """将单个 JSON 渲染为 Markdown section。递归处理嵌套对象和数组。"""
    label = filename.replace(".json", "").replace("_", " ").title()
    parts = [_h(2, label)]

    def _render(obj, indent: int = 0):
        prefix = "  " * indent
        if isinstance(obj, dict):
            for k, v in obj.items():
                key_display = k.replace("_", " ").title()
                if isinstance(v, (dict, list)):
                    parts.append(f"{prefix}- **{key_display}**：")
                    _render(v, indent + 1)
                else:
                    parts.append(f"{prefix}- **{key_display}**：{v}")
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                if isinstance(item, dict):
                    if i == 0:
                        # 收集所有 key 用于表头
                        keys = list(item.keys())
                        rows = []
                        for it in obj:
                            if isinstance(it, dict):
                                rows.append([str(it.get(k, "")) for k in keys])
                        if rows:
                            parts.append(_table(rows, [k.replace("_", " ").title() for k in keys]))
                        return
                    parts.append(f"{prefix}- **{i + 1}.**")
                    _render(item, indent + 1)
                else:
                    parts.append(f"{prefix}- {item}")
        else:
            parts.append(f"{prefix}{obj}")

    _render(data)
    return "\n\n".join(parts)


def load_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f, strict=False)


# ═══════════════════════════════════════════════════════════
#  character 模式：角色渲染
# ═══════════════════════════════════════════════════════════

def render_character(name: str, true_name: str, aliases: list, skeleton: dict, beliefs: list, deep: dict) -> str:
    """将单个角色的所有维度渲染为 Markdown section。"""
    # 标题：name 为主，有别名时追加
    header = name
    if aliases:
        header = f"{name}（{'、'.join(aliases)}）"
    parts = [_h(2, header)]

    # essence 定调句
    essence = skeleton.get("essence", "").strip()
    if essence:
        parts.append(f"> {essence}")

    # 真名行（仅当真名与 name 不同或为空时显示）
    if true_name and true_name != name:
        parts.append(f"> 真名：{true_name}")
    elif not true_name:
        parts.append("> 真名未知")

    # ── A 层：世界烙印 ──
    sk = skeleton
    parts.append(_h(3, "世界烙印"))
    wp = sk.get("world_position", {})
    wa = sk.get("world_anchor", {})

    parts.append(_h(4, "世界位置"))
    parts.append(f"- 出身阶层：{wp.get('origin_class', '—')}")
    parts.append(f"- 所属势力：{wp.get('affiliation', '—')}")
    parts.append(f"- 社会身份：{wp.get('social_role', '—')}")
    parts.append(f"- 对核心冲突的站位：{wp.get('stance_on_core_conflict', '—')}")

    parts.append(_h(4, "世界观锚点"))
    parts.append(f"- 体现的规则：{wa.get('embodies_rule', '—')}")
    parts.append(f"- 被塑造的规则：{wa.get('shaped_by_rule', '—')}")
    parts.append(f"- 可能挑战的规则：{wa.get('may_challenge_rule', '—')}")

    # ── B 层：内在构造 ──
    parts.append(_h(3, "内在构造"))
    # 信念匹配：直接用 name
    b = next((b for b in beliefs if b.get("character") == name), {})
    if not b:
        # 角色在 beliefs.json 中缺失（beliefs 环节可能漏生成该角色）：
        # 不阻断渲染，但向 stderr 打警告，避免「—」静默吞掉漏项（仿照 voice 模式空栏告警）。
        print(
            f"[json-to-md] 警告：角色「{name}」缺少信念数据"
            "（beliefs 环节可能漏生成），核心信念栏已留空",
            file=sys.stderr,
        )
    parts.append(_h(4, "核心信念"))
    parts.append(f"- 信念：{b.get('core_belief', '—')}")
    parts.append(f"- 来源：{b.get('belief_source', '—')}")
    parts.append(f"- 作者视角：{b.get('author_perspective', '—')}")

    cd = deep.get("core_desire", {})
    parts.append(_h(4, "核心欲望"))
    parts.append(f"- 表层目标：{cd.get('surface_goal', '—')}")
    parts.append(f"- 深层欲望：{cd.get('deep_desire', '—')}")

    df = deep.get("deep_fear", {})
    parts.append(_h(4, "深层恐惧"))
    parts.append(f"- 恐惧：{df.get('fear', '—')}")
    parts.append(f"- 来源：{df.get('source', '—')}")

    sec = deep.get("secret", {})
    parts.append(_h(4, "秘密"))
    parts.append(f"- 内容：{sec.get('content', '—')}")
    who_knows = sec.get("who_knows", [])
    who_should = sec.get("who_doesnt_know_but_should", [])
    parts.append(f"- 谁知道：{', '.join(who_knows) if who_knows else '无人'}")
    parts.append(f"- 谁不知道但该知道：{', '.join(who_should) if who_should else '—'}")
    parts.append(f"- 暴露后果：{sec.get('exposure_consequence', '—')}")

    bl = deep.get("bottom_line", {})
    parts.append(_h(4, "不可触碰的底线"))
    parts.append(f"- 触犯条件：{bl.get('condition', '—')}")
    parts.append(f"- 来源：{bl.get('source', '—')}")
    parts.append(f"- 反应：{bl.get('reaction_when_crossed', '—')}")

    # ── C 层：创伤与矛盾 ──
    parts.append(_h(3, "创伤与矛盾"))
    kt = deep.get("key_trauma", {})
    parts.append(_h(4, "关键创伤"))
    parts.append(f"- 伤口：{kt.get('wound', '—')}")
    parts.append(f"- 触发条件：{kt.get('trigger', '—')}")
    parts.append(f"- 应激反应：{kt.get('stress_response', '—')}")
    parts.append(f"- 行为影响：{kt.get('impact_on_behavior', '—')}")

    ic = deep.get("internal_contradiction", {})
    parts.append(_h(4, "内在矛盾"))
    parts.append(f"- 冲突元素：{ic.get('conflicting_elements', '—')}")
    parts.append(f"- 来源：{ic.get('source', '—')}")
    parts.append(f"- 可能走向：{ic.get('possible_direction', '—')}")

    # ── D 层：人际与弧线 ──
    parts.append(_h(3, "人际与弧线"))
    rels = sk.get("relationships", [])
    if rels:
        parts.append(_h(4, "关系网络"))
        rows = []
        for r in rels:
            rows.append([
                r.get("target", ""),
                r.get("nature", ""),
                r.get("meaning_to_character", ""),
                r.get("hidden_tension", ""),
                r.get("default_attitude", ""),
            ])
        parts.append(_table(rows, ["对象", "关系", "意义", "隐藏张力", "默认态度"]))

    ap = deep.get("arc_potential", {})
    parts.append(_h(4, "弧线潜能"))
    parts.append(f"- 成长方向：{ap.get('growth_direction', '—')}")
    parts.append(f"- 堕落方向：{ap.get('corruption_direction', '—')}")
    parts.append(f"- 关键抉择：{ap.get('key_choice', '—')}")

    return "\n\n".join(parts)


# ═══════════════════════════════════════════════════════════
#  voice 模式：角色声音锚渲染
# ═══════════════════════════════════════════════════════════

def pick(d: dict, *keys):
    """返回 dict 中第一个存在且非空的值；均不存在或为空时返回 ""。

    用于对 LLM 同义改写字段名做归一化兜底，如 voice_positioning | core_voice。
    """
    if not isinstance(d, dict):
        return ""
    for k in keys:
        v = d.get(k)
        if v is not None and v != "" and v != [] and v != {}:
            return v
    return ""


def render_voice_char(char: dict) -> str:
    """将单个角色的声线 JSON 渲染为 Markdown section。

    字段名兼容：LLM 输出可能把 schema 键名同义改写
    （voice_positioning→core_voice、sentence_preference→sentence_length、
     pause_habit→pause、dominant_sentence_type→common_patterns、
     nervous→tension），读取时按别名二选一兜底。
    """
    name = char.get("name", "未知")
    parts = [_h(2, name)]

    vp = pick(char, "voice_positioning", "core_voice")
    if vp:
        parts.append(_h(3, "核心声音定位"))
        parts.append(_p(vp))

    sf = char.get("syntax_fingerprint", {})
    if sf and (pick(sf, "sentence_preference", "sentence_length")
               or sf.get("catchphrases")
               or pick(sf, "pause_habit", "pause")
               or pick(sf, "dominant_sentence_type", "common_patterns")):
        parts.append(_h(3, "句法指纹"))
        sentence_pref = pick(sf, "sentence_preference", "sentence_length")
        if sentence_pref:
            parts.append(f"- 长短句偏好：{sentence_pref}")
        catchphrases = sf.get("catchphrases", [])
        if catchphrases:
            parts.append(f"- 口头禅：{'、'.join(catchphrases)}")
        pause_habit = pick(sf, "pause_habit", "pause")
        if pause_habit:
            parts.append(f"- 停顿习惯：{pause_habit}")
        dominant_type = pick(sf, "dominant_sentence_type", "common_patterns")
        if dominant_type:
            parts.append(f"- 常用句式：{dominant_type}")

    cb = pick(char, "cognitive_bias")
    if cb:
        parts.append(_h(3, "认知偏差"))
        parts.append(_p(cb))

    fs = char.get("forbidden_speech", [])
    if fs:
        parts.append(_h(3, "禁止说的话"))
        for item in fs:
            parts.append(f"- {item}")

    ep = char.get("emotion_patterns", {})
    if ep and (pick(ep, "anger") or pick(ep, "nervous", "tension") or pick(ep, "lying")):
        parts.append(_h(3, "情绪表达模式"))
        anger = pick(ep, "anger")
        if anger:
            parts.append(f"- 愤怒时：{anger}")
        nervous = pick(ep, "nervous", "tension")
        if nervous:
            parts.append(f"- 紧张时：{nervous}")
        lying = pick(ep, "lying")
        if lying:
            parts.append(f"- 撒谎时：{lying}")

    return "\n\n".join(parts)


# ═══════════════════════════════════════════════════════════
#  主入口
# ═══════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="通用 JSON→Markdown 渲染")
    parser.add_argument("--mode", required=True, choices=["tree", "character", "voice"])
    parser.add_argument("--input-dir", default="", help="JSON 文件目录（tree 模式）")
    parser.add_argument("--book-dir", default="", help="书籍根目录（character 模式）")
    parser.add_argument("--voice-json", default="", help="voice.json 路径（voice 模式）")
    parser.add_argument("--output", required=True, help="输出 Markdown 文件路径")
    parser.add_argument("--title", default="角色档案", help="一级标题")
    parser.add_argument(
        "--merge",
        action="store_true",
        help="合并模式：仅对 character / voice 模式有效；已有角色段落逐字节保留，仅追加新角色段落（character-add 工作流使用，保护用户手改）",
    )
    args = parser.parse_args()

    sections = []

    if args.mode == "tree":
        input_dir = args.input_dir
        if not os.path.isdir(input_dir):
            print(f"[json-to-md] 错误：目录不存在 {input_dir}", file=sys.stderr)
            sys.exit(1)

        json_files = sorted(f for f in os.listdir(input_dir) if f.endswith(".json"))
        if not json_files:
            print(f"[json-to-md] 错误：{input_dir} 中没有 JSON 文件", file=sys.stderr)
            sys.exit(1)

        for fname in json_files:
            fpath = os.path.join(input_dir, fname)
            try:
                data = load_json(fpath)
                sections.append(render_json_to_md(data, fname))
            except (json.JSONDecodeError, FileNotFoundError) as e:
                print(f"[json-to-md] 跳过 {fname}: {e}", file=sys.stderr)

    elif args.mode == "character":
        cache_dir = os.path.join(args.book_dir, "cache", "character")
        skeleton_path = os.path.join(cache_dir, "skeleton.json")
        beliefs_path = os.path.join(cache_dir, "beliefs.json")

        if not os.path.exists(skeleton_path):
            print(f"[json-to-md] 错误：skeleton.json 不存在 ({skeleton_path})", file=sys.stderr)
            sys.exit(1)

        skeleton_data = load_json(skeleton_path)
        characters = skeleton_data.get("characters", [])
        if not characters:
            print("[json-to-md] 错误：skeleton.json 中无 characters", file=sys.stderr)
            sys.exit(1)

        beliefs = []
        if os.path.exists(beliefs_path):
            beliefs = load_json(beliefs_path).get("beliefs", [])

        for char in characters:
            name = char.get("name", "")
            true_name = char.get("true_name", "")
            aliases = char.get("aliases", [])
            if not name:
                print(f"[json-to-md] 警告：角色缺少 name 字段，跳过", file=sys.stderr)
                continue
            deep_path = os.path.join(cache_dir, f"{name}_deep.json")
            deep = {}
            if os.path.exists(deep_path):
                deep = load_json(deep_path)
            else:
                print(f"[json-to-md] 警告：{name}_deep.json 不存在，深层维度留空", file=sys.stderr)
            sections.append(render_character(name, true_name, aliases, char, beliefs, deep))

    elif args.mode == "voice":
        voice_path = args.voice_json
        if not os.path.exists(voice_path):
            print(f"[json-to-md] 错误：voice.json 不存在 ({voice_path})", file=sys.stderr)
            sys.exit(1)

        voice_data = load_json(voice_path)
        characters = voice_data.get("characters", [])
        if not characters:
            # Agent 偶发输出空 characters 时不要阻断整条角色管线。
            # 使用同目录 skeleton.json 生成最小声音锚，后续人工或再生可覆盖。
            skeleton_path = os.path.join(os.path.dirname(voice_path), "skeleton.json")
            if os.path.exists(skeleton_path):
                skeleton = load_json(skeleton_path).get("characters", [])
                characters = [
                    {
                        "name": c.get("name", "未知"),
                        "voice_positioning": "待补充",
                        "syntax_fingerprint": {
                            "sentence_preference": "待补充",
                            "catchphrases": [],
                            "pause_habit": "待补充",
                            "dominant_sentence_type": "待补充",
                        },
                        "cognitive_bias": "待补充",
                        "forbidden_speech": [],
                        "emotion_patterns": {
                            "anger": "待补充",
                            "nervous": "待补充",
                            "lying": "待补充",
                        },
                    }
                    for c in skeleton
                    if c.get("name")
                ]
                print("[json-to-md] 警告：voice.json 中无 characters，已用 skeleton.json 生成最小声音锚", file=sys.stderr)
            if not characters:
                print("[json-to-md] 错误：voice.json 中无 characters，且无法从 skeleton.json 兜底", file=sys.stderr)
                sys.exit(1)

        for char in characters:
            section = render_voice_char(char)
            sections.append(section)
            # 空栏告警：角色所有内容栏均为空时提示，避免静默失败。
            # 仅统计 MD 正文（排除所有 # 标题行），任一内容行存在即视为非空。
            body_lines = [ln for ln in section.splitlines() if ln and not ln.startswith("#")]
            if not body_lines:
                cname = char.get("name", "未知")
                print(
                    f"[json-to-md] 警告：角色「{cname}」的 voice.json 内容栏全为空"
                    "（可能字段名与 schema 不符或值缺失），声线栏已留空",
                    file=sys.stderr,
                )

    if not sections:
        print("[json-to-md] 错误：没有成功渲染任何内容", file=sys.stderr)
        sys.exit(1)

    new_output = f"# {args.title}\n\n" + "\n\n---\n\n".join(sections) + "\n"
    new_output = new_output.replace('——', '，')

    # 合并模式：仅对 character / voice 模式生效。
    # 读取已有输出，按 ## 标题切 section：已有同名 section 整段保留字节（绝对不重写），
    # 仅追加新 section；首行 h1 标题在已有文件里保留首个。
    # 关键约定：每个 section 切片从 "## " 起点到下一个 "## " 起点（含两 section 之间的 \n\n---\n\n 分隔符），
    # 这样已有的 section 按出现顺序 emit 即可完整保留原文件的字节布局；
    # 只有在「已有最后一节 → 新第一节」之间需要补 SEP。
    if args.merge and args.mode in ("character", "voice") and os.path.exists(args.output):
        existing = open(args.output, "r", encoding="utf-8").read()

        existing_ranges = []
        for m in re.finditer(r"(?m)^## ", existing):
            existing_ranges.append(m.start())
        new_ranges = []
        for m in re.finditer(r"(?m)^## ", new_output):
            new_ranges.append(m.start())

        # 已有 sections：每个 slice = ## 起点 → 下一个 ## 起点（最后一节到 EOF）
        # 这样 slice 内已经包含「\n\n---\n\n」分隔符（最后一节除外）。
        existing_sections = []
        existing_titles_set = set()
        for i, s in enumerate(existing_ranges):
            e = existing_ranges[i + 1] if i + 1 < len(existing_ranges) else len(existing)
            block = existing[s:e]
            first_nl = block.find("\n")
            header_line = block if first_nl < 0 else block[:first_nl]
            m_title = re.match(r"^##\s+(.+?)\s*$", header_line)
            if not m_title:
                continue
            title = m_title.group(1).strip()
            existing_sections.append((title, block))
            existing_titles_set.add(title)

        # 已有文件头：第一个 ## 之前（含 h1 与空行）
        existing_head = existing[: existing_ranges[0]] if existing_ranges else existing

        # 切新 output sections（同样 slice 到下一个 ## 起点）
        new_section_blocks = []
        for i, s in enumerate(new_ranges):
            e = new_ranges[i + 1] if i + 1 < len(new_ranges) else len(new_output)
            block = new_output[s:e]
            first_nl = block.find("\n")
            header_line = block if first_nl < 0 else block[:first_nl]
            m_title = re.match(r"^##\s+(.+?)\s*$", header_line)
            if not m_title:
                continue
            title = m_title.group(1).strip()
            new_section_blocks.append((title, block))

        # 拼装：
        # - existing_sections 整体按出现顺序 emit（slice 已含分隔符，最后一节不含）
        # - 新 section 仅在「已有 → 新」之间补一个 SEP（最后一节没有自带分隔符时）
        # - 新 section 之间也用 SEP（与 new_output 一致：\n\n---\n\n）
        SEP = "\n\n---\n\n"
        parts = []
        parts.append(existing_head)
        kept = 0
        appended = 0
        for _title, block in existing_sections:
            parts.append(block)
            kept += 1
        for title, block in new_section_blocks:
            if title in existing_titles_set:
                continue
            parts.append(SEP)
            parts.append(block)
            existing_titles_set.add(title)
            appended += 1

        merged = "".join(parts)
        # 合并模式：仅替换新生成 section 中的破折号；已有 section 字节级保留，
        # 不重新规整，避免用户已手改的内容被改回去。
        # 实现：新 section 的字符串里 `——` → `，` 已经在 new_output 中完成；
        # merged = 已有 head + 已有 sections (字节级) + 新 sections (字节级，新生成时已 normalize)，
        # 无需再统一 replace。
        os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(merged)
        print(
            f"[json-to-md] 合并模式：{args.output}，保留 {kept} 个旧 section、"
            f"追加 {appended} 个新 section（合并前新生成 {len(sections)} 个）",
            file=sys.stderr,
        )
        return

    output = new_output

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        f.write(output)

    print(f"[json-to-md] 已生成：{args.output}，共 {len(sections)} 个 section", file=sys.stderr)


if __name__ == "__main__":
    main()
