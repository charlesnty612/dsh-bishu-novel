/**
 * dsh-bishu-novel — Bishu Novel 纯本地小说生产工作流引擎（DSH 静态插件）。
 *
 * 移植自 DeterminFlow 的 bishu-novel 插件：7 条工作流 DAG
 * （build / character / story-plan / outline / mvp / polish / post-hoc），
 * 每个 agent 节点按 prompts.json 组装提示词调用 DSH LLM，script 节点跑 python
 * 确定性脚本做检查点/渲染，支持并行 / 条件 / 循环网关，全部产物落在书籍工作区文件里。
 */
import { defineTool } from "@deepseek-ai/dsh-tools";
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { homedir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const RESOURCES = resolve(MODULE_DIR, "../resources");
const WORKFLOWS_DIR = join(RESOURCES, "workflows");
const SCRIPT_LIB = join(RESOURCES, "script-library/nvl");
const PYTHON = process.env.DSH_BISHU_PYTHON || "python";

export const name = "bishu-novel";
export const inject = ["tools", "llm", "webServer"];

export const apply = (ctx) => {
	const llm = ctx.llm;
	const webServer = ctx.webServer;
	const agentDefaultModel = ctx.get("agentDefaultModel");
	const skills = ctx.get("skills");

	// ── resource loading (node:fs) ─────────────────────────────────
	function readText(absPath) {
		return readFileSync(absPath, "utf-8");
	}
	function readJson(absPath) {
		return JSON.parse(readText(absPath));
	}
	function writeFile(absPath, content) {
		mkdirSync(dirname(absPath), { recursive: true });
		writeFileSync(absPath, content, "utf-8");
	}
	function fileExists(absPath) {
		try {
			return statSync(absPath).isFile();
		} catch (e) {
			return false;
		}
	}

	// ── book-workspace file browser / edit helpers ────────────────
	function safeJoinWorkspace(workspace, rel) {
		const w = String(workspace).replace(/\\/g, "/").replace(/\/+$/, "");
		const r = String(rel).replace(/\\/g, "/").replace(/^\/+/, "");
		if (/^[A-Za-z]:/.test(r)) throw new Error("只允许工作区内相对路径");
		const abs = join(w, r);
		if (!abs.toLowerCase().startsWith(w.toLowerCase() + "/")) {
			throw new Error("路径不能离开工作区: " + rel);
		}
		return abs;
	}
	function listTreeFiles(root) {
		const out = [];
		const seen = new Set();
		(function walk(dir, prefix) {
			let entries;
			try { entries = readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
			for (const ent of entries) {
				if (out.length >= 2000) return;
				const rel = prefix ? prefix + "/" + ent.name : ent.name;
				const full = join(dir, ent.name);
				if (ent.isDirectory()) walk(full, rel);
				else if (ent.isFile()) { if (!seen.has(rel)) { seen.add(rel); out.push(rel); } }
			}
		})(root, "");
		return out;
	}
	function writeArtifact(workspace, rel, content) {
		const abs = safeJoinWorkspace(workspace, rel);
		mkdirSync(dirname(abs), { recursive: true });
		writeFileSync(abs, String(content ?? ""), "utf-8");
		return abs;
	}

	// ── per-workflow model preferences (persisted to ~/.dsh) ──────
	const PREFS_PATH = join(homedir(), ".dsh", "dsh-bishu-novel-preferences.json");
	function loadPrefs() {
		try {
			if (fileExists(PREFS_PATH)) return JSON.parse(readText(PREFS_PATH));
		} catch (e) { /* ignore corrupt */ }
		return {};
	}
	function savePrefs(prefs) {
		try {
			mkdirSync(dirname(PREFS_PATH), { recursive: true });
			writeFileSync(PREFS_PATH, JSON.stringify(prefs, null, 2), "utf-8");
		} catch (e) {
			console.error("[dsh-bishu-novel] 无法保存模型偏好:", e && e.message);
		}
	}
	function mergePrefs(workflowId, model, nodeModels) {
		const prefs = loadPrefs();
		const entry = prefs[workflowId] || {};
		if (model && model.provider && model.model) entry.model = { provider: String(model.provider), model: String(model.model) };
		const nm = {};
		for (const [k, v] of Object.entries(nodeModels || {})) {
			if (v && v.provider && v.model) nm[k] = { provider: String(v.provider), model: String(v.model) };
		}
		if (Object.keys(nm).length > 0) entry.node_models = { ...(entry.node_models || {}), ...nm };
		prefs[workflowId] = entry;
		savePrefs(prefs);
	}
	function getPrefs(workflowId) {
		const prefs = loadPrefs();
		const entry = prefs[workflowId] || {};
		return { model: entry.model || null, node_models: entry.node_models || {} };
	}
	function normalizeWorkspacePath(workspace) {
		return String(workspace || "").replace(/\\/g, "/").replace(/\/+$/, "");
	}
	function pushRecentWorkspace(workspace) {
		const ws = normalizeWorkspacePath(workspace);
		if (!ws) return;
		const prefs = loadPrefs();
		const list = Array.isArray(prefs.recent_workspaces) ? prefs.recent_workspaces.map(normalizeWorkspacePath).filter(Boolean) : [];
		const next = [ws, ...list.filter((w) => w !== ws)];
		prefs.recent_workspaces = next.slice(0, 10);
		savePrefs(prefs);
	}
	function getRecentWorkspaces() {
		const prefs = loadPrefs();
		const list = Array.isArray(prefs.recent_workspaces) ? prefs.recent_workspaces.map(normalizeWorkspacePath).filter(Boolean) : [];
		return list.slice(0, 10);
	}

	// ── durable run history (~/.dsh/dsh-bishu-novel-history.json) ──
	const HISTORY_PATH = join(homedir(), ".dsh", "dsh-bishu-novel-history.json");
	function loadHistory() {
		try {
			if (fileExists(HISTORY_PATH)) {
				const v = JSON.parse(readText(HISTORY_PATH));
				if (Array.isArray(v)) return v;
			}
		} catch (e) { /* ignore corrupt */ }
		return [];
	}
	function saveHistory(entries) {
		try {
			mkdirSync(dirname(HISTORY_PATH), { recursive: true });
			writeFileSync(HISTORY_PATH, JSON.stringify(entries, null, 0), "utf-8");
		} catch (e) {
			console.error("[dsh-bishu-novel] 无法保存运行历史:", e && e.message);
		}
	}
	function historyRow(run) {
		const steps = [...(run.steps ? run.steps.values() : [])];
		let name = run.workflowId;
		try { name = workflow(run.workflowId).name || run.workflowId; } catch (e) { /* keep id */ }
		return {
			run_id: run.runId,
			workflow_id: run.workflowId,
			workflow_name: name,
			status: run.status,
			current_node: run.currentNode,
			error: run.error,
			started_at: run.startedAt,
			finished_at: run.finishedAt,
			elapsed_ms: run.startedAt && run.finishedAt ? run.finishedAt - run.startedAt : null,
			produced_count: (run.produced || []).length,
			steps_done: steps.filter((s) => s.status === "completed").length,
			steps_total: steps.length,
			workspace: run.workspace,
			parameters: run.parameters || {},
			model_override: run.modelOverride,
			node_models: run.nodeModels,
		};
	}
	function upsertHistory(run) {
		const entries = loadHistory();
		const row = historyRow(run);
		const idx = entries.findIndex((e) => e.run_id === run.runId);
		if (idx >= 0) entries[idx] = row; else entries.unshift(row);
		if (entries.length > 200) entries.length = 200;
		saveHistory(entries);
	}
	function listWorkflowIds() {
		return readdirSync(WORKFLOWS_DIR, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name);
	}

	const promptsCache = { value: null };
	const agentsCache = { value: null };
	const workflowCache = new Map();
	function prompts() {
		if (!promptsCache.value) promptsCache.value = readJson(join(RESOURCES, "prompts.json"));
		return promptsCache.value;
	}
	function agentsDoc() {
		if (!agentsCache.value) agentsCache.value = readJson(join(RESOURCES, "agents.json"));
		return agentsCache.value;
	}
	function workflow(id) {
		if (!workflowCache.has(id)) {
			workflowCache.set(id, readJson(join(WORKFLOWS_DIR, id, "definition.json")));
		}
		return workflowCache.get(id);
	}

	// ── placeholder helpers ─────────────────────────────────────────
	const PLACEHOLDER = /\{\{([\w.-]+)\}\}/g;
	function replaceAll(text, values) {
		if (text == null) return "";
		if (!values) return String(text);
		return String(text).replace(PLACEHOLDER, (m, key) =>
			Object.prototype.hasOwnProperty.call(values, key) ? String(values[key] ?? "") : m);
	}
	function resolveNested(value, values, seen) {
		if (typeof value !== "string" || !value.includes("{{")) return value;
		if (seen.has(value)) return value;
		const next = new Set(seen);
		next.add(value);
		let out = value;
		for (const m of value.matchAll(PLACEHOLDER)) {
			const k = m[1];
			if (Object.prototype.hasOwnProperty.call(values, k) && !seen.has(values[k])) {
				out = out.split(m[0]).join(resolveNested(values[k], values, next));
			}
		}
		return out;
	}
	function joinPath(workspace, rel) {
		const w = String(workspace).replace(/\\/g, "/").replace(/\/+$/, "");
		const r = String(rel).replace(/\\/g, "/");
		if (/^[A-Za-z]:/.test(r)) return r;
		return w + "/" + r.replace(/^\/+/, "");
	}

	// ── variable resolution (mirrors DeterminFlow variable_resolution) ──
	function resolveVariables(wf, overrides, workspace) {
		const raw = {};
		for (const v of wf.variables || []) {
			raw[v.key] = Object.prototype.hasOwnProperty.call(overrides, v.key)
				? String(overrides[v.key] ?? "")
				: (v.default ?? "");
		}
		const resolved = {};
		for (const k of Object.keys(raw)) resolved[k] = resolveNested(raw[k], raw, new Set());
		for (const v of wf.variables || []) {
			if (v.type !== "file") continue;
			const key = v.key;
			const rel = String(resolved[key] || "").trim();
			if (!rel) {
				resolved[key] = "";
				continue;
			}
			const abs = joinPath(workspace, rel);
			if (!fileExists(abs)) {
				if (v.required) throw new Error("必填文件变量 " + key + " 缺失: " + rel);
				resolved[key] = "";
			} else {
				resolved[key] = readText(abs);
			}
		}
		for (const k of Object.keys(raw)) resolved[k] = resolveNested(resolved[k], resolved, new Set());
		return resolved;
	}

	// ── prompt assembly (mirrors DeterminFlow sub_agent_prompts) ─────
	const SKIP_NAMES = {
		tools_guidance: "tools_section", skills_guidance: "skills_section",
		rules_guidance: "rules_section", extra_tools: "extra_tools",
		custom_task_context: "custom_append", upstream_summary: "upstream_summary",
	};
	function assemblePrompt(agentType, node, values) {
		const doc = prompts();
		const agentPrompts = doc.agents && doc.agents[agentType];
		if (!agentPrompts) return "";
		let templateValues = {};
		try {
			templateValues = JSON.parse((node.node_params && node.node_params.template_values) || "{}");
		} catch (e) {
			templateValues = {};
		}
		const dynamic = {
			extra_tools: "", tools_section: "",
			custom_append: node.system_prompt_template || "",
			skills_section: "", rules_section: "", upstream_summary: "",
		};
		const parts = [];
		const sections = [...(agentPrompts.sections || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
		for (const s of sections) {
			if (s.enabled === false) continue;
			if (s.chat_only) continue;
			const dep = SKIP_NAMES[s.name];
			if (dep && !String(dynamic[dep] || "").trim()) continue;
			let content = String(s.content || "");
			for (const [k, v] of Object.entries(dynamic)) content = content.split("{{" + k + "}}").join(String(v || ""));
			for (const [k, v] of Object.entries(templateValues)) content = content.split("{{" + k + "}}").join(replaceAll(v, values));
			content = replaceAll(content, values);
			parts.push(content);
		}
		if (node.system_prompt_template) parts.push(replaceAll(node.system_prompt_template, values));
		return parts.join("\n\n");
	}
	function agentModelParam(agentType, key) {
		const doc = agentsDoc();
		const def = doc.agents && doc.agents[agentType];
		return def && def.model_params ? def.model_params[key] : undefined;
	}

	// ── LLM calls ───────────────────────────────────────────────────
	function defaultModel() {
		try {
			if (agentDefaultModel) {
				const sel = agentDefaultModel.currentSelection();
				if (sel && sel.provider && sel.model) return { provider: sel.provider, model: sel.model };
			}
		} catch (e) { /* fall through */ }
		return { provider: "deepseek-official", model: "deepseek-v4-flash" };
	}
	async function streamLlm(system, userText, temperature, override) {
		const route = override && override.provider && override.model
			? { provider: override.provider, model: override.model }
			: defaultModel();
		const options = {
			provider: route.provider,
			model: route.model,
			system,
			messages: [{
				id: "bishu-" + Math.random().toString(36).slice(2, 12),
				role: "user",
				content: [{ type: "text", text: userText }],
				source: { kind: "user" },
			}],
		};
		if (typeof temperature === "number") options.temperature = temperature;
		let out = "";
		for await (const chunk of llm.stream(options)) {
			if (chunk.type === "text-delta") out += chunk.text;
			else if (chunk.type === "finish") {
				if (chunk.reason.kind === "error" || chunk.reason.kind === "aborted") {
					throw new Error("LLM 调用失败(" + chunk.reason.kind + "): " +
						((chunk.reason.failure && chunk.reason.failure.message) || "未知错误"));
				}
				break;
			}
		}
		return out;
	}

	// ── JSON output validation & repair (port of DeterminFlow json_output) ──
	function extractJson(text) {
		let t = String(text || "").trim();
		t = t.replace(/^```(?:json|JSON)?\s*/i, "").replace(/\s*```\s*$/, "");
		const a = t.indexOf("{"), b = t.indexOf("[");
		const starts = [a, b].filter((i) => i !== -1);
		if (!starts.length) return t;
		const start = Math.min(...starts);
		const open = t[start];
		const close = open === "{" ? "}" : "]";
		let depth = 0, inStr = false, esc = false;
		for (let i = start; i < t.length; i++) {
			const ch = t[i];
			if (inStr) {
				if (esc) esc = false;
				else if (ch === "\\") esc = true;
				else if (ch === '"') inStr = false;
				continue;
			}
			if (ch === '"') inStr = true;
			else if (ch === open) depth++;
			else if (ch === close) { depth--; if (depth === 0) return t.slice(start, i + 1); }
		}
		return t.slice(start);
	}
	function tryParseJson(text) {
		const candidate = extractJson(text);
		try { return { ok: true, value: JSON.parse(candidate) }; }
		catch (e) {
			const fixed = candidate.replace(/,(\s*[}\]])/g, "$1")
				.replace(/“/g, '"').replace(/”/g, '"').replace(/‘/g, "'").replace(/’/g, "'");
			try { return { ok: true, value: JSON.parse(fixed) }; }
			catch (e2) { return { ok: false, error: e2.message }; }
		}
	}
	async function callLlmNode(agentType, system, firstMessage, outputPath, override) {
		const temperature = await agentModelParam(agentType, "temperature");
		let text = await streamLlm(system, firstMessage, temperature, override);
		const isJson = /\.json$/i.test(outputPath || "");
		if (isJson) {
			let parsed = tryParseJson(text);
			if (!parsed.ok) {
				text = await streamLlm(system,
					firstMessage + "\n\n你的上一次输出不是合法 JSON，错误：" + parsed.error +
					"\n请只返回修复后的完整 JSON，不得输出 Markdown、解释或额外文字。", temperature, override);
				parsed = tryParseJson(text);
			}
			if (parsed.ok) {
				text = JSON.stringify(parsed.value, null, 2);
			} else {
				throw new Error("Agent 输出不是合法 JSON: " + parsed.error +
					"\n原始输出(截断): " + String(text).slice(0, 600));
			}
		}
		return text;
	}

	// ── script execution (node:child_process) ───────────────────────
	function tokenizeArgs(args) {
		const tokens = [];
		let current = "", inQuote = null;
		for (const ch of String(args || "")) {
			if (inQuote) {
				if (ch === inQuote) inQuote = null;
				else current += ch;
			} else if (ch === "'" || ch === '"') inQuote = ch;
			else if (/\s/.test(ch)) { if (current) { tokens.push(current); current = ""; } }
			else current += ch;
		}
		if (current) tokens.push(current);
		return tokens;
	}
	function resolveScriptPath(workflowId, node) {
		const params = node.node_params || {};
		const sname = params.script_name;
		if (params.script_source === "inline") {
			return join(WORKFLOWS_DIR, workflowId, "script", sname + ".py");
		}
		return join(SCRIPT_LIB, sname, sname + ".py");
	}
	async function runScript(workflowId, node, workspace, values) {
		const params = node.node_params || {};
		const scriptPath = resolveScriptPath(workflowId, node);
		const args = [scriptPath, ...tokenizeArgs(replaceAll(params.script_args || "", values))];
		const { stdout } = await execFileAsync(PYTHON, args, {
			cwd: workspace,
			encoding: "utf-8",
			maxBuffer: 8 * 1024 * 1024,
			env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
		});
		const vars = {};
		const re = /<WF_VAR>([\w.-]+):(.*?)<\/WF_VAR>/gs;
		let m;
		while ((m = re.exec(stdout)) !== null) vars[m[1]] = m[2];
		return { output: stdout, vars };
	}

	// ── workflow DAG runner ─────────────────────────────────────────
	function evalCondition(expression, values) {
		const expr = replaceAll(expression, values).trim();
		const m = expr.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
		if (!m) return expr.length > 0;
		const lhs = m[1].trim(), op = m[2], rhs = m[3].trim();
		const a = lhs.replace(/^['"]|['"]$/g, ""), b = rhs.replace(/^['"]|['"]$/g, "");
		switch (op) {
			case "==": return a === b;
			case "!=": return a !== b;
			case ">": return Number(a) > Number(b);
			case "<": return Number(a) < Number(b);
			case ">=": return Number(a) >= Number(b);
			case "<=": return Number(a) <= Number(b);
		}
		return false;
	}

	async function runWorkflow(run) {
		const wf = workflow(run.workflowId);
		run.values = resolveVariables(wf, run.parameters, run.workspace);
		run.status = "running";
		run.startedAt = Date.now();

		const gateways = new Map();
		for (const g of wf.gateways || []) gateways.set(g.id, g);
		const nodesById = new Map();
		for (const n of wf.nodes || []) nodesById.set(n.id, n);
		const allNodes = new Map([...nodesById, ...gateways]);
		const edgesOut = new Map();
		const edgesIn = new Map();
		for (const e of wf.edges || []) {
			if (!edgesOut.has(e.source)) edgesOut.set(e.source, []);
			edgesOut.get(e.source).push(e);
			if (!edgesIn.has(e.target)) edgesIn.set(e.target, []);
			edgesIn.get(e.target).push(e.source);
		}
		const done = new Set();
		const looping = new Set();
		run.steps = new Map();
		run.produced = [];

		function step(nodeId) {
			if (!run.steps.has(nodeId)) {
				const node = allNodes.get(nodeId);
				run.steps.set(nodeId, {
					id: nodeId,
					label: node ? (node.label || node.id) : nodeId,
					type: node ? (node.node_type === "agent" ? "agent" : node.node_type === "script" ? "script" : node.gateway_type || "gateway") : "unknown",
					status: "pending",
					output: null,
					error: null,
				});
			}
			return run.steps.get(nodeId);
		}

		async function executeNode(node) {
			const st = step(node.id);
			st.status = "running";
			run.currentNode = { id: node.id, label: node.label || node.id };
			try {
				if (node.node_type === "agent") {
					const agentType = replaceAll(node.agent_type || "", run.values);
					const outputPath = replaceAll(node.output_file_path || "", run.values);
					const nodeModel = (run.nodeModels && run.nodeModels[agentType]) || run.modelOverride;
					const maxAttempts = Math.max(1, node.max_reject_count || 3);
					let attempt = 0;
					let feedback = "";
					while (true) {
						attempt++;
						const system = await assemblePrompt(agentType, node, run.values);
						let firstMessage = replaceAll(node.first_message || "", run.values);
						if (feedback) {
							firstMessage += "\n\n【上次产出未通过审批】\n反馈：" + feedback +
								"\n\n请根据反馈重新生成，直接输出修复后的完整结果（仍为纯 JSON）。";
						}
						const outputText = await callLlmNode(agentType, system, firstMessage, outputPath, nodeModel);
						if (node.output_variable) run.values[node.output_variable] = outputText;
						if (outputPath && node.save_output_to_file !== false) {
							writeFile(joinPath(run.workspace, outputPath), outputText);
							st.output = outputPath;
							run.produced.push(outputPath);
						}
						if (!run.approvalEnabled || !outputPath || node.save_output_to_file === false) break;
						const decision = await requestApproval(run, node, agentType, outputPath, attempt, outputText);
						if (decision.approved) break;
						if (attempt >= maxAttempts) {
							throw new Error("节点「" + (node.label || node.id) + "」产出经 " + attempt + " 次尝试仍未通过审批");
						}
						feedback = decision.feedback || "请重新生成更符合要求的内容";
						st.status = "running";
						st.error = null;
					}
				} else if (node.node_type === "script") {
					const res = await runScript(run.workflowId, node, run.workspace, run.values);
					for (const [k, v] of Object.entries(res.vars)) run.values[k] = v;
					const clean = String(res.output || "").replace(/<WF_VAR>[\s\S]*?<\/WF_VAR>/g, "").trim();
					if (clean) st.output = clean.slice(0, 500);
				}
				st.status = "completed";
			} catch (e) {
				st.status = "failed";
				st.error = String((e && e.message) || e);
				throw e;
			}
		}

		function requestApproval(run, node, agentType, outputPath, attempt, outputText) {
			return new Promise((resolve, reject) => {
				run.pendingApproval = {
					runId: run.runId,
					nodeId: node.id,
					nodeLabel: node.label || node.id,
					agentType,
					outputPath,
					attempt,
					preview: String(outputText || "").slice(0, 2000),
					resolve,
					reject,
				};
				run.status = "awaiting_approval";
			});
		}
		function resolveApproval(runId, approved, feedback) {
			const run = runs.get(runId);
			const pending = run && run.pendingApproval;
			if (!pending) return { ok: false, error: "该运行当前没有待审批的节点" };
			run.pendingApproval = null;
			run.status = "running";
			pending.resolve({ approved: !!approved, feedback: String(feedback || "") });
			return { ok: true };
		}
		function approvalSnapshot(run) {
			const p = run.pendingApproval;
			if (!p) return null;
			return {
				run_id: p.runId,
				node_id: p.nodeId,
				node_label: p.nodeLabel,
				agent_type: p.agentType,
				output_path: p.outputPath,
				attempt: p.attempt,
				preview: p.preview,
			};
		}

		function collectClosure(startId, excludeId) {
			const visited = new Set();
			const stack = [startId];
			while (stack.length) {
				const id = stack.pop();
				if (visited.has(id) || id === excludeId) continue;
				visited.add(id);
				for (const e of edgesOut.get(id) || []) stack.push(e.target);
			}
			return visited;
		}

		async function runLoop(gatewayId) {
			const node = allNodes.get(gatewayId);
			const outs = edgesOut.get(gatewayId) || [];
			const loopEdge = outs.find((e) => e.condition && e.condition.expression && /^\s*for\s+/i.test(e.condition.expression));
			const exitEdge = outs.find((e) => e.condition && e.condition.is_default) ||
				outs.find((e) => !e.condition || !e.condition.expression);
			const m = loopEdge && loopEdge.condition.expression.match(/^\s*for\s+([\w]+)\s+in\s+([\w.-]+)\s*$/);
			if (!m || !loopEdge || !exitEdge) {
				step(gatewayId).status = "completed";
				if (exitEdge && exitEdge.target !== "__end__") await visit(exitEdge.target);
				return;
			}
			const [, iterVar, listVar] = m;
			let list = [];
			try { list = JSON.parse(run.values[listVar] || "[]"); } catch (e) { list = []; }
			const bodyClosure = collectClosure(loopEdge.target, gatewayId);
			step(gatewayId).status = "running";
			for (const item of list) {
				for (const b of bodyClosure) {
					done.delete(b);
					const st = run.steps.get(b);
					if (st) { st.status = "pending"; st.output = null; st.error = null; }
				}
				run.values[iterVar] = String(item);
				await visit(loopEdge.target);
			}
			step(gatewayId).status = "completed";
			if (exitEdge && exitEdge.target !== "__end__") await visit(exitEdge.target);
		}

		async function visit(nodeId) {
			if (done.has(nodeId)) return;
			const node = allNodes.get(nodeId);
			if (!node) return;
			if (node.gateway_type === "loop") {
				if (looping.has(nodeId)) return;
				looping.add(nodeId);
				try { await runLoop(nodeId); } finally { looping.delete(nodeId); }
				done.add(nodeId);
				return;
			}
			if (node.gateway_type === "converge") {
				const sources = edgesIn.get(nodeId) || [];
				for (const src of sources) if (!done.has(src)) return;
				done.add(nodeId);
				step(nodeId).status = "completed";
				await fanOut(nodeId, false);
				return;
			}
			if (node.gateway_type || node.node_type === "gateway") {
				done.add(nodeId);
				step(nodeId).status = "completed";
				await fanOut(nodeId, node.gateway_type === "parallel");
				return;
			}
			if (node.node_type === "agent" || node.node_type === "script") {
				await executeNode(node);
				done.add(nodeId);
				await fanOut(nodeId, false);
				return;
			}
			done.add(nodeId);
			await fanOut(nodeId, false);
		}

		async function fanOut(nodeId, parallel) {
			const outs = edgesOut.get(nodeId) || [];
			const node = allNodes.get(nodeId);
			if (node && node.gateway_type === "condition") {
				let chosen = null;
				for (const e of outs) {
					if (e.condition && e.condition.expression && !/^\s*for\s+/i.test(e.condition.expression) &&
						evalCondition(e.condition.expression, run.values)) {
						chosen = e.target;
						break;
					}
				}
				if (!chosen) {
					const defEdge = outs.find((e) => e.condition && e.condition.is_default);
					chosen = defEdge ? defEdge.target : null;
				}
				if (chosen && chosen !== "__end__") await visit(chosen);
				return;
			}
			const targets = outs.map((e) => e.target).filter((t) => t !== "__end__");
			if (parallel) {
				await Promise.all(targets.map((t) => visit(t)));
			} else {
				for (const t of targets) await visit(t);
			}
		}

		const starts = (edgesOut.get("__start__") || []).map((e) => e.target).filter((t) => t !== "__end__");
		for (const s of starts) await visit(s);
		run.status = "completed";
		run.finishedAt = Date.now();
		run.currentNode = null;
		upsertHistory(run);
	}

	// ── run registry ────────────────────────────────────────────────
	const runs = new Map();
	let runSeq = 0;
	function startRun(workflowId, workspace, parameters, modelOverride, nodeModels, approval) {
		const runId = "bishu-" + (++runSeq);
		const nm = {};
		for (const [k, v] of Object.entries(nodeModels || {})) {
			if (v && v.provider && v.model) nm[k] = { provider: String(v.provider), model: String(v.model) };
		}
		const run = {
			runId, workflowId,
			workspace: String(workspace).replace(/\\/g, "/").replace(/\/+$/, ""),
			parameters: parameters || {},
			modelOverride: modelOverride && modelOverride.provider && modelOverride.model
				? { provider: String(modelOverride.provider), model: String(modelOverride.model) }
				: null,
			nodeModels: nm,
			approvalEnabled: !!approval,
			pendingApproval: null,
			values: null, status: "queued", currentNode: null,
			steps: new Map(), error: null, startedAt: null, finishedAt: null, produced: [],
		};
		runs.set(runId, run);
		upsertHistory(run);
		Promise.resolve().then(() => runWorkflow(run)).catch((e) => {
			run.status = "failed";
			run.error = String((e && e.message) || e);
			run.finishedAt = Date.now();
			run.currentNode = null;
			upsertHistory(run);
		});
		return run;
	}
	function stepSnapshot(run) {
		return [...run.steps.values()].map((s) => ({
			id: s.id, label: s.label, type: s.type, status: s.status,
			output: s.output == null ? null : String(s.output),
			error: s.error == null ? null : String(s.error),
		}));
	}

	// ── tool registration ───────────────────────────────────────────
	const OUTPUT_SCHEMA = { type: "object", additionalProperties: true };
	function tool(toolName, description, parameters, execute) {
		const def = defineTool({
			name: toolName,
			description,
			parameters,
			output: {
				schema: OUTPUT_SCHEMA,
				render: (args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }],
			},
			execute,
		});
		ctx.effect(() => ctx.tools.register(def));
	}

	tool("bishu_list_workflows",
		"列出 Bishu Novel 插件当前可用的全部本地工作流（build / character / story-plan / outline / mvp / polish / post-hoc）及其名称、版本、节点数与必填变量。",
		{},
		async () => {
			const items = [];
			for (const id of listWorkflowIds()) {
				try {
					const wf = workflow(id);
					items.push({
						workflow_id: wf.workflow_id || id,
						name: wf.name || id,
						version: wf.version || 1,
						nodes: (wf.nodes || []).length,
						required_variables: (wf.variables || []).filter((v) => v.required).map((v) => v.key),
					});
				} catch (e) { /* skip unreadable */ }
			}
			return { workflows: items };
		});

	tool("bishu_get_workflow",
		"读取一条 Bishu Novel 工作流的定义：节点清单、网关、变量及其默认值与必填标记。运行 bishu_run_workflow 前用它核对需要填哪些变量。",
		{ workflow_id: { type: "string", required: true, description: "工作流 ID，如 build / mvp" } },
		async (args) => {
			const wf = workflow(String(args.workflow_id));
			return {
				workflow: {
					workflow_id: wf.workflow_id,
					name: wf.name,
					version: wf.version,
					variables: (wf.variables || []).map((v) => ({
						key: v.key, name: v.name, type: v.type, required: !!v.required,
						default: v.default || "", description: v.description || "", hidden: !!v.hidden,
					})),
					nodes: (wf.nodes || []).map((n) => ({ id: n.id, label: n.label || n.id, type: n.node_type })),
					gateways: (wf.gateways || []).map((g) => ({ id: g.id, type: g.gateway_type, label: g.label || "" })),
				},
			};
		});

	tool("bishu_run_workflow",
		"在指定书籍工作区启动一条 Bishu Novel 工作流，返回 run_id 后异步执行。parameters 里按变量 key 覆盖（如 premise、genre、language、chapter_number、prev_chapter、human_intent、writer_type 等）。model 可选：指定本次运行的整体模型；node_models 可选：按 agent 节点（agent_type）单独指定模型，优先级高于 model；两者缺省继承主会话默认模型。用 bishu_list_models 查看可用项。同一本书的所有工作流必须用同一个 workspace 目录。",
		{
			workflow_id: { type: "string", required: true, description: "工作流 ID（用 bishu_list_workflows / bishu_get_workflow 核对）" },
			workspace: { type: "string", required: true, description: "书籍工作区的绝对路径；同一本书的所有工作流复用同一个目录" },
			parameters: { type: "object", additionalProperties: true, description: "覆盖工作流变量的值，如 {\"premise\":\"...\",\"genre\":\"东方玄幻\",\"language\":\"中文\"}" },
			model: { type: "object", additionalProperties: true, description: "可选：运行级模型覆盖 {\"provider\":\"...\",\"model\":\"...\"}；缺省用主会话默认模型" },
			node_models: { type: "object", additionalProperties: true, description: "可选：按 agent 节点指定模型，键为 agent_type（如 {\"novel-director\":{\"provider\":\"...\",\"model\":\"...\"}}），优先级高于 model" },
			approval: { type: "boolean", description: "可选：逐节点审批模式，开启后每个 agent 节点产出会暂停等待审批（通过/拒绝带反馈）" },
		},
		async (args) => {
			const run = startRun(String(args.workflow_id), String(args.workspace), args.parameters || {}, args.model, args.node_models, args.approval);
			return {
				run_id: run.runId,
				workflow_id: run.workflowId,
				workspace: run.workspace,
				status: run.status,
				note: "执行在后台异步进行，用 bishu_workflow_status 轮询进度。",
			};
		});

	tool("bishu_approve_node",
		"审批 bishu_novel 工作流运行中等待审批的 agent 节点产出。approved=true 通过并继续；approved=false 时用 feedback 反馈，节点会带反馈重新生成（最多尝试 node.max_reject_count 次）。",
		{
			run_id: { type: "string", required: true, description: "bishu_run_workflow 返回的 run_id" },
			approved: { type: "boolean", required: true, description: "true 通过 / false 拒绝" },
			feedback: { type: "string", description: "拒绝时的创作/格式反馈，节点将据此重新生成" },
		},
		async (args) => {
			const out = resolveApproval(String(args.run_id), !!args.approved, args.feedback || "");
			if (!out.ok) return { error: out.error };
			return { ok: true };
		});

	tool("bishu_list_models",
		"列出 DSH 当前已配置可用的模型 Provider 及其模型 id，用于 bishu_run_workflow 的 model 参数（{\"provider\":\"...\",\"model\":\"...\"}）。",
		{},
		async () => {
			const providers = [];
			for (const p of llm.listProviders()) {
				let models = [];
				try { models = (await llm.listModels(p.id)) || []; } catch (e) { models = []; }
				providers.push({ provider: p.id, name: p.name, models: models.map((m) => m.id) });
			}
			return { providers };
		});

	tool("bishu_workflow_status",
		"轮询一条 Bishu Novel 工作流运行的进度：状态、当前节点、每个节点的完成情况与失败错误。",
		{ run_id: { type: "string", required: true, description: "bishu_run_workflow 返回的 run_id" } },
		async (args) => {
			const run = runs.get(String(args.run_id));
			if (!run) return { error: "未找到运行 " + args.run_id };
			return {
				run_id: run.runId, workflow_id: run.workflowId, status: run.status,
				current_node: run.currentNode, steps: stepSnapshot(run), error: run.error,
			};
		});

	tool("bishu_workflow_result",
		"读取一条已结束的 Bishu Novel 工作流运行的结果：最终状态、耗时与产出的相对文件清单。",
		{ run_id: { type: "string", required: true, description: "bishu_run_workflow 返回的 run_id" } },
		async (args) => {
			const run = runs.get(String(args.run_id));
			if (!run) return { error: "未找到运行 " + args.run_id };
			return {
				run_id: run.runId, workflow_id: run.workflowId, status: run.status, error: run.error,
				elapsed_ms: run.startedAt && run.finishedAt ? run.finishedAt - run.startedAt : null,
				produced_files: run.produced || [],
				steps: stepSnapshot(run),
			};
		});

	tool("bishu_read_artifact",
		"读取书籍工作区内的一个相对文件（正文、指导、世界观、角色档案等），用于核验工作流落盘结果。文件不存在时 exists=false。",
		{
			workspace: { type: "string", required: true, description: "书籍工作区绝对路径" },
			path: { type: "string", required: true, description: "相对路径，如 story/0001/chapter.md、meta/world_foundation.md" },
		},
		async (args) => {
			const abs = joinPath(String(args.workspace), String(args.path));
			if (!fileExists(abs)) return { exists: false, path: String(args.path) };
			const content = readText(abs);
			return { exists: true, path: String(args.path), bytes: content.length, content };
		});

	tool("bishu_edit_artifact",
		"写入/覆盖书籍工作区内的一个相对文件（可用未修改的内容直接覆盖，或写入新文件）。用于修改已生成的设定、正文、角色档案等。路径不得离开工作区。",
		{
			workspace: { type: "string", required: true, description: "书籍工作区绝对路径" },
			path: { type: "string", required: true, description: "相对路径，如 story/0001/chapter.md、meta/world_foundation.md" },
			content: { type: "string", required: true, description: "写入的完整文件内容（覆盖整个文件）" },
		},
		async (args) => {
			try {
				const abs = writeArtifact(String(args.workspace), String(args.path), args.content);
				return { ok: true, path: abs, bytes: String(args.content ?? "").length };
			} catch (e) {
				return { error: String((e && e.message) || e) };
			}
		});

	tool("bishu_book_status",
		"检查一本书工作区里已存在哪些 Bishu Novel 阶段产物，用于判断当前处于建书/卷纲/近纲/章节的哪一步、该跑下一条工作流还是回补上游。",
		{ workspace: { type: "string", required: true, description: "书籍工作区绝对路径" } },
		async (args) => {
			const ws = String(args.workspace);
			const paths = [
				"meta/world_foundation.md", "meta/character_profiles.md", "meta/story_plan.md",
				"meta/style_profile.md", "meta/character_voice.md", "meta/hooks.md", "meta/debts.md",
				"outline/volume_outline.md", "outline/near_term_outline.md",
				"story/0001/chapter.md", "story/0001/single_chapter_guide.md",
			];
			const files = [];
			for (const p of paths) files.push({ path: p, exists: fileExists(joinPath(ws, p)) });
			return { workspace: ws, files };
		});

	// ── HTTP API for the browser UI ─────────────────────────────────
	function writeJson(res, status, body) {
		const text = JSON.stringify(body);
		res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
		res.end(text);
	}
	async function readJsonBody(req) {
		let data = "";
		for await (const chunk of req) data += chunk;
		if (!data) return undefined;
		try {
			return JSON.parse(data);
		} catch (e) {
			return undefined;
		}
	}
	function queryParam(url, key) {
		return url.searchParams.get(key) ?? undefined;
	}
	function isLoopback(req) {
		const addr = req.socket && req.socket.remoteAddress;
		return addr === undefined || addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
	}
	function workflowSummary(wf) {
		const agentTypes = [];
		for (const n of wf.nodes || []) {
			if (n.node_type === "agent" && n.agent_type && !agentTypes.includes(n.agent_type)) agentTypes.push(n.agent_type);
		}
		return {
			workflow_id: wf.workflow_id,
			name: wf.name,
			version: wf.version || 1,
			nodes: (wf.nodes || []).length,
			agent_types: agentTypes,
			variables: (wf.variables || []).map((v) => ({
				key: v.key, name: v.name, type: v.type, required: !!v.required,
				default: v.default || "", description: v.description || "", hidden: !!v.hidden,
			})),
			gateways: (wf.gateways || []).map((g) => ({ id: g.id, type: g.gateway_type, label: g.label || "" })),
		};
	}
	const apiRoutes = [
		{
			kind: "exact",
			path: "/api/dsh-bishu-novel/workflows",
			handler: async (req, res) => {
				try {
					const items = [];
					for (const id of listWorkflowIds()) {
						try {
							const wf = workflow(id);
							items.push({
								workflow_id: wf.workflow_id || id,
								name: wf.name || id,
								version: wf.version || 1,
								nodes: (wf.nodes || []).length,
								required_variables: (wf.variables || []).filter((v) => v.required).map((v) => v.key),
							});
						} catch (e) { /* skip */ }
					}
					writeJson(res, 200, { workflows: items });
				} catch (e) {
					writeJson(res, 400, { error: String((e && e.message) || e) });
				}
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-bishu-novel/workflow",
			handler: async (req, res) => {
				try {
					const url = new URL(req.url ?? "/", "http://localhost");
					const wf = workflow(String(queryParam(url, "workflow_id")));
					writeJson(res, 200, { workflow: workflowSummary(wf), model_prefs: getPrefs(String(queryParam(url, "workflow_id"))) });
				} catch (e) {
					writeJson(res, 400, { error: String((e && e.message) || e) });
				}
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-bishu-novel/models",
			handler: async (req, res) => {
				try {
					if (!isLoopback(req)) {
						writeJson(res, 403, { error: "forbidden: loopback-only" });
						return;
					}
					const providers = [];
					for (const p of llm.listProviders()) {
						let models = [];
						try {
							models = (await llm.listModels(p.id)) || [];
						} catch (e) { models = []; }
						providers.push({
							id: p.id,
							name: p.name,
							models: models.map((m) => ({ id: m.id, name: m.name || m.id })),
						});
					}
					writeJson(res, 200, { providers });
				} catch (e) {
					writeJson(res, 400, { error: String((e && e.message) || e) });
				}
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-bishu-novel/run",
			handler: async (req, res) => {
				try {
					const body = await readJsonBody(req);
					if (!body || !body.workflow_id || !body.workspace) {
						writeJson(res, 400, { error: "workflow_id and workspace are required" });
						return;
					}
					workflow(String(body.workflow_id)); // validate exists
					mergePrefs(String(body.workflow_id), body.model, body.node_models);
					const run = startRun(String(body.workflow_id), String(body.workspace), body.parameters || {}, body.model, body.node_models, body.approval);
					pushRecentWorkspace(run.workspace);
					writeJson(res, 200, { run_id: run.runId, workflow_id: run.workflowId, workspace: run.workspace, status: run.status });
				} catch (e) {
					writeJson(res, 400, { error: String((e && e.message) || e) });
				}
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-bishu-novel/status",
			handler: async (req, res) => {
				const url = new URL(req.url ?? "/", "http://localhost");
				const rid = String(queryParam(url, "run_id"));
				let run = runs.get(rid);
				if (!run) {
					const row = loadHistory().find((e) => e.run_id === rid);
					if (!row) {
						writeJson(res, 404, { error: "run not found" });
						return;
					}
					writeJson(res, 200, {
						run_id: row.run_id, workflow_id: row.workflow_id, status: row.status,
						current_node: null, steps: [], error: row.error,
						pending_approval: null, workflow_name: row.workflow_name, elapsed_ms: row.elapsed_ms, produced_files: [],
					});
					return;
				}
				writeJson(res, 200, {
					run_id: run.runId, workflow_id: run.workflowId, status: run.status,
					current_node: run.currentNode, steps: stepSnapshot(run), error: run.error,
					pending_approval: approvalSnapshot(run),
				});
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-bishu-novel/approve",
			handler: async (req, res) => {
				try {
					if (!isLoopback(req)) {
						writeJson(res, 403, { error: "forbidden: loopback-only" });
						return;
					}
					const body = await readJsonBody(req);
					if (!body || !body.run_id) {
						writeJson(res, 400, { error: "run_id is required" });
						return;
					}
					const out = resolveApproval(String(body.run_id), !!body.approved, body.feedback);
					if (!out.ok) {
						writeJson(res, 400, { error: out.error });
						return;
					}
					writeJson(res, 200, { ok: true });
				} catch (e) {
					writeJson(res, 400, { error: String((e && e.message) || e) });
				}
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-bishu-novel/result",
			handler: async (req, res) => {
				const url = new URL(req.url ?? "/", "http://localhost");
				const run = runs.get(String(queryParam(url, "run_id")));
				if (!run) {
					writeJson(res, 404, { error: "run not found" });
					return;
				}
				writeJson(res, 200, {
					run_id: run.runId, workflow_id: run.workflowId, status: run.status, error: run.error,
					elapsed_ms: run.startedAt && run.finishedAt ? run.finishedAt - run.startedAt : null,
					produced_files: run.produced || [],
					steps: stepSnapshot(run),
					pending_approval: approvalSnapshot(run),
				});
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-bishu-novel/book-status",
			handler: async (req, res) => {
				try {
					const body = await readJsonBody(req);
					if (!body || !body.workspace) {
						writeJson(res, 400, { error: "workspace is required" });
						return;
					}
					const ws = String(body.workspace);
					const paths = [
						"meta/world_foundation.md", "meta/character_profiles.md", "meta/story_plan.md",
						"meta/style_profile.md", "meta/character_voice.md", "meta/hooks.md", "meta/debts.md",
						"outline/volume_outline.md", "outline/near_term_outline.md",
						"story/0001/chapter.md", "story/0001/single_chapter_guide.md",
					];
					const files = [];
					for (const p of paths) files.push({ path: p, exists: fileExists(joinPath(ws, p)) });
					pushRecentWorkspace(ws);
					writeJson(res, 200, { workspace: ws, files });
				} catch (e) {
					writeJson(res, 400, { error: String((e && e.message) || e) });
				}
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-bishu-novel/artifact",
			handler: async (req, res) => {
				try {
					const url = new URL(req.url ?? "/", "http://localhost");
					const ws = String(queryParam(url, "workspace") ?? "");
					const rel = String(queryParam(url, "path") ?? "");
					const abs = joinPath(ws, rel);
					if (!fileExists(abs)) {
						writeJson(res, 200, { exists: false, path: rel });
						return;
					}
					const content = readText(abs);
					writeJson(res, 200, { exists: true, path: rel, bytes: content.length, content });
				} catch (e) {
					writeJson(res, 400, { error: String((e && e.message) || e) });
				}
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-bishu-novel/tree",
			handler: async (req, res) => {
				try {
					if (!isLoopback(req)) { writeJson(res, 403, { error: "forbidden: loopback-only" }); return; }
					const url = new URL(req.url ?? "/", "http://localhost");
					const ws = String(queryParam(url, "workspace") ?? "");
					if (!existsSync(ws) || !statSync(ws).isDirectory()) {
						writeJson(res, 400, { error: "工作区不是有效目录: " + ws });
						return;
					}
					writeJson(res, 200, { workspace: ws, files: listTreeFiles(ws) });
				} catch (e) {
					writeJson(res, 400, { error: String((e && e.message) || e) });
				}
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-bishu-novel/write-artifact",
			handler: async (req, res) => {
				try {
					if (!isLoopback(req)) { writeJson(res, 403, { error: "forbidden: loopback-only" }); return; }
					const body = await readJsonBody(req);
					if (!body || !body.workspace || body.path == null) {
						writeJson(res, 400, { error: "workspace 和 path 是必填" });
						return;
					}
					const abs = writeArtifact(String(body.workspace), String(body.path), body.content);
					writeJson(res, 200, { ok: true, path: abs });
				} catch (e) {
					writeJson(res, 400, { error: String((e && e.message) || e) });
				}
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-bishu-novel/open-workspace",
			handler: async (req, res) => {
				try {
					if (!isLoopback(req)) {
						writeJson(res, 403, { error: "forbidden: loopback-only" });
						return;
					}
					const body = await readJsonBody(req);
					const ws = body && body.workspace ? String(body.workspace) : "";
					const abs = resolve(ws);
					if (!existsSync(abs) || !statSync(abs).isDirectory()) {
						writeJson(res, 400, { error: "工作区不是有效目录: " + ws });
						return;
					}
					spawn("explorer", [abs], { detached: true, stdio: "ignore" }).unref();
					writeJson(res, 200, { ok: true, workspace: abs });
				} catch (e) {
					writeJson(res, 400, { error: String((e && e.message) || e) });
				}
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-bishu-novel/pick-workspace",
			handler: async (req, res) => {
				try {
					if (!isLoopback(req)) {
						writeJson(res, 403, { error: "forbidden: loopback-only" });
						return;
					}
					const dp = ctx.get("directoryPicker");
					const cap = dp && typeof dp.capability === "function" ? dp.capability() : undefined;
					if (!cap || cap.kind !== "native" || typeof cap.pick !== "function") {
						writeJson(res, 400, { error: "目录选择器不可用（当前环境没有可用的原生选择器）" });
						return;
					}
					const path = await cap.pick(new AbortController().signal);
					writeJson(res, 200, { path: path ?? null });
				} catch (e) {
					writeJson(res, 400, { error: String((e && e.message) || e) });
				}
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-bishu-novel/recent-workspaces",
			handler: async (req, res) => {
				try {
					if (!isLoopback(req)) {
						writeJson(res, 403, { error: "forbidden: loopback-only" });
						return;
					}
					writeJson(res, 200, { workspaces: getRecentWorkspaces() });
				} catch (e) {
					writeJson(res, 400, { error: String((e && e.message) || e) });
				}
			},
		},
	];
	ctx.effect(() => {
		const disposers = apiRoutes.map((route) => webServer.register(route));
		return () => {
			for (const dispose of disposers) dispose();
		};
	}, "bishu: api routes");

	// ── runs history route (kept separate: needs `workflow()` name lookup) ──
	ctx.effect(() => webServer.register({
		kind: "exact",
		path: "/api/dsh-bishu-novel/runs",
		handler: async (req, res) => {
			try {
				if (!isLoopback(req)) {
					writeJson(res, 403, { error: "forbidden: loopback-only" });
					return;
				}
				// merge live in-memory runs over the durable history (live wins by run_id)
				const merged = new Map();
				for (const row of loadHistory()) merged.set(row.run_id, row);
				for (const run of runs.values()) merged.set(run.runId, historyRow(run));
				const items = [...merged.values()];
				items.sort((a, b) => (b.started_at || 0) - (a.started_at || 0));
				writeJson(res, 200, { runs: items });
			} catch (e) {
				writeJson(res, 400, { error: String((e && e.message) || e) });
			}
		},
	}), "bishu: runs history route");

	// ── writing-assistant skill ─────────────────────────────────────
	if (skills) {
		const skillBody = `# Bishu Novel 写作协作（DSH 版）

## 服务身份

把用户视为作者和最终决策者。你同时承担两个互补角色：

- 写作助手：理解创作目标，把模糊想法整理为少量可选方案，解释取舍，保护用户的题材、角色、风格和情节意图。
- 写作工作流主管：维护当前书籍与阶段，选择正确工作流，补齐必要参数，启动并监督执行，用真实落盘文件证明结果。

不要只报工具状态，也不要越过用户替他做关键创作决定。用户没有给出足够创作信息时，先提供两到三个简短选项或只追问会改变下一步的缺口；用户已经明确授权执行时，不重复索要形式确认。

## 先建立一本书的上下文

每次操作前确认以下事实，并在后续对话中保持一致：

1. 书籍工作区：用 \`bishu_run_workflow\` 时传给同一本书的同一个 \`workspace\`（绝对路径）。同一本书绝不要用不同目录跑各条工作流。
2. 用户本轮目标：了解方法、创建新书、补资料、续写、重写、后验还是润色。
3. 当前阶段与最后完成章节，以非空落盘文件为准，不以模型声称或任务已启动为准。
4. 输出语言，以及本轮真正需要用户决定的创作参数。

新书可与用户一起确定简短的工作区名称（如 \`D:/books/my-novel\`）。已有书必须复用原工作区。

## 选择下一条工作流

1. 调用 \`bishu_list_workflows\` 获取实际可用列表。
2. 对候选工作流调用 \`bishu_get_workflow\`，核对必填变量、默认值和节点；实际定义高于本 Skill 的静态摘要。
3. 依据已存在的非空文件和用户目标选择下一步。缺少前置时回到最近的上游工作流，不通过手工伪造文件绕过检查。
4. 检查书籍现状用 \`bishu_book_status\`。

## 工作流顺序

新书前置：\`build → character → story-plan → outline\`

每章推荐循环：\`mvp → polish（可选）→ post-hoc → 下一章 mvp\`

\`post-hoc\` 应在进入下一章前完成；若先做了 \`post-hoc\`、随后润色又改变了情节事实，应重新运行该章 \`post-hoc\`；纯措辞调整不必重复。

\`polish\` 会覆盖 \`story/<章节号>/chapter.md\`。运行前确认已有章节正文，并向用户说明覆盖风险。

## 把创作意图转成输入

- 延续用户已确认的 premise（故事前提）、genre（题材）和 language（语言），不要让同一本书漂移。
- 章节号统一四位数字：第一章 chapter_number=0001、prev_chapter=0000；第十二章 0012 与 0011。
- writer_type=single 是默认单写手；多写手兼容值是 muti，不要自行改成 multi，使用前提醒用户成本更高。
- 用户要求重写已有阶段或润色已有章节时，先说明会覆盖哪些长期文件；若没有可恢复副本，建议先备份整个书籍工作区。

## 运行并监督

1. 参数核对后调用 \`bishu_run_workflow\`（workflow_id、workspace、parameters 一次填好）；可用 \`bishu_list_models\` 查看可用模型，并通过 model 参数（{"provider":"...","model":"..."}）指定本次运行模型，缺省继承主会话默认模型。
2. 保存返回的 run_id。用 \`bishu_workflow_status\` 轮询进度。
3. 失败时先读错误和节点信息：路径错误先核对工作区，缺文件先补上游流程，模型输出错误才考虑重试；不要盲目重跑整个流程。
4. 终态后用 \`bishu_workflow_result\` 拿结果，用 \`bishu_read_artifact\` 查看产物。只有状态为 completed 且预期长期文件存在、非空时，才向用户报告完成。

## 对用户的汇报方式

| 项目 | 应报告内容 |
|---|---|
| 当前书籍 | 工作区名称，不暴露无关绝对路径 |
| 当前阶段 | 已由哪些非空文件证明 |
| 本轮动作 | 工作流、关键创作参数、是否会覆盖 |
| 运行证据 | 任务终态、关键产物或明确错误 |
| 下一步 | 只推荐一条最合理的下一动作 |

把“创作建议”和“已经执行的事实”分开表达。失败或缺少证据时直接说明停在哪里、保留了什么、用户接下来需要决定什么；不要用模型回复代替最终产物验证。`;

		ctx.effect(() => skills.register({
			name: "bishu-novel-writing-assistant",
			source: "runtime",
			description: "当用户要用 Bishu Novel 从创意建书、创建角色、规划故事与大纲、生产章节、做章节后验或润色，或询问笔枢本地存档、工作流顺序、填参、续写和失败恢复时必须加载此 Skill。让主 Agent 同时作为用户的写作助手与写作工作流主管。",
			whenToUse: "用户要求创作小说、建书、写章节、润色、世界构建，或提到 bishu-novel / 笔枢工作流时。",
			content: skillBody,
		}));
	}

	console.log("[bishu-novel] plugin applied: engine + 7 tools + writing-assistant skill ready");
};

export default { name, inject, apply };
