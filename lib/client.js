/**
 * dsh-bishu-novel — browser client half.
 *
 * Sidebar "Bishu Novel" workbench, organized as a 3-tab user-writing journey:
 *   书籍 (book)    — default tab: workspace picker + book-stage pipeline + artifact browser.
 *   工作流 (workflow) — pipeline view + run form + next-chapter shortcuts.
 *   运行 (run)     — status-filtered run list + run detail with approval.
 * The legacy Main chat tab has been removed (the Main half was being torn down
 * from the Host side); no /main/* HTTP call is issued from this client.
 */
window.__ModuleLoader__.load({
	id: "dsh-bishu-novel",
	factory: (require) => {
		const React = require("react");
		const { createRoot } = require("react-dom/client");
		const { useState, useEffect, useCallback, useRef } = React;

		// ── API ──────────────────────────────────────────────────────
		const API = "/api/dsh-bishu-novel";
		async function api(path, options) {
			const res = await fetch(API + path, options);
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error((body && body.error) || ("HTTP " + res.status));
			return body;
		}
		function get(path, params) {
			const qs = new URLSearchParams();
			for (const [k, v] of Object.entries(params || {})) {
				if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
			}
			const suffix = qs.toString();
			return api(path + (suffix ? "?" + suffix : ""));
		}
		function post(path, body) {
			return api(path, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body || {}),
			});
		}

		function makeController() {
			let open = false;
			const listeners = new Set();
			return {
				toggle() { open = !open; for (const l of listeners) l(); },
				close() { open = false; for (const l of listeners) l(); },
				getSnapshot() { return { panelOpen: open }; },
				subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
			};
		}

		// ── stylesheet ───────────────────────────────────────────────
		const CSS = `
.dsh-bishu-drawer{position:fixed;top:0;right:0;height:100vh;width:560px;max-width:96vw;z-index:1200;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#0f0f0f);border-left:1px solid var(--dsw-alias-border-l1,#2a2a2a);box-shadow:-14px 0 40px rgba(0,0,0,.28);font-family:var(--dsw-font-family,system-ui);color:var(--dsw-alias-label-primary,#eee)}
.dsh-bishu-drawer.dsh-bishu-hidden{display:none}
.dsh-bishu-header{flex:none;display:flex;align-items:center;gap:12px;padding:14px 18px 10px}
.dsh-bishu-title{min-width:0}
.dsh-bishu-title h1{margin:0;font-size:15px;font-weight:700;line-height:1.3}
.dsh-bishu-title p{margin:1px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary,#999)}
.dsh-bishu-spacer{flex:1}
.dsh-bishu-iconbtn{flex:none;width:30px;height:30px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);background:var(--dsw-alias-bg-layer-1,#161616);color:var(--dsw-alias-label-secondary,#999);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .12s ease,color .12s ease}
.dsh-bishu-iconbtn:hover{background:var(--dsw-alias-bg-layer-2,#1e1e1e);color:var(--dsw-alias-label-primary,#eee)}
.dsh-bishu-tabs{flex:none;display:flex;gap:2px;padding:0 18px 10px;border-bottom:1px solid var(--dsw-alias-border-l1,#2a2a2a)}
.dsh-bishu-tab{flex:1;padding:8px 0;border:none;border-radius:8px;background:none;color:var(--dsw-alias-label-secondary,#999);font-size:13px;font-weight:600;cursor:pointer;transition:background .12s ease,color .12s ease}
.dsh-bishu-tab:hover{background:var(--dsw-alias-bg-layer-1,#161616);color:var(--dsw-alias-label-primary,#eee)}
.dsh-bishu-tab.active{background:var(--dsw-alias-bg-layer-1,#161616);color:var(--dsw-alias-label-primary,#eee)}
.dsh-bishu-body{flex:1;overflow:auto;padding:14px 18px 28px;scrollbar-width:thin}
.dsh-bishu-card{background:var(--dsw-alias-bg-layer-1,#161616);border:1px solid var(--dsw-alias-border-l1,#2a2a2a);border-radius:12px;overflow:hidden}
.dsh-bishu-card + .dsh-bishu-card{margin-top:12px}
.dsh-bishu-card-head{display:flex;align-items:center;gap:9px;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l1,#242424)}
.dsh-bishu-card-head .ic{flex:none;width:26px;height:26px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-2,#1e1e1e);color:var(--dsw-alias-brand-primary,#3b82f6)}
.dsh-bishu-card-head h3{margin:0;font-size:13px;font-weight:700}
.dsh-bishu-card-head p{margin:0;font-size:11px;color:var(--dsw-alias-label-secondary,#999)}
.dsh-bishu-card-body{padding:14px 16px}
.dsh-bishu-label{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#bbb);margin:0 0 5px}
.dsh-bishu-label .req{color:var(--dsw-alias-state-error-primary,#ef4444)}
.dsh-bishu-label .vkey{font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);font-size:11px;font-weight:400;color:var(--dsw-alias-label-secondary,#666);margin-left:auto}
.dsh-bishu-input{width:100%;box-sizing:border-box;padding:8px 10px;font-size:13px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);background:var(--dsw-alias-bg-layer-2,#1c1c1c);color:var(--dsw-alias-label-primary,#eee);transition:border-color .12s ease}
.dsh-bishu-input::placeholder{color:var(--dsw-alias-label-secondary,#555)}
.dsh-bishu-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#3b82f6)}
.dsh-bishu-input.err{border-color:var(--dsw-alias-state-error-primary,#ef4444)}
.dsh-bishu-textarea{width:100%;box-sizing:border-box;padding:8px 10px;font-size:13px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);background:var(--dsw-alias-bg-layer-2,#1c1c1c);color:var(--dsw-alias-label-primary,#eee);min-height:72px;resize:vertical;font-family:var(--dsw-font-family,system-ui)}
.dsh-bishu-textarea:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#3b82f6)}
.dsh-bishu-textarea.err{border-color:var(--dsw-alias-state-error-primary,#ef4444)}
.dsh-bishu-desc{font-size:11px;color:var(--dsw-alias-label-secondary,#777);margin:4px 0 0}
.dsh-bishu-field{margin:0 0 12px}
.dsh-bishu-details{margin:0 0 12px}
.dsh-bishu-details summary{cursor:pointer;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#bbb);padding:6px 0;user-select:none}
.dsh-bishu-details summary:hover{color:var(--dsw-alias-label-primary,#eee)}
.dsh-bishu-details[open] summary{margin-bottom:6px}
.dsh-bishu-node{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.dsh-bishu-node .at{flex:none;width:118px;font-size:11px;color:var(--dsw-alias-label-secondary,#bbb);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-bishu-node .dsh-bishu-input{flex:1}
.dsh-bishu-fielderr{font-size:11px;color:var(--dsw-alias-state-error-primary,#ef4444);margin:4px 0 0}
.dsh-bishu-wsrow{display:flex;gap:6px}
.dsh-bishu-wsrow .dsh-bishu-input{flex:1}
.dsh-bishu-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 16px;font-size:13px;font-weight:600;border-radius:8px;border:1px solid transparent;cursor:pointer;transition:opacity .12s ease,filter .12s ease,background .12s ease}
.dsh-bishu-btn:disabled{opacity:.5;cursor:default}
.dsh-bishu-btn-primary{background:var(--dsw-alias-brand-primary,#2563eb);color:#fff;width:100%}
.dsh-bishu-btn-primary:hover:not(:disabled){filter:brightness(1.1)}
.dsh-bishu-btn-ghost{background:var(--dsw-alias-bg-layer-1,#161616);color:var(--dsw-alias-label-primary,#eee);border-color:var(--dsw-alias-border-l1,#2a2a2a)}
.dsh-bishu-btn-ghost:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2,#1e1e1e)}
.dsh-bishu-btn-small{padding:6px 10px;font-size:12px}
.dsh-bishu-error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ef4444) 12%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#ef4444) 40%,transparent);color:var(--dsw-alias-state-error-primary,#ef4444);border-radius:8px;padding:8px 12px;font-size:12px;white-space:pre-wrap;margin-bottom:10px}
.dsh-bishu-empty{color:var(--dsw-alias-label-secondary,#777);font-size:12px;padding:14px 2px;text-align:center}
.dsh-bishu-wfrow{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:8px;cursor:pointer;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);background:var(--dsw-alias-bg-layer-1,#161616);transition:border-color .12s ease,background .12s ease}
.dsh-bishu-wfrow:hover{border-color:var(--dsw-alias-border-l2,#3a3a3a)}
.dsh-bishu-wfrow.selected{border-color:var(--dsw-alias-brand-primary,#3b82f6);background:var(--dsw-alias-bg-layer-2,#1e1e1e)}
.dsh-bishu-wfrow + .dsh-bishu-wfrow{margin-top:6px}
.dsh-bishu-wfrow .id{font-size:13px;font-weight:700}
.dsh-bishu-wfrow .name{font-size:11px;color:var(--dsw-alias-label-secondary,#999);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-bishu-tag{flex:none;font-size:10px;font-weight:600;padding:2px 7px;border-radius:999px}
.dsh-bishu-tag.ok{color:var(--dsw-alias-state-success-primary,#22c55e);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 12%,transparent)}
.dsh-bishu-tag.err{color:var(--dsw-alias-state-error-primary,#ef4444);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ef4444) 12%,transparent)}
.dsh-bishu-tag.run{color:var(--dsw-alias-brand-primary,#3b82f6);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#3b82f6) 12%,transparent)}
.dsh-bishu-tag.wait{color:var(--dsw-alias-label-secondary,#999);background:var(--dsw-alias-bg-layer-2,#1e1e1e)}
.dsh-bishu-tag.warn{color:var(--dsw-alias-state-warn-primary,#eab308);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#eab308) 12%,transparent)}
.dsh-bishu-approve{border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary,#eab308) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#eab308) 8%,transparent);border-radius:10px;padding:12px 14px;margin-top:10px}
.dsh-bishu-approve .head{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--dsw-alias-state-warn-primary,#eab308);margin-bottom:6px}
.dsh-bishu-approve .meta{font-size:11px;color:var(--dsw-alias-label-secondary,#999);margin-bottom:8px}
.dsh-bishu-approve pre{max-height:200px;overflow:auto;background:var(--dsw-alias-bg-layer-2,#1c1c1c);border:1px solid var(--dsw-alias-border-l1,#2a2a2a);border-radius:8px;padding:8px 10px;font-size:11px;white-space:pre-wrap;font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);margin:0 0 8px}
.dsh-bishu-approve .actions{display:flex;gap:6px;margin-top:8px}
.dsh-bishu-check{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#bbb);margin:0 0 12px;cursor:pointer;user-select:none}
.dsh-bishu-check input{accent-color:var(--dsw-alias-brand-primary,#2563eb);width:14px;height:14px;cursor:pointer}
.dsh-bishu-tagbar{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.dsh-bishu-tabpill{padding:5px 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);background:none;color:var(--dsw-alias-label-secondary,#999);font-size:12px;font-weight:600;cursor:pointer;transition:background .12s ease,color .12s ease,border-color .12s ease}
.dsh-bishu-tabpill.active{background:var(--dsw-alias-brand-primary,#2563eb);border-color:var(--dsw-alias-brand-primary,#2563eb);color:#fff}
.dsh-bishu-runrow{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);background:var(--dsw-alias-bg-layer-1,#161616);cursor:pointer;transition:border-color .12s ease,background .12s ease}
.dsh-bishu-runrow:hover{border-color:var(--dsw-alias-border-l2,#3a3a3a)}
.dsh-bishu-runrow + .dsh-bishu-runrow{margin-top:6px}
.dsh-bishu-runrow .main{flex:1;min-width:0}
.dsh-bishu-runrow .wf{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-bishu-runrow .meta{font-size:11px;color:var(--dsw-alias-label-secondary,#999);margin-top:2px;display:flex;gap:8px;flex-wrap:wrap}
.dsh-bishu-runrow .meta .mono{font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace)}
.dsh-bishu-progress{height:5px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,#1e1e1e);overflow:hidden;margin-top:8px}
.dsh-bishu-progress-inner{height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary,#3b82f6);transition:width .3s ease}
.dsh-bishu-banner{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);background:var(--dsw-alias-bg-layer-1,#161616);font-size:13px}
.dsh-bishu-banner .mono{font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);font-size:11px;color:var(--dsw-alias-label-secondary,#999)}
.dsh-bishu-ws-link{display:inline-flex;align-items:center;gap:5px;color:var(--dsw-alias-brand-primary,#3b82f6);cursor:pointer;font-size:12px;border-radius:6px;padding:2px 4px}
.dsh-bishu-ws-link:hover{background:var(--dsw-alias-bg-layer-2,#1e1e1e);text-decoration:underline}
.dsh-bishu-ws-link .p{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-bishu-steps{margin-top:10px;display:flex;flex-direction:column}
.dsh-bishu-step{display:flex;align-items:flex-start;gap:10px;padding:8px 4px;font-size:12px;flex-direction:column;align-items:stretch}
.dsh-bishu-step + .dsh-bishu-step{border-top:1px solid var(--dsw-alias-border-l1,#242424)}
.dsh-bishu-step-head{display:flex;align-items:center;gap:10px}
.dsh-bishu-step-status{flex:none;width:8px;height:8px;border-radius:50%}
.dsh-bishu-step-name{flex:1;color:var(--dsw-alias-label-primary,#eee);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-bishu-step-link{flex:none;font-size:11px;color:var(--dsw-alias-brand-primary,#3b82f6);cursor:pointer;background:none;border:none;padding:2px 6px;border-radius:6px}
.dsh-bishu-step-link:hover{background:var(--dsw-alias-bg-layer-2,#1e1e1e)}
.dsh-bishu-step-error{margin:6px 0 0 18px;font-size:11px;color:var(--dsw-alias-state-error-primary,#ef4444);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ef4444) 10%,transparent);border-radius:6px;padding:6px 10px;white-space:pre-wrap;font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);max-height:160px;overflow:auto}
.dsh-bishu-file{display:flex;align-items:center;gap:8px;padding:7px 4px;font-size:12px;color:var(--dsw-alias-brand-primary,#3b82f6);cursor:pointer;border-radius:6px}
.dsh-bishu-file:hover{background:var(--dsw-alias-bg-layer-1,#161616)}
.dsh-bishu-artifact{background:var(--dsw-alias-bg-layer-1,#161616);border:1px solid var(--dsw-alias-border-l1,#2a2a2a);border-radius:8px;padding:10px 12px;max-height:300px;overflow:auto;font-size:12px;line-height:1.5;white-space:pre-wrap;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace)}
.dsh-bishu-back{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);background:var(--dsw-alias-bg-layer-1,#161616);color:var(--dsw-alias-label-secondary,#bbb);font-size:12px;font-weight:600;cursor:pointer}
.dsh-bishu-back:hover{background:var(--dsw-alias-bg-layer-2,#1e1e1e);color:var(--dsw-alias-label-primary,#eee)}
.dsh-bishu-toast{position:fixed;bottom:20px;right:580px;z-index:1500;max-width:380px;padding:9px 14px;border-radius:8px;font-size:12px;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;gap:8px}
.dsh-bishu-toast.ok{background:var(--dsw-alias-bg-overlay,#1c1c1c);border:1px solid var(--dsw-alias-border-l1,#2a2a2a);color:var(--dsw-alias-state-success-primary,#22c55e)}
.dsh-bishu-toast.warn{background:var(--dsw-alias-bg-overlay,#1c1c1c);border:1px solid var(--dsw-alias-border-l1,#2a2a2a);color:var(--dsw-alias-state-warn-primary,#eab308)}
.dsh-bishu-toast.error{background:var(--dsw-alias-bg-overlay,#1c1c1c);border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#ef4444) 45%,transparent);color:var(--dsw-alias-state-error-primary,#ef4444)}
.dsh-bishu-toast .x{cursor:pointer;background:none;border:none;color:inherit;font-size:14px;line-height:1;padding:0 2px;opacity:.7}
.dsh-bishu-toast .x:hover{opacity:1}
.dsh-bishu-entry{width:100%;height:32px;color:var(--dsw-alias-label-secondary,#999);cursor:pointer;white-space:nowrap;background:none;border:none;border-radius:8px;display:flex;align-items:center;gap:8px;padding:0 12px;font-size:13px;font-family:var(--dsw-font-family,system-ui)}
.dsh-bishu-entry:hover{background:var(--dsw-specific-sidebar-nav-item-hover,#1e1e1e);color:var(--dsw-alias-label-primary,#eee)}
.dsh-bishu-entry[data-active]{background:var(--dsw-specific-sidebar-nav-item-active,#232323);color:var(--dsw-alias-label-primary,#eee);font-weight:600}
.dsh-bishu-entry-icon{flex:none;display:inline-flex;justify-content:center;align-items:center}
.dsh-bishu-entry-label{text-overflow:ellipsis;overflow:hidden}
[data-dsh-frame][data-sidebar-collapsed] .dsh-bishu-entry{justify-content:center;width:100%;padding:0}
[data-dsh-frame][data-sidebar-collapsed] .dsh-bishu-entry-label{display:none}
.dsh-bishu-errbar{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.dsh-bishu-errbar .row{display:flex;align-items:flex-start;gap:8px}
.dsh-bishu-errbar .row .x{flex:none;background:none;border:none;color:var(--dsw-alias-state-error-primary,#ef4444);cursor:pointer;font-size:14px;line-height:1;padding:0 4px;opacity:.75}
.dsh-bishu-errbar .row .x:hover{opacity:1}
.dsh-bishu-errbar .row .t{flex:1;font-size:12px;white-space:pre-wrap}
.dsh-bishu-pipeline{display:flex;flex-wrap:wrap;gap:6px;align-items:stretch}
.dsh-bishu-stage{flex:1;min-width:90px;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);background:var(--dsw-alias-bg-layer-2,#1c1c1c);border-radius:10px;padding:10px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;position:relative}
.dsh-bishu-stage.done{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 8%,transparent)}
.dsh-bishu-stage.partial{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#eab308) 45%,transparent)}
.dsh-bishu-stage-icon{width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;background:var(--dsw-alias-bg-layer-1,#161616);color:var(--dsw-alias-label-secondary,#999);border:1px solid var(--dsw-alias-border-l1,#2a2a2a)}
.dsh-bishu-stage.done .dsh-bishu-stage-icon{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 25%,transparent);color:var(--dsw-alias-state-success-primary,#22c55e);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 60%,transparent)}
.dsh-bishu-stage.partial .dsh-bishu-stage-icon{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#eab308) 25%,transparent);color:var(--dsw-alias-state-warn-primary,#eab308);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#eab308) 60%,transparent)}
.dsh-bishu-stage-label{font-size:11px;font-weight:600;color:var(--dsw-alias-label-primary,#eee)}
.dsh-bishu-stage-files{font-size:10px;color:var(--dsw-alias-label-secondary,#888);font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);word-break:break-all;line-height:1.4}
.dsh-bishu-stage-arrow{display:flex;align-items:center;color:var(--dsw-alias-label-secondary,#666);font-size:14px;flex:none}
.dsh-bishu-stage-arrow svg{display:block}
.dsh-bishu-next-card{padding:6px 4px}
.dsh-bishu-next-card .hint{font-size:11px;color:var(--dsw-alias-label-secondary,#888);margin-bottom:8px}
.dsh-bishu-quickrow{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.dsh-bishu-quickrow .dsh-bishu-btn{flex:1;min-width:88px;width:auto}
.dsh-bishu-md{background:var(--dsw-alias-bg-layer-2,#1c1c1c);border:1px solid var(--dsw-alias-border-l1,#2a2a2a);border-radius:8px;padding:10px 14px;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-primary,#eee);max-height:300px;overflow:auto}
.dsh-bishu-md h1,.dsh-bishu-md h2,.dsh-bishu-md h3,.dsh-bishu-md h4,.dsh-bishu-md h5,.dsh-bishu-md h6{margin:8px 0 6px;font-size:13px;font-weight:700;line-height:1.3}
.dsh-bishu-md h1{font-size:15px}
.dsh-bishu-md h2{font-size:14px}
.dsh-bishu-md p{margin:6px 0}
.dsh-bishu-md ul,.dsh-bishu-md ol{margin:6px 0;padding-left:20px}
.dsh-bishu-md li{margin:2px 0}
.dsh-bishu-md code{background:var(--dsw-alias-bg-layer-1,#161616);padding:1px 5px;border-radius:4px;font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);font-size:11px}
.dsh-bishu-md pre{background:var(--dsw-alias-bg-layer-1,#161616);border:1px solid var(--dsw-alias-border-l1,#2a2a2a);border-radius:6px;padding:8px 10px;font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);font-size:11px;white-space:pre-wrap;margin:6px 0;overflow:auto}
.dsh-bishu-md pre code{background:none;padding:0}
.dsh-bishu-md blockquote{border-left:3px solid var(--dsw-alias-border-l2,#3a3a3a);margin:6px 0;padding:2px 10px;color:var(--dsw-alias-label-secondary,#bbb);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#161616) 60%,transparent)}
.dsh-bishu-md strong{font-weight:700}
.dsh-bishu-md em{font-style:italic;color:var(--dsw-alias-label-secondary,#ddd)}
.dsh-bishu-pipelinegroup{margin-top:10px}
.dsh-bishu-pipelinegroup .gtitle{font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary,#888);margin:0 0 8px;letter-spacing:.5px;text-transform:uppercase}
.dsh-bishu-recent{margin-top:8px}
.dsh-bishu-recent .lbl{font-size:11px;color:var(--dsw-alias-label-secondary,#888);margin-bottom:4px}
.dsh-bishu-recent select{appearance:auto}
.dsh-bishu-approve-md{background:var(--dsw-alias-bg-layer-2,#1c1c1c);border:1px solid var(--dsw-alias-border-l1,#2a2a2a);border-radius:8px;padding:8px 12px;font-size:11px;line-height:1.5;max-height:200px;overflow:auto;margin:0 0 8px}
.dsh-bishu-step-actions{display:flex;gap:6px;align-items:center;margin-left:auto}

/* viewtoggle (preview/source/edit 三态切换)，OverlayReader 复用 */
.dsh-bishu-reader-savestatus{flex:none;font-size:11px;font-weight:600;padding:4px 9px;border-radius:6px;max-width:38ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-flex;align-items:center;gap:5px}
.dsh-bishu-reader-savestatus.saving{color:var(--dsw-alias-label-secondary,#999);background:var(--dsw-alias-bg-layer-2,#1e1e1e)}
.dsh-bishu-reader-savestatus.ok{color:var(--dsw-alias-state-success-primary,#22c55e);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 12%,transparent)}
.dsh-bishu-reader-savestatus.err{color:var(--dsw-alias-state-error-primary,#ef4444);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ef4444) 12%,transparent)}
.dsh-bishu-reader-savestatus .spin{display:inline-block;width:10px;height:10px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:dsh-bishu-spin .8s linear infinite}
@keyframes dsh-bishu-spin{to{transform:rotate(360deg)}}
.dsh-bishu-viewtoggle{display:inline-flex;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);border-radius:6px;overflow:hidden;flex:none}
.dsh-bishu-viewtoggle button{padding:4px 9px;font-size:11px;font-weight:600;background:none;border:none;color:var(--dsw-alias-label-secondary,#999);cursor:pointer;transition:background .12s ease,color .12s ease}
.dsh-bishu-viewtoggle button + button{border-left:1px solid var(--dsw-alias-border-l1,#2a2a2a)}
.dsh-bishu-viewtoggle button:hover{background:var(--dsw-alias-bg-layer-2,#1e1e1e);color:var(--dsw-alias-label-primary,#eee)}
.dsh-bishu-viewtoggle button.active{background:var(--dsw-alias-brand-primary,#2563eb);color:#fff}

/* overlay reader — full-height right-anchored slide-in panel
 * 阅读窗主题：整页米白书页 + sans-serif 标题 / 衬线正文；与 DSH 深色 GUI 形成"打开一本书"心智。
 * 字体层级：标题走 "PingFang SC","Microsoft YaHei",sans-serif 黑体栈 + font-weight:700；
 *           正文/编辑统一走 Noto Sans SC / Microsoft YaHei 无衬线栈（屏幕阅读最优），16px / line-height 1.9；
 *           代码/路径走 monospace 栈。
 * 布局链：.dsh-bishu-reader { position:fixed; height:100dvh; display:flex; flex-direction:column; }
 *         .dsh-bishu-reader-header { flex:none; }            —— 不伸缩
 *         .dsh-bishu-reader-body { flex:1 1 0; min-height:0; overflow:auto; }
 *                                                              —— 真正占满 header 以下剩余高度
 */
.dsh-bishu-reader-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1350;opacity:0;pointer-events:none;transition:opacity .18s ease-out}
.dsh-bishu-reader-overlay.open{opacity:1;pointer-events:auto}
.dsh-bishu-reader-overlay .dsh-bishu-reader-backdrop{position:absolute;inset:0;cursor:pointer}
.dsh-bishu-reader{position:fixed;top:0;right:0;height:100vh;height:100dvh;min-height:0;width:min(920px,72vw);max-width:96vw;z-index:1400;background:#f7f5f0;border-left:1px solid #e3ddd2;box-shadow:-14px 0 40px rgba(0,0,0,.32);font-family:"Noto Sans SC","Source Han Sans CN","Microsoft YaHei","PingFang SC","Hiragino Sans GB",sans-serif;color:#1f1f1f;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .18s ease-out}
.dsh-bishu-reader.open{transform:translateX(0)}
.dsh-bishu-reader-header{flex:none;display:flex;align-items:center;gap:10px;padding:14px 28px;border-bottom:1px solid #e3ddd2;background:#f7f5f0}
.dsh-bishu-reader-header .dsh-bishu-btn,.dsh-bishu-reader-header .dsh-bishu-btn-primary,.dsh-bishu-reader-header .dsh-bishu-btn-ghost,.dsh-bishu-reader-header .dsh-bishu-btn-small{flex:none;width:auto}
.dsh-bishu-reader-header .dsh-bishu-tag{flex:none}
.dsh-bishu-reader-header .dsh-bishu-reader-title{flex:1;min-width:0}
.dsh-bishu-reader-header .dsh-bishu-reader-title h1{margin:0;font-size:18px;font-weight:700;line-height:1.4;color:#1f1f1f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:"PingFang SC","Microsoft YaHei","Source Han Sans SC","Noto Sans SC","Hiragino Sans GB",sans-serif;font-style:normal}
.dsh-bishu-reader-header .dsh-bishu-reader-title p{margin:4px 0 0;font-size:11px;color:#888;font-family:ui-monospace,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-bishu-reader-header .dsh-bishu-reader-stats{margin:4px 0 0;font-size:11px;color:#888;display:flex;gap:14px;flex-wrap:wrap;line-height:1.5}
.dsh-bishu-reader-header .dsh-bishu-reader-stats .num{color:#1f1f1f;font-weight:700;font-family:ui-monospace,Menlo,monospace}
/* body：flex:1 1 0 让收缩预测稳定；min-height:0 解除默认内容最小尺寸；overflow:auto 把滚动条收在 body 右缘 */
.dsh-bishu-reader-body{flex:1 1 0;min-height:0;overflow:auto;padding:40px 44px 80px;font-size:16px;line-height:1.9;scrollbar-width:thin;background:#f7f5f0;color:#1f1f1f;font-family:"Noto Sans SC","Source Han Sans CN","Microsoft YaHei","PingFang SC","Hiragino Sans GB",sans-serif;font-style:normal}
.dsh-bishu-reader-body::-webkit-scrollbar{width:10px;height:10px}
.dsh-bishu-reader-body::-webkit-scrollbar-thumb{background:#d8d2c4;border-radius:6px}
.dsh-bishu-reader-body::-webkit-scrollbar-track{background:transparent}
.dsh-bishu-reader-body .dsh-bishu-reader-prose{max-width:76ch;margin:0 auto}
/* 第一个元素消除与 header 标题的视觉重叠（保留文档自身 h1，仅去掉段前距） */
.dsh-bishu-reader-body .dsh-bishu-reader-prose > :first-child{margin-top:0}
/* 标题层级：sans-serif 黑体栈 + 700 */
.dsh-bishu-reader-body h1{font-family:"PingFang SC","Microsoft YaHei","Source Han Sans SC","Noto Sans SC","Hiragino Sans GB",sans-serif;font-size:24px;font-weight:700;line-height:1.4;margin:0 0 18px;padding-bottom:12px;border-bottom:1px solid #e3ddd2;color:#1f1f1f;font-style:normal}
.dsh-bishu-reader-body h2{font-family:"PingFang SC","Microsoft YaHei","Source Han Sans SC","Noto Sans SC","Hiragino Sans GB",sans-serif;font-size:20px;font-weight:700;line-height:1.4;margin:36px 0 14px;padding-bottom:8px;border-bottom:1px solid #e3ddd2;color:#1f1f1f;font-style:normal}
.dsh-bishu-reader-body h3{font-family:"PingFang SC","Microsoft YaHei","Source Han Sans SC","Noto Sans SC","Hiragino Sans GB",sans-serif;font-size:17px;font-weight:700;line-height:1.4;margin:28px 0 12px;color:#1f1f1f;font-style:normal}
.dsh-bishu-reader-body h4{font-family:"PingFang SC","Microsoft YaHei","Source Han Sans SC","Noto Sans SC","Hiragino Sans GB",sans-serif;font-size:15px;font-weight:700;line-height:1.4;margin:22px 0 10px;color:#555;font-style:normal}
.dsh-bishu-reader-body .dsh-bishu-reader-essence{margin:0 0 24px;padding:4px 0 4px 18px;border-left:3px solid #3b82f6;background:none;font-size:16px;line-height:1.9;color:#333;font-style:normal}
.dsh-bishu-reader-body .dsh-bishu-reader-paragraph{margin:1em 0;white-space:pre-wrap;word-break:break-word;font-style:normal}
.dsh-bishu-reader-body .dsh-bishu-reader-list{margin:1em 0 1.1em;padding-left:24px}
.dsh-bishu-reader-body .dsh-bishu-reader-list li{margin:6px 0;line-height:1.85}
.dsh-bishu-reader-body .dsh-bishu-reader-kv{margin:8px 0;font-size:13.5px;color:#666;display:flex;gap:8px;line-height:1.7}
.dsh-bishu-reader-body .dsh-bishu-reader-kv .k{flex:none;color:#888;font-weight:600;min-width:120px}
.dsh-bishu-reader-body .dsh-bishu-reader-kv .v{flex:1;color:#1f1f1f;word-break:break-word}
.dsh-bishu-reader-body .dsh-bishu-reader-table-wrap{margin:16px 0;overflow:auto}
.dsh-bishu-reader-body .dsh-bishu-reader-table{width:100%;border-collapse:collapse;font-size:13.5px}
.dsh-bishu-reader-body .dsh-bishu-reader-table th,.dsh-bishu-reader-body .dsh-bishu-reader-table td{border:1px solid #e3ddd2;padding:10px 14px;vertical-align:top;text-align:left;line-height:1.7}
.dsh-bishu-reader-body .dsh-bishu-reader-table th{background:#ece6d6;font-weight:700;color:#1f1f1f;white-space:nowrap}
.dsh-bishu-reader-body .dsh-bishu-reader-cards{display:flex;flex-direction:column;gap:14px;margin:16px 0}
.dsh-bishu-reader-body .dsh-bishu-reader-card{border:1px solid #e3ddd2;border-radius:10px;background:#fafaf6;padding:16px 20px}
.dsh-bishu-reader-body .dsh-bishu-reader-card-title{font-size:15px;font-weight:700;color:#1f1f1f;margin:0 0 10px;display:flex;align-items:center;gap:6px}
.dsh-bishu-reader-body .dsh-bishu-reader-card-title .ix{flex:none;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#888;font-weight:400;background:#ece6d6;padding:2px 6px;border-radius:4px}
.dsh-bishu-reader-body .dsh-bishu-reader-card-row{display:flex;gap:10px;margin:6px 0;font-size:13.5px;line-height:1.75}
.dsh-bishu-reader-body .dsh-bishu-reader-card-row .ck{flex:none;min-width:64px;color:#888;font-weight:600}
.dsh-bishu-reader-body .dsh-bishu-reader-card-row .cv{flex:1;color:#1f1f1f;white-space:pre-wrap;word-break:break-word}
.dsh-bishu-reader-body .dsh-bishu-reader-empty{color:#999;font-size:14px;padding:60px 24px;text-align:center}
/* reader-body 内用 dsh-bishu-empty 时的米色场景配色（覆盖顶层抽屉深色配色） */
.dsh-bishu-reader-body .dsh-bishu-empty{color:#888;font-size:13px;padding:24px;text-align:center}
/* Markdown 内嵌表格（renderMarkdown 输出的 pipe 表格）—— 与 .dsh-bishu-reader-table 同款米白风 */
.dsh-bishu-reader-body .dsh-bishu-reader-md table,.dsh-bishu-reader-body .dsh-bishu-md table{width:100%;border-collapse:collapse;font-size:13.5px;margin:12px 0}
.dsh-bishu-reader-body .dsh-bishu-reader-md th,.dsh-bishu-reader-body .dsh-bishu-md th,.dsh-bishu-reader-body .dsh-bishu-reader-md td,.dsh-bishu-reader-body .dsh-bishu-md td{border:1px solid #e3ddd2;padding:10px 14px;vertical-align:top;text-align:left;line-height:1.7;color:#1f1f1f}
.dsh-bishu-reader-body .dsh-bishu-reader-md th,.dsh-bishu-reader-body .dsh-bishu-md th{background:#ece6d6;font-weight:700;color:#1f1f1f;white-space:nowrap}
.dsh-bishu-reader-body .dsh-bishu-reader-md p:last-child,.dsh-bishu-reader-body .dsh-bishu-md p:last-child{margin-bottom:0}
.dsh-bishu-reader-body .dsh-bishu-reader-fallback{font-family:ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.7;color:#1f1f1f;background:#ece6d6;border:1px solid #e3ddd2;border-radius:8px;padding:16px 20px;margin:0;overflow:auto}
/* md 容器：彻底中和旧 .dsh-bishu-md 卡片样式（背景/边框/圆角/内边距 + 关键的 max-height:300px 裁剪与内部滚动），与 body 融为一体 */
.dsh-bishu-reader-body .dsh-bishu-reader-md{background:none;border:none;border-radius:0;padding:0;max-height:none;overflow:visible;max-width:none;margin:0;font-family:"Noto Sans SC","Source Han Sans CN","Microsoft YaHei","PingFang SC","Hiragino Sans GB",sans-serif;font-size:16px;line-height:1.9;color:#1f1f1f;font-style:normal}
.dsh-bishu-reader-body .dsh-bishu-reader-md h1{font-family:"PingFang SC","Microsoft YaHei","Source Han Sans SC","Noto Sans SC","Hiragino Sans GB",sans-serif;font-size:24px;font-weight:700;line-height:1.4;margin:0 0 18px;padding-bottom:10px;color:#1f1f1f;font-style:normal}
.dsh-bishu-reader-body .dsh-bishu-reader-md h2{font-family:"PingFang SC","Microsoft YaHei","Source Han Sans SC","Noto Sans SC","Hiragino Sans GB",sans-serif;font-size:20px;font-weight:700;line-height:1.4;margin:32px 0 12px;padding-bottom:6px;color:#1f1f1f;font-style:normal}
.dsh-bishu-reader-body .dsh-bishu-reader-md h3{font-family:"PingFang SC","Microsoft YaHei","Source Han Sans SC","Noto Sans SC","Hiragino Sans GB",sans-serif;font-size:17px;font-weight:700;line-height:1.4;margin:24px 0 10px;color:#1f1f1f;font-style:normal}
.dsh-bishu-reader-body .dsh-bishu-reader-md h4{font-family:"PingFang SC","Microsoft YaHei","Source Han Sans SC","Noto Sans SC","Hiragino Sans GB",sans-serif;font-size:15px;font-weight:700;line-height:1.4;margin:20px 0 8px;color:#555;font-style:normal}
.dsh-bishu-reader-body .dsh-bishu-reader-md p{margin:1em 0;text-indent:0;font-style:normal}
.dsh-bishu-reader-body .dsh-bishu-reader-md ul,.dsh-bishu-reader-body .dsh-bishu-reader-md ol{margin:1em 0;padding-left:26px}
.dsh-bishu-reader-body .dsh-bishu-reader-md li{margin:6px 0;line-height:1.85;font-style:normal}
.dsh-bishu-reader-body .dsh-bishu-reader-md blockquote{margin:18px 0;padding:4px 0 4px 18px;border-left:3px solid #3b82f6;background:none;font-style:normal;color:#333}
.dsh-bishu-reader-body .dsh-bishu-reader-md em{font-style:normal;color:inherit}
.dsh-bishu-reader-body .dsh-bishu-reader-md code{font-size:.92em;background:#ece6d6;padding:1px 6px;border-radius:4px;color:#1f1f1f;font-style:normal}
.dsh-bishu-reader-body .dsh-bishu-reader-md pre{font-size:13px;background:#ece6d6;padding:14px 16px;border-radius:8px;border:1px solid #e3ddd2;overflow:auto;line-height:1.65;margin:1em 0;color:#1f1f1f}
.dsh-bishu-reader-body .dsh-bishu-reader-md pre code{background:none;padding:0;font-style:normal}
.dsh-bishu-reader-body .dsh-bishu-reader-md strong{color:#1f1f1f;font-style:normal;font-weight:700}
/* 阅读窗就地编辑片段：每块一个轻卡片，悬停浮现编辑按钮；进入编辑后变 textarea + ✓/× */
.dsh-bishu-reader-body .dsh-bishu-blk{position:relative;border-radius:8px;padding:2px 10px;margin:0 -10px;transition:background .12s ease}
.dsh-bishu-reader-body .dsh-bishu-blk:hover{background:color-mix(in srgb,#3b82f6 5%,transparent)}
.dsh-bishu-reader-body .dsh-bishu-blk.editing{background:color-mix(in srgb,#3b82f6 6%,transparent);padding:8px 10px}
.dsh-bishu-reader-body .dsh-bishu-blk-html > :first-child{margin-top:0}
.dsh-bishu-reader-body .dsh-bishu-blk-html > :last-child{margin-bottom:0}
.dsh-bishu-reader-body .dsh-bishu-blk-edit{position:absolute;top:4px;right:6px;opacity:0;background:#fff;border:1px solid #e3ddd2;color:#6b6455;font-size:11px;font-weight:600;padding:3px 9px;border-radius:6px;cursor:pointer;font-family:inherit;line-height:1.4;box-shadow:0 1px 3px rgba(0,0,0,.08);transition:opacity .12s ease,background .12s ease,color .12s ease}
.dsh-bishu-reader-body .dsh-bishu-blk:hover .dsh-bishu-blk-edit,.dsh-bishu-reader-body .dsh-bishu-blk-edit:focus-visible{opacity:1}
.dsh-bishu-reader-body .dsh-bishu-blk-edit:hover{background:#ece6d6;color:#1f1f1f}
.dsh-bishu-reader-body .dsh-bishu-blk-textarea{width:100%;box-sizing:border-box;min-height:96px;font-family:"Noto Sans SC","Source Han Sans CN","Microsoft YaHei","PingFang SC",sans-serif}
.dsh-bishu-reader-body .dsh-bishu-blk-actions{display:flex;gap:8px;margin-top:8px;justify-content:flex-end}
/* JSON 六维预览小节：可点击跳转回表单对应字段 */
.dsh-bishu-reader-prose .dsh-bishu-sec{margin:0 -8px;padding:4px 8px;border-radius:6px;transition:background .12s ease}
.dsh-bishu-reader-prose .dsh-bishu-sec-clickable{cursor:pointer}
.dsh-bishu-reader-prose .dsh-bishu-sec-clickable:hover{background:color-mix(in srgb,#3b82f6 5%,transparent)}
.dsh-bishu-reader-prose .dsh-bishu-reader-essence.dsh-bishu-sec-clickable:hover{background:color-mix(in srgb,#3b82f6 6%,transparent)}
/* 编辑态：textarea 与米白阅读底协调 */
.dsh-bishu-reader-body .dsh-bishu-reader-edit{display:flex;flex-direction:column;gap:10px;max-width:76ch;margin:0 auto}
/* 编辑即阅读板：md 等文本与预览同版式（无衬线 16px/1.9、76ch 居中），无边框融入书页；> 直接子级限定，避免影响表单编辑器内的输入框 */
.dsh-bishu-reader-body .dsh-bishu-reader-edit > textarea{width:100%;box-sizing:border-box;min-height:calc(100dvh - 240px);padding:0;border:none;background:transparent;color:#1f1f1f;font-family:"Noto Sans SC","Source Han Sans CN","Microsoft YaHei","PingFang SC","Hiragino Sans GB",sans-serif;font-size:16px;line-height:1.9;resize:none;outline:none;caret-color:#2563eb;tab-size:2}
.dsh-bishu-reader-body .dsh-bishu-reader-edit > textarea::placeholder{color:#a8a090}
.dsh-bishu-reader-body .dsh-bishu-reader-edit > textarea::selection{background:color-mix(in srgb,#3b82f6 22%,transparent)}
/* 非六维 JSON 等结构化内容保持等宽对齐 + 轻卡片 */
.dsh-bishu-reader-body .dsh-bishu-reader-edit.json > textarea{padding:16px 18px;border:1px solid #e3ddd2;border-radius:10px;background:#fafaf6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13.5px;line-height:1.75}
.dsh-bishu-reader-body .dsh-bishu-reader-edit.json > textarea:focus{border-color:#3b82f6}
.dsh-bishu-reader-body .dsh-bishu-reader-edit-err{background:color-mix(in srgb,#ef4444 12%,#f7f5f0);border:1px solid color-mix(in srgb,#ef4444 40%,transparent);color:#b91c1c;border-radius:8px;padding:8px 12px;font-size:12px;white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace}
/* 六维 JSON 表单编辑器：书页上的填写体验，不直面 JSON 源码 */
.dsh-bishu-reader-form{display:flex;flex-direction:column;gap:22px}
.dsh-bishu-ff{display:flex;flex-direction:column;gap:8px}
.dsh-bishu-ff-label{font-family:"Noto Sans SC","Source Han Sans CN","Microsoft YaHei","PingFang SC",sans-serif;font-size:13px;font-weight:700;color:#6b6455;letter-spacing:.02em}
.dsh-bishu-ff-text{width:100%;box-sizing:border-box;background:#fff;border:1px solid #e3ddd2;border-radius:8px;padding:10px 14px;font-size:15px;line-height:1.8;color:#1f1f1f;font-family:"Noto Sans SC","Source Han Sans CN","Microsoft YaHei","PingFang SC",sans-serif;resize:vertical;outline:none;transition:border-color .12s ease,box-shadow .12s ease}
.dsh-bishu-ff-text:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}
.dsh-bishu-ff-list{display:flex;flex-direction:column;gap:8px}
.dsh-bishu-ff-listrow{display:flex;gap:8px;align-items:flex-start}
.dsh-bishu-ff-listrow .ix{flex:none;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#888;background:#ece6d6;padding:2px 6px;border-radius:4px;margin-top:12px}
.dsh-bishu-ff-listrow .dsh-bishu-ff-text{flex:1}
.dsh-bishu-ff-del{flex:none;border:none;background:none;color:#b91c1c;cursor:pointer;font-size:15px;padding:8px 6px;border-radius:6px;line-height:1}
.dsh-bishu-ff-del:hover{background:#f3e8e6}
.dsh-bishu-ff-add{align-self:flex-start;border:1px dashed #d8d2c4;background:none;color:#6b6455;font-size:13px;padding:7px 14px;border-radius:8px;cursor:pointer;font-family:"Noto Sans SC","Microsoft YaHei",sans-serif}
.dsh-bishu-ff-add:hover{background:#ece6d6;color:#1f1f1f}
.dsh-bishu-ff-cards{display:flex;flex-direction:column;gap:14px}
.dsh-bishu-ff-card{border:1px solid #e3ddd2;border-radius:10px;background:#fafaf6;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.dsh-bishu-ff-card-head{display:flex;align-items:center;gap:8px}
.dsh-bishu-ff-card-head .ix{flex:none;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#888;background:#ece6d6;padding:2px 6px;border-radius:4px}
.dsh-bishu-ff-card-head .t{flex:1;font-weight:700;font-size:14px;color:#1f1f1f;font-family:"Noto Sans SC","Microsoft YaHei",sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-bishu-ff-card-row{display:flex;flex-direction:column;gap:4px}
.dsh-bishu-ff-card-row label{font-size:12px;color:#888;font-weight:600;font-family:"Noto Sans SC","Microsoft YaHei",sans-serif}
/* reader 作用域下：按钮 / 视图切换 / 图标按钮在米白阅读底上的反色 */
.dsh-bishu-reader .dsh-bishu-btn-ghost{background:#fafaf6;color:#1f1f1f;border-color:#e3ddd2}
.dsh-bishu-reader .dsh-bishu-btn-ghost:hover:not(:disabled){background:#ece6d6}
.dsh-bishu-reader .dsh-bishu-iconbtn{border-color:#e3ddd2;background:#fafaf6;color:#666}
.dsh-bishu-reader .dsh-bishu-iconbtn:hover{background:#ece6d6;color:#1f1f1f}
.dsh-bishu-reader .dsh-bishu-viewtoggle{border-color:#e3ddd2;background:#fafaf6}
.dsh-bishu-reader .dsh-bishu-viewtoggle button{color:#666}
.dsh-bishu-reader .dsh-bishu-viewtoggle button:hover{background:#ece6d6;color:#1f1f1f}
.dsh-bishu-reader .dsh-bishu-viewtoggle button + button{border-left-color:#e3ddd2}
.dsh-bishu-reader .dsh-bishu-viewtoggle button.active{background:#2563eb;color:#fff}
/* entry row hover 微调：去掉旧 expanded 的内嵌 panel 暗示 */
.dsh-bishu-entry-row.expanded{background:var(--dsw-alias-bg-layer-1,#161616);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#3b82f6) 35%,transparent);border-left:2px solid var(--dsw-alias-brand-primary,#3b82f6);padding-left:6px}

/* product browser v3 — semantic groups accordion */
.dsh-bishu-accordion{display:flex;flex-direction:column;gap:10px}
.dsh-bishu-accordion-group{border:1px solid var(--dsw-alias-border-l1,#2a2a2a);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#1c1c1c);overflow:hidden}
.dsh-bishu-accordion-head{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;user-select:none;border-bottom:1px solid transparent;transition:background .12s ease,border-color .12s ease}
.dsh-bishu-accordion-head:hover{background:var(--dsw-alias-bg-layer-1,#161616)}
.dsh-bishu-accordion-head.open{border-bottom-color:var(--dsw-alias-border-l1,#2a2a2a)}
.dsh-bishu-accordion-head .ic{flex:none;width:22px;height:22px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-1,#161616);font-size:12px}
.dsh-bishu-accordion-head .name{flex:1;font-size:13px;font-weight:700;color:var(--dsw-alias-label-primary,#eee)}
.dsh-bishu-accordion-head .prog{font-size:10px;font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);color:var(--dsw-alias-label-secondary,#999);background:var(--dsw-alias-bg-layer-1,#161616);padding:2px 7px;border-radius:999px}
.dsh-bishu-accordion-head.prog-done .prog{color:var(--dsw-alias-state-success-primary,#22c55e);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 12%,transparent)}
.dsh-bishu-accordion-head .chv{flex:none;color:var(--dsw-alias-label-secondary,#777);display:inline-flex}
.dsh-bishu-accordion-entries{padding:4px 6px 8px}
.dsh-bishu-entry-row{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;font-size:12px;color:var(--dsw-alias-label-primary,#eee);cursor:pointer;border:1px solid transparent;transition:background .12s ease,border-color .12s ease;position:relative}
.dsh-bishu-entry-row + .dsh-bishu-entry-row{margin-top:2px}
.dsh-bishu-entry-row:hover:not(.disabled){background:var(--dsw-alias-bg-layer-1,#161616)}
.dsh-bishu-entry-row.expanded{background:var(--dsw-alias-bg-layer-1,#161616);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#3b82f6) 35%,transparent);border-left:2px solid var(--dsw-alias-brand-primary,#3b82f6);padding-left:6px}
.dsh-bishu-entry-row.disabled{opacity:.55;cursor:default}
.dsh-bishu-entry-dot{flex:none;width:8px;height:8px;border-radius:50%;display:inline-block}
.dsh-bishu-entry-dot.done{background:var(--dsw-alias-state-success-primary,#22c55e);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 20%,transparent)}
.dsh-bishu-entry-dot.miss{background:var(--dsw-alias-border-l2,#3a3a3a)}
.dsh-bishu-entry-name{flex:1;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-bishu-entry-meta{flex:none;font-size:10px;color:var(--dsw-alias-label-secondary,#888);font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);margin-left:6px;white-space:nowrap}
.dsh-bishu-entry-meta .bytes{color:var(--dsw-alias-label-primary,#bbb)}
.dsh-bishu-entry-goto{flex:none;font-size:10px;font-weight:600;padding:3px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);background:var(--dsw-alias-bg-layer-1,#161616);color:var(--dsw-alias-brand-primary,#3b82f6);cursor:pointer;transition:background .12s ease,border-color .12s ease}
.dsh-bishu-entry-goto:hover{background:var(--dsw-alias-bg-layer-2,#1e1e1e);border-color:var(--dsw-alias-brand-primary,#3b82f6)}
.dsh-bishu-entry-sublist{margin:2px 0 4px 22px;padding-left:10px;border-left:1px dashed var(--dsw-alias-border-l1,#2a2a2a);display:flex;flex-direction:column;gap:1px}
.dsh-bishu-entry-sub{display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:6px;font-size:11px;color:var(--dsw-alias-label-secondary,#bbb);cursor:pointer;transition:background .12s ease,color .12s ease}
.dsh-bishu-entry-sub:hover{background:var(--dsw-alias-bg-layer-1,#161616);color:var(--dsw-alias-label-primary,#eee)}
.dsh-bishu-entry-sub.active{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#3b82f6) 18%,transparent);color:#fff}
.dsh-bishu-entry-sub .ic{flex:none;width:14px;text-align:center;opacity:.85}
.dsh-bishu-entry-sub .p{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace)}
.dsh-bishu-entry-sub{.dsh-bishu-fallback{margin-top:10px;border-top:1px dashed var(--dsw-alias-border-l1,#2a2a2a);padding-top:8px}
.dsh-bishu-fallback summary{cursor:pointer;font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary,#999);padding:4px 0;user-select:none}
.dsh-bishu-fallback summary:hover{color:var(--dsw-alias-label-primary,#eee)}
.dsh-bishu-fallback-list{margin-top:6px;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);border-radius:8px;padding:4px;background:var(--dsw-alias-bg-layer-2,#1c1c1c);max-height:200px;overflow:auto;font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);font-size:11px}
.dsh-bishu-fallback-list .row{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;color:var(--dsw-alias-label-primary,#eee);cursor:pointer;transition:background .12s ease}
.dsh-bishu-fallback-list .row:hover{background:var(--dsw-alias-bg-layer-1,#161616)}
.dsh-bishu-fallback-list .row.active{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#3b82f6) 20%,transparent);color:#fff}
.dsh-bishu-fallback-empty{padding:14px;text-align:center;font-size:11px;color:var(--dsw-alias-label-secondary,#888)}
`;

		// ── helpers ──────────────────────────────────────────────────
		function h(type, props, ...children) {
			return React.createElement(type, props, ...children);
		}
		const WS_KEY = "dsh.bishu.workspace";
		function loadWorkspace() { try { return localStorage.getItem(WS_KEY) || ""; } catch (e) { return ""; } }
		function saveWorkspace(v) { try { localStorage.setItem(WS_KEY, v); } catch (e) { /* ignore */ } }
		function basename(p) {
			const s = String(p || "").replace(/\\/g, "/");
			const i = s.lastIndexOf("/");
			return i >= 0 ? s.slice(i + 1) : s;
		}

		const STATUS_COLOR = {
			completed: "var(--dsw-alias-state-success-primary,#22c55e)",
			failed: "var(--dsw-alias-state-error-primary,#ef4444)",
			running: "var(--dsw-alias-brand-primary,#3b82f6)",
			awaiting_approval: "var(--dsw-alias-state-warn-primary,#eab308)",
			queued: "var(--dsw-alias-label-secondary,#666)",
		};
		const STATUS_TAG = {
			completed: ["已完成", "ok"],
			failed: ["失败", "err"],
			running: ["运行中", "run"],
			awaiting_approval: ["待审批", "warn"],
			queued: ["等待中", "wait"],
		};
		function statusMeta(s) { return STATUS_TAG[s] || [s || "未知", "wait"]; }
		function StatusDot({ status }) {
			return h("span", { className: "dsh-bishu-step-status", style: { background: STATUS_COLOR[status] || STATUS_COLOR.queued } });
		}
		function StatusTag({ status }) {
			const m = statusMeta(status);
			return h("span", { className: "dsh-bishu-tag " + m[1] }, m[0]);
		}
		function SectionCard({ icon, title, sub, children }) {
			return h("div", { className: "dsh-bishu-card" },
				h("div", { className: "dsh-bishu-card-head" },
					icon ? h("span", { className: "ic" }, icon) : null,
					h("div", null, h("h3", null, title), sub ? h("p", null, sub) : null),
				),
				h("div", { className: "dsh-bishu-card-body" }, children),
			);
		}
		function fmtTime(ms) {
			if (!ms) return "-";
			const d = new Date(ms);
			const p = (n) => String(n).padStart(2, "0");
			return p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
		}
		function fmtDur(ms) {
			if (!ms) return "-";
			if (ms < 1000) return "<1秒";
			const s = Math.round(ms / 1000);
			if (s < 60) return s + "秒";
			const m = Math.floor(s / 60), r = s % 60;
			return m + "分" + r + "秒";
		}
		function initParamDefaults(wf) {
			const o = {};
			for (const v of (wf.variables || [])) {
				if (v.hidden && !v.required) continue;
				o[v.key] = v.default || "";
			}
			return o;
		}

		// ── minimal markdown renderer (headings, bold, italic, lists, code, blockquote) ──
		function escapeHtml(s) {
			return String(s == null ? "" : s)
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#39;");
		}
		function inlineMd(raw) {
			const slots = [];
			const stash = (html) => { slots.push(html); return "\u0001" + (slots.length - 1) + "\u0001"; };
			let s = String(raw || "");
			s = s.replace(/\*\*([^*\n]+)\*\*/g, (_, c) => stash("<strong>" + escapeHtml(c) + "</strong>"));
			s = s.replace(/\*([^*\n]+)\*/g, (_, c) => stash("<em>" + escapeHtml(c) + "</em>"));
			s = s.replace(/`([^`\n]+)`/g, (_, c) => stash("<code>" + escapeHtml(c) + "</code>"));
			s = escapeHtml(s);
			s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => slots[Number(i)]);
			return s;
		}
		// 把 md 文本切成块数组（按行号定位），让 MdBlocks 可以就地编辑单个块。
		// 返回 [{ kind, start, end, html }, ...] —— start/end 是 0 基行号（含两端）。
		// 与旧 renderMarkdown 行为一致，但连续 `>` 引用行合并为一个 blockquote。
		function renderMarkdownBlocks(text) {
			try {
				const lines = String(text || "").split(/\r?\n/);
				const out = [];
				let inCode = false;
				let codeStart = -1;
				let codeBuf = [];
				let listBuf = [];
				let listStart = -1;
				let listKind = null;
				let paraBuf = [];
				let paraStart = -1;
				let tableHead = null;   // 当前表格的表头 cells（null 表示不在表格块内）
				let tableStart = -1;    // 当前表格块的起始行号（表头行）
				let tableRows = [];     // 当前表格的数据行 cells
				let quoteBuf = [];      // 连续 `>` 行的内容（不含 `>` 前缀）
				let quoteStart = -1;    // 当前合并引用块的起始行号
				const flushPara = () => {
					if (paraBuf.length) {
						out.push({ kind: "paragraph", start: paraStart, end: paraStart + paraBuf.length - 1, html: "<p>" + inlineMd(paraBuf.join(" ")) + "</p>" });
						paraBuf = []; paraStart = -1;
					}
				};
				const flushList = () => {
					if (listBuf.length) {
						const tag = listKind === "ol" ? "ol" : "ul";
						const html = "<" + tag + ">" + listBuf.map((it) => "<li>" + inlineMd(it) + "</li>").join("") + "</" + tag + ">";
						out.push({ kind: "list", start: listStart, end: listStart + listBuf.length - 1, html });
						listBuf = []; listStart = -1; listKind = null;
					}
				};
				const flushQuote = () => {
					if (quoteBuf.length) {
						const html = "<blockquote>" + quoteBuf.map((ln) => inlineMd(ln)).join("<br>") + "</blockquote>";
						out.push({ kind: "quote", start: quoteStart, end: quoteStart + quoteBuf.length - 1, html });
						quoteBuf = []; quoteStart = -1;
					}
				};
				// GFM pipe table 单元格切分：去掉首尾空 cell（首尾 `|` 引入的）
				const splitPipeCells = (raw) => {
					const parts = String(raw || "").split("|");
					// 去掉首尾空 cell（如果行以 `|` 开头或结尾）
					let arr = parts;
					if (arr.length > 0 && arr[0].trim() === "") arr = arr.slice(1);
					if (arr.length > 0 && arr[arr.length - 1].trim() === "") arr = arr.slice(0, -1);
					return arr.map((c) => c.trim());
				};
				const isPipeRow = (ln) => {
					const t = String(ln || "").trim();
					if (!t) return false;
					return t.indexOf("|") >= 0;
				};
				const isPipeSeparator = (ln) => {
					const t = String(ln || "").trim();
					if (!t) return false;
					return /^\|?[\s\|\-:]+\|?$/.test(t) && /\-{3,}/.test(t);
				};
				const flushTable = () => {
					if (!tableHead) return;
					const thead = "<thead><tr>" + tableHead.map((c) => "<th>" + inlineMd(c) + "</th>").join("") + "</tr></thead>";
					const tbody = "<tbody>" + tableRows.map((row) => "<tr>" + row.map((c) => "<td>" + inlineMd(c) + "</td>").join("") + "</tr>").join("") + "</tbody>";
					const html = '<div class="dsh-bishu-reader-table-wrap"><table class="dsh-bishu-reader-table">' + thead + tbody + "</table></div>";
					// tableStart 是表头行；tableRows 之后是数据行；end = 表头行 + 1(分隔) + 数据行数 - 1
					const endRow = tableStart + 1 + tableRows.length - 1;
					out.push({ kind: "table", start: tableStart, end: endRow, html });
					tableHead = null; tableRows = []; tableStart = -1;
				};
				for (let i = 0; i < lines.length; i++) {
					const ln = lines[i];
					if (inCode) {
						if (/^```/.test(ln)) {
							const html = "<pre><code>" + escapeHtml(codeBuf.join("\n")) + "</code></pre>";
							out.push({ kind: "code", start: codeStart, end: i, html });
							codeBuf = []; codeStart = -1; inCode = false;
						} else codeBuf.push(ln);
						continue;
					}
					if (/^```/.test(ln)) { flushPara(); flushList(); flushTable(); flushQuote(); codeStart = i; inCode = true; continue; }
					if (/^\s*$/.test(ln)) { flushPara(); flushList(); flushTable(); flushQuote(); continue; }
					const h6 = ln.match(/^(#{1,6})\s+(.*)$/);
					if (h6) {
						flushPara(); flushList(); flushTable(); flushQuote();
						out.push({ kind: "heading", start: i, end: i, html: "<h" + h6[1].length + ">" + inlineMd(h6[2]) + "</h" + h6[1].length + ">" });
						continue;
					}
					const lm = ln.match(/^[\-\*]\s+(.*)$/);
					if (lm) {
						flushPara(); flushTable(); flushQuote();
						if (listKind && listKind !== "ul") flushList();
						if (listBuf.length === 0) listStart = i;
						listKind = "ul"; listBuf.push(lm[1]); continue;
					}
					const lo = ln.match(/^\d+\.\s+(.*)$/);
					if (lo) {
						flushPara(); flushTable(); flushQuote();
						if (listKind && listKind !== "ol") flushList();
						if (listBuf.length === 0) listStart = i;
						listKind = "ol"; listBuf.push(lo[1]); continue;
					}
					const q = ln.match(/^>\s*(.*)$/);
					if (q) {
						flushPara(); flushList(); flushTable();
						if (quoteBuf.length === 0) quoteStart = i;
						quoteBuf.push(q[1]);
						continue;
					}
					// pipe 表格识别：当前行含 `|` 且下一行是分隔行 → 进入表格块
					if (isPipeRow(ln) && i + 1 < lines.length && isPipeSeparator(lines[i + 1])) {
						flushPara(); flushList(); flushQuote();
						tableHead = splitPipeCells(ln);
						tableStart = i;
						tableRows = [];
						i += 1; // 跳过分隔行
						continue;
					}
					// 已在表格块内：继续收集数据行
					if (tableHead && isPipeRow(ln)) {
						tableRows.push(splitPipeCells(ln));
						continue;
					}
					// 不在表格块内、当前行像 pipe 但下一行不是分隔：作为普通段落文本（保留原行为）
					if (tableHead) flushTable();
					if (paraBuf.length === 0) paraStart = i;
					paraBuf.push(ln);
				}
				if (inCode) {
					const html = "<pre><code>" + escapeHtml(codeBuf.join("\n")) + "</code></pre>";
					out.push({ kind: "code", start: codeStart, end: lines.length - 1, html });
				}
				flushPara(); flushList(); flushTable(); flushQuote();
				return out;
			} catch (e) {
				return [{ kind: "code", start: 0, end: 0, html: "<pre>" + escapeHtml(text) + "</pre>" }];
			}
		}
		function renderMarkdown(text) {
			const blocks = renderMarkdownBlocks(text);
			return blocks.map((b) => b.html).join("\n");
		}
		function MdView({ text, fallback, className }) {
			const cls = "dsh-bishu-md" + (className ? " " + className : "");
			if (text == null || text === "") return h("div", { className: "dsh-bishu-empty" }, fallback || "（空）");
			return h("div", { className: cls, dangerouslySetInnerHTML: { __html: renderMarkdown(text) } });
		}
		// 阅读窗专用：每块可独立就地编辑；行号每次从 text 派生，永远新鲜。
		function MdBlocks({ text, onChange }) {
			const cls = "dsh-bishu-md dsh-bishu-reader-md";
			const blocks = renderMarkdownBlocks(text);
			const [editingIdx, setEditingIdx] = useState(null);
			const [draft, setDraft] = useState("");
			const lines = String(text || "").split(/\r?\n/);
			const switchTo = (i, blk) => {
				if (editingIdx === i) return;
				if (editingIdx !== null && draft !== originalOf(editingIdx)) {
					if (!window.confirm("有未应用的编辑草稿，确定丢弃？")) return;
				}
				const orig = lines.slice(blk.start, blk.end + 1).join("\n");
				setDraft(orig);
				setEditingIdx(i);
			};
			const originalOf = (i) => {
				const b = blocks[i];
				if (!b) return "";
				return lines.slice(b.start, b.end + 1).join("\n");
			};
			const applyEdit = () => {
				if (editingIdx === null) return;
				const b = blocks[editingIdx];
				if (!b) { setEditingIdx(null); return; }
				const draftLines = draft.split(/\r?\n/);
				const next = lines.slice(0, b.start).concat(draftLines).concat(lines.slice(b.end + 1));
				const nextText = next.join("\n");
				onChange(nextText);
				setEditingIdx(null);
				setDraft("");
			};
			const cancelEdit = () => {
				setEditingIdx(null);
				setDraft("");
			};
			return h("div", { className: cls },
				blocks.length === 0
					? h("div", { className: "dsh-bishu-empty" }, "（空）")
					: blocks.map((b, i) => {
						if (editingIdx === i) {
							return h("div", { key: i, className: "dsh-bishu-blk editing", "data-block": i },
								h("textarea", {
									className: "dsh-bishu-blk-textarea dsh-bishu-ff-text",
									value: draft,
									spellCheck: false,
									onChange: (ev) => setDraft(ev.target.value),
									onKeyDown: (ev) => {
										if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") { ev.preventDefault(); applyEdit(); }
										if (ev.key === "Escape") { ev.preventDefault(); cancelEdit(); }
									},
								}),
								h("div", { className: "dsh-bishu-blk-actions" },
									h("button", { className: "dsh-bishu-ff-add", onClick: applyEdit, title: "应用（Ctrl/Cmd+Enter）" }, "✓ 应用"),
									h("button", { className: "dsh-bishu-ff-del", onClick: cancelEdit, title: "取消（Esc）" }, "× 取消"),
								),
							);
						}
						return h("div", {
							key: i,
							className: "dsh-bishu-blk",
							"data-block": i,
							"data-block-kind": b.kind,
							onDoubleClick: () => switchTo(i, b),
						},
							h("div", {
								className: "dsh-bishu-blk-html",
								dangerouslySetInnerHTML: { __html: b.html },
							}),
							h("button", {
								className: "dsh-bishu-blk-edit",
								title: "编辑本块（双击也可）",
								onClick: (ev) => { ev.stopPropagation(); switchTo(i, b); },
							}, "✎ 编辑"),
						);
					}),
			);
		}

		// ── JsonDoc：把 JSON 解析成可读文档 ───────────────────────────
		// 接受已 parse 的对象 + 可选 ctx：
		//   ctx.dim — 命中 WORLD_DIMENSION_SCHEMA 时按字段 schema 渲染（essence 引用块 + prose/list/table）
		//   ctx.unknown — true 时强制走通用递归（即使 schema 命中也按通用规则）
		// 通用规则：
		//   - object  → 字段递归；缩进式小节标题
		//   - array of object → cards（每个 object 渲染为独立 card，按字段展开）
		//   - array of primitive → ul
		//   - string (含换行或较长) → 段落保留换行
		//   - string (短、无换行) → 行内 kv 值
		//   - number / boolean / null → 行内 kv
		function JsonDoc({ data, dim, unknown, fallback, onEditField }) {
			// 空对象 / 数组 — 提示空
			if (data == null) {
				return h("div", { className: "dsh-bishu-reader-empty" }, fallback || "（空内容）");
			}
			if (typeof data === "string" && data.trim() === "") {
				return h("div", { className: "dsh-bishu-reader-empty" }, fallback || "（空字符串）");
			}
			// 路径 1：schema 已知 + 不强制 unknown
			if (dim && !unknown) {
				return renderSchemaDoc(data, dim, onEditField);
			}
			// 路径 2：通用递归
			return renderGeneric(data, 0);
		}
		function renderSchemaDoc(inner, dim, onEditField) {
			const out = [];
			// 顶层只取第一个字段值（核心 schema 都是 { <dim>: {...} }）
			const keys = Object.keys(inner || {});
			const obj = keys.length === 1 && typeof inner[keys[0]] === "object" ? inner[keys[0]] : inner;
			// heading 用维度 label（"核心法则"等）
			out.push(h("h1", { key: "h" }, dim.label));
			const essence = (obj && typeof obj === "object") ? String(obj.essence || "").trim() : "";
			if (essence) {
				const clickable = !!onEditField;
				out.push(h("blockquote", {
					key: "essence",
					className: "dsh-bishu-reader-essence dsh-bishu-sec" + (clickable ? " dsh-bishu-sec-clickable" : ""),
					"data-field": "essence",
					onClick: clickable ? () => onEditField("essence") : undefined,
					title: clickable ? "跳到表单：核心定调" : undefined,
				}, essence));
			}
			for (const f of dim.fields) {
				const val = (obj && typeof obj === "object") ? obj[f.key] : undefined;
				if (val === undefined || val === null || val === "") continue;
				// 空数组也跳过（religions 等可能为空）
				if (Array.isArray(val) && val.length === 0) continue;
				const clickable = !!onEditField;
				const inner = [
					h("h2", { key: "h2-" + f.key }, f.label),
					renderFieldByType(val, f),
				];
				out.push(h("div", {
					key: "sec-" + f.key,
					className: "dsh-bishu-sec" + (clickable ? " dsh-bishu-sec-clickable" : ""),
					"data-field": f.key,
					onClick: clickable ? () => onEditField(f.key) : undefined,
					title: clickable ? ("跳到表单：" + f.label) : undefined,
				}, inner));
			}
			return h("div", { className: "dsh-bishu-reader-prose" }, out);
		}
		function renderFieldByType(value, field) {
			switch (field.type) {
				case "prose": return renderProse(value);
				case "list":  return renderStringList(value);
				case "table": return renderTable(value, field.headers, field.cols);
				default:      return renderGeneric(value, 0);
			}
		}
		function renderProse(value) {
			const text = String(value == null ? "" : value).trim();
			if (!text) return null;
			return h("div", { className: "dsh-bishu-reader-paragraph" }, text);
		}
		function renderStringList(value) {
			if (!Array.isArray(value)) return renderGeneric(value, 0);
			return h("ul", { className: "dsh-bishu-reader-list" },
				value.map((it, i) => h("li", { key: i }, String(it == null ? "" : it))));
		}
		function renderTable(rows, headers, cols) {
			if (!Array.isArray(rows) || rows.length === 0) {
				return h("div", { className: "dsh-bishu-reader-empty" }, "（无条目）");
			}
			return h("div", { className: "dsh-bishu-reader-table-wrap" },
				h("table", { className: "dsh-bishu-reader-table" },
					h("thead", null, h("tr", null, headers.map((c, i) => h("th", { key: i }, c)))),
					h("tbody", null, rows.map((row, ri) => {
						const r = (row && typeof row === "object") ? row : { value: row };
						return h("tr", { key: ri },
							cols.map((col, ci) => {
								const v = r[col];
								let cell;
								if (Array.isArray(v)) cell = v.map((x, i) => h("div", { key: i }, String(x == null ? "" : x)));
								else if (v == null) cell = "";
								else if (typeof v === "object") cell = JSON.stringify(v);
								else cell = String(v);
								return h("td", { key: ci }, cell);
							}),
						);
					})),
				),
			);
		}
		function renderGeneric(value, depth) {
			// array
			if (Array.isArray(value)) {
				if (value.length === 0) return h("div", { className: "dsh-bishu-reader-empty" }, "（空数组）");
				// 全部 object → 卡片
				const allObj = value.every((it) => it && typeof it === "object" && !Array.isArray(it));
				if (allObj) return renderCards(value, depth);
				// 全部 string → ul
				const allStr = value.every((it) => typeof it === "string");
				if (allStr) return h("ul", { className: "dsh-bishu-reader-list" },
					value.map((it, i) => h("li", { key: i }, String(it))));
				// 其他 → 行内 ul
				return h("ul", { className: "dsh-bishu-reader-list" },
					value.map((it, i) => h("li", { key: i }, String(it == null ? "" : it))));
			}
			// object
			if (value && typeof value === "object") {
				const entries = Object.entries(value);
				if (entries.length === 0) return h("div", { className: "dsh-bishu-reader-empty" }, "（空对象）");
				return renderObjectSections(entries, depth);
			}
			// primitive
			if (typeof value === "string") return renderProse(value);
			if (value === null || value === undefined) return h("span", { className: "dsh-bishu-reader-kv" }, h("span", { className: "v" }, "（空）"));
			return h("div", { className: "dsh-bishu-reader-paragraph" }, String(value));
		}
		function renderObjectSections(entries, depth) {
			const lvl = Math.min(depth, 3);
			const headingTag = lvl === 0 ? "h2" : (lvl === 1 ? "h3" : (lvl === 2 ? "h4" : "h5"));
			return h("div", null, entries.map(([k, v], i) => {
				const block = [];
				const label = humanizeKey(k);
				block.push(h(headingTag, { key: "hd-" + i }, label));
				if (v == null) {
					block.push(h("div", { key: "v-" + i, className: "dsh-bishu-reader-paragraph" }, "（空）"));
				} else if (Array.isArray(v) || (typeof v === "object" && v !== null)) {
					block.push(h("div", { key: "v-" + i }, renderGeneric(v, depth + 1)));
				} else if (typeof v === "string") {
					const text = v.trim();
					// 短字符串 / 无换行 → 行内；否则段落
					if (text.length <= 80 && v.indexOf("\n") < 0) {
						block.push(h("div", { key: "v-" + i, className: "dsh-bishu-reader-kv" },
							h("span", { className: "k" }, label + ":"),
							h("span", { className: "v" }, text)));
					} else {
						block.push(h("div", { key: "v-" + i, className: "dsh-bishu-reader-paragraph" }, text));
					}
				} else {
					block.push(h("div", { key: "v-" + i, className: "dsh-bishu-reader-kv" },
						h("span", { className: "k" }, label + ":"),
						h("span", { className: "v" }, String(v))));
				}
				return h("div", { key: "sec-" + i }, block);
			}));
		}
		function renderCards(rows, depth) {
			return h("div", { className: "dsh-bishu-reader-cards" },
				rows.map((row, i) => {
					const entries = Object.entries(row || {});
					const nameKey = entries.find(([k]) => /(^_)(name|item|key|event|era|status|type)/i.test(k)) ||
						entries.find(([k]) => /name|label|title/i.test(k)) ||
						entries[0];
					const titleText = nameKey ? String(nameKey[1]) : ("#" + (i + 1));
					const cardRows = entries.filter(([k]) => !(nameKey && k === nameKey[0]));
					return h("div", { key: "c-" + i, className: "dsh-bishu-reader-card" },
						h("div", { className: "dsh-bishu-reader-card-title" },
							h("span", { className: "ix" }, "#" + (i + 1)),
							titleText),
						cardRows.length > 0
							? h("div", null, cardRows.map(([k, v], ci) => {
								const cv = Array.isArray(v) && v.every((x) => typeof x !== "object")
									? v.map((x, xi) => h("div", { key: xi }, String(x == null ? "" : x)))
									: (typeof v === "string" ? v.trim() : h("div", null, renderGeneric(v, (depth || 0) + 1)));
								return h("div", { key: ci, className: "dsh-bishu-reader-card-row" },
									h("span", { className: "ck" }, humanizeKey(k)),
									h("span", { className: "cv" }, cv == null || cv === "" ? "—" : cv));
							}))
							: null,
					);
				}),
			);
		}

		// ── JsonForm：六维世界观的表单化编辑器（编辑态不再直面 JSON 源码） ──
		// 输入已 parse 的 root 对象；所有字段改动经 onCommit(nextRoot) 回传，
		// 由调用方 JSON.stringify 回 editText —— 保存链路（校验/写盘）完全不变。
		function autoRows(v, min) {
			const s = String(v == null ? "" : v);
			const lines = s.split("\n").length + Math.floor(s.length / 46);
			return Math.max(min || 1, Math.min(16, lines + 1));
		}
		function FormProse({ label, value, onChange, fieldKey }) {
			return h("div", { className: "dsh-bishu-ff", id: fieldKey ? "ff-" + fieldKey : undefined },
				h("label", { className: "dsh-bishu-ff-label" }, label),
				h("textarea", {
					className: "dsh-bishu-ff-text", rows: autoRows(value, 3), value: String(value == null ? "" : value),
					spellCheck: false, onChange: (ev) => onChange(ev.target.value),
				}),
			);
		}
		function FormList({ label, value, onChange, fieldKey }) {
			const arr = Array.isArray(value) ? value : [];
			const setItem = (i, v) => onChange(arr.map((x, xi) => (xi === i ? v : x)));
			const delItem = (i) => onChange(arr.filter((_, xi) => xi !== i));
			const addItem = () => onChange(arr.concat([""]));
			return h("div", { className: "dsh-bishu-ff", id: fieldKey ? "ff-" + fieldKey : undefined },
				h("label", { className: "dsh-bishu-ff-label" }, label + "（" + arr.length + " 条）"),
				h("div", { className: "dsh-bishu-ff-list" },
					arr.map((it, i) => h("div", { key: i, className: "dsh-bishu-ff-listrow" },
						h("span", { className: "ix" }, String(i + 1)),
						h("textarea", {
							className: "dsh-bishu-ff-text", rows: autoRows(it, 1), value: String(it == null ? "" : it),
							spellCheck: false, onChange: (ev) => setItem(i, ev.target.value),
						}),
						h("button", { className: "dsh-bishu-ff-del", title: "删除本条", onClick: () => delItem(i) }, "×"),
					)),
					h("button", { className: "dsh-bishu-ff-add", onClick: addItem }, "+ 添加一条"),
				),
			);
		}
		function FormTable({ label, headers, cols, value, onChange, fieldKey }) {
			const arr = Array.isArray(value) ? value : [];
			const setCell = (ri, col, v, wasArray) => onChange(arr.map((r, i) => {
				if (i !== ri) return r;
				const cell = wasArray ? v.split("\n").filter((x) => x.trim() !== "") : v;
				return Object.assign({}, (r && typeof r === "object") ? r : {}, { [col]: cell });
			}));
			const delRow = (ri) => onChange(arr.filter((_, i) => i !== ri));
			const addRow = () => { const o = {}; for (const c of cols) o[c] = ""; onChange(arr.concat([o])); };
			return h("div", { className: "dsh-bishu-ff", id: fieldKey ? "ff-" + fieldKey : undefined },
				h("label", { className: "dsh-bishu-ff-label" }, label + "（" + arr.length + " 行）"),
				h("div", { className: "dsh-bishu-ff-cards" },
					arr.map((row, ri) => {
						const title = (row && (row.name || row.event || row.source)) || "";
						return h("div", { key: ri, className: "dsh-bishu-ff-card" },
							h("div", { className: "dsh-bishu-ff-card-head" },
								h("span", { className: "ix" }, "#" + (ri + 1)),
								h("span", { className: "t" }, String(title || "（未命名）")),
								h("button", { className: "dsh-bishu-ff-del", title: "删除该行", onClick: () => delRow(ri) }, "×"),
							),
							cols.map((col, ci) => {
								const cellVal = row ? row[col] : undefined;
								const wasArray = Array.isArray(cellVal);
								const cellStr = wasArray ? cellVal.join("\n") : (cellVal == null ? "" : String(cellVal));
								return h("div", { key: col, className: "dsh-bishu-ff-card-row" },
									h("label", null, (headers && headers[ci]) || humanizeKey(col)),
									h("textarea", {
										className: "dsh-bishu-ff-text", rows: autoRows(cellStr, 1), value: cellStr,
										spellCheck: false, onChange: (ev) => setCell(ri, col, ev.target.value, wasArray),
									}),
								);
							}),
						);
					}),
					h("button", { className: "dsh-bishu-ff-add", onClick: addRow }, "+ 添加一行"),
				),
			);
		}
		// schema 之外的未知字段：尽量可编辑；过于复杂的嵌套只读展示并提示
		function FormGeneric({ label, value, onChange, fieldKey }) {
			if (typeof value === "string") return h(FormProse, { label, value, onChange, fieldKey });
			if (typeof value === "number" || typeof value === "boolean") {
				return h("div", { className: "dsh-bishu-ff", id: fieldKey ? "ff-" + fieldKey : undefined },
					h("label", { className: "dsh-bishu-ff-label" }, label),
					h("input", {
						className: "dsh-bishu-ff-text", value: String(value), spellCheck: false,
						onChange: (ev) => {
							const t = ev.target.value;
							if (typeof value === "boolean") onChange(t === "true");
							else onChange(t.trim() !== "" && !isNaN(Number(t)) ? Number(t) : t);
						},
					}),
				);
			}
			if (Array.isArray(value) && value.every((x) => typeof x === "string")) {
				return h(FormList, { label, value, onChange, fieldKey });
			}
			return h("div", { className: "dsh-bishu-ff", id: fieldKey ? "ff-" + fieldKey : undefined },
				h("label", { className: "dsh-bishu-ff-label" }, label + "（结构较复杂，暂只读）"),
				h("pre", { className: "dsh-bishu-reader-fallback" }, JSON.stringify(value, null, 2)),
			);
		}
		function JsonForm({ root, dim, onCommit }) {
			const keys = Object.keys(root || {});
			const topKey = (keys.length === 1 && root[keys[0]] && typeof root[keys[0]] === "object" && !Array.isArray(root[keys[0]])) ? keys[0] : null;
			const obj = topKey ? root[topKey] : root;
			const setField = (key, val) => {
				const nextObj = Object.assign({}, obj, { [key]: val });
				onCommit(topKey ? Object.assign({}, root, { [topKey]: nextObj }) : nextObj);
			};
			const rows = [];
			const schemaKeys = { essence: true };
			rows.push(h(FormProse, { key: "essence", fieldKey: "essence", label: "核心定调", value: obj && obj.essence, onChange: (v) => setField("essence", v) }));
			for (const f of dim.fields) {
				schemaKeys[f.key] = true;
				const val = obj ? obj[f.key] : undefined;
				if (f.type === "prose") rows.push(h(FormProse, { key: f.key, fieldKey: f.key, label: f.label, value: val, onChange: (v) => setField(f.key, v) }));
				else if (f.type === "list") rows.push(h(FormList, { key: f.key, fieldKey: f.key, label: f.label, value: val, onChange: (v) => setField(f.key, v) }));
				else if (f.type === "table") rows.push(h(FormTable, { key: f.key, fieldKey: f.key, label: f.label, headers: f.headers, cols: f.cols, value: val, onChange: (v) => setField(f.key, v) }));
			}
			for (const k of Object.keys(obj || {})) {
				if (schemaKeys[k]) continue;
				rows.push(h(FormGeneric, { key: "x-" + k, fieldKey: k, label: humanizeKey(k), value: obj[k], onChange: (v) => setField(k, v) }));
			}
			return h("div", { className: "dsh-bishu-reader-form" }, rows);
		}

		// ── pipeline stages (must match lib/index.js bishu_book_status paths) ──
		const STAGES = [
			{ id: "world", label: "世界观", workflow: "build", files: ["meta/world_foundation.md"] },
			{ id: "character", label: "角色", workflow: "character", files: ["meta/character_profiles.md"] },
			{ id: "story-plan", label: "故事规划", workflow: "story-plan", files: ["meta/story_plan.md", "meta/style_profile.md", "meta/character_voice.md", "meta/hooks.md", "meta/debts.md"] },
			{ id: "outline", label: "大纲", workflow: "outline", files: ["outline/volume_outline.md", "outline/near_term_outline.md"] },
			{ id: "chapter", label: "章节循环", workflow: "mvp", files: ["story/0001/chapter.md", "story/0001/single_chapter_guide.md"] },
		];
		function summarizeStage(files, stage) {
			const map = {};
			for (const f of files || []) map[f.path] = !!f.exists;
			const present = stage.files.filter((p) => map[p]);
			const missing = stage.files.filter((p) => !map[p]);
			return { done: present.length === stage.files.length && present.length > 0, present, missing, total: stage.files.length };
		}
		function nextPendingStage(files) {
			for (const s of STAGES) {
				const r = summarizeStage(files, s);
				if (!r.done) return { stage: s, summary: r };
			}
			return null;
		}

		// ── semantic groups（产物浏览）：5 组按生产顺序，章节组运行时从 tree 生成 ─────
		// 文件路径以 build / character / story-plan / outline / mvp / post-hoc 的 definition.json 中
		// output_file_path / render --outputs 为权威来源；六维中文名见 resources/workflows/build/script/render_worldview.py
		const SEMANTIC_GROUPS = [
			{
				id: "world", title: "世界观", icon: "🌐", workflow: "build",
				entries: [
					{ id: "foundation", title: "世界观基础", path: "meta/world_foundation.md" },
					{ id: "core_laws", title: "核心法则", path: "world/core_laws.json" },
					{ id: "space_time", title: "时空地理", path: "world/space_time.json" },
					{ id: "society", title: "社会权力", path: "world/society.json" },
					{ id: "history_culture", title: "历史文化", path: "world/history_culture.json" },
					{ id: "existence", title: "存在基础", path: "world/existence.json" },
					{ id: "information", title: "信息传播", path: "world/information.json" },
				],
			},
			{
				id: "character", title: "角色", icon: "👥", workflow: "character",
				entries: [
					{ id: "profiles", title: "角色档案", path: "meta/character_profiles.md" },
					{ id: "voice", title: "角色声线", path: "meta/character_voice.md" },
				],
			},
			{
				id: "story-plan", title: "故事规划", icon: "📖", workflow: "story-plan",
				entries: [
					{ id: "plan", title: "故事规划", path: "meta/story_plan.md" },
					{ id: "style", title: "风格档案", path: "meta/style_profile.md" },
					{ id: "hooks", title: "伏笔", path: "meta/hooks.md" },
					{ id: "debts", title: "债务", path: "meta/debts.md" },
				],
			},
			{
				id: "outline", title: "大纲", icon: "🗂️", workflow: "outline",
				entries: [
					{ id: "volume", title: "卷大纲", path: "outline/volume_outline.md" },
					{ id: "near_term", title: "近纲", path: "outline/near_term_outline.md" },
				],
			},
			{
				id: "chapter", title: "章节", icon: "📚", workflow: "mvp", chapterBased: true,
			},
		];
		// 把任意 /tree 来的相对路径映射到 expandedEntry key：semantic 条目 → "semantic:<group>:<entry>"
		// 章节文件 → "chapter:<NNNN>:<body|guide|diff:...>"，否则 → "fallback:<rel>"
		function semanticEntryKeyFor(rel) {
			const p = String(rel || "");
			for (const g of SEMANTIC_GROUPS) {
				if (g.chapterBased) continue;
				for (const e of g.entries) {
					if (e.path === p) return "semantic:" + g.id + ":" + e.id;
				}
			}
			const m = p.match(/^story\/(\d{4})\/([^/]+)$/);
			if (m) {
				const ch = m[1], name = m[2];
				if (name === "chapter.md") return "chapter:" + ch + ":body";
				if (name === "single_chapter_guide.md") return "chapter:" + ch + ":guide";
				if (/^diff_.*\.md$/.test(name)) return "chapter:" + ch + ":diff:" + name;
				if (name === "world_state.md" || name === "world_events.md" || name === "character_state_long.md"
					|| name === "character_minor.md" || name === "storyboard.md" || name === "world_foundation_trimmed.md"
					|| name === "character_profiles_trimmed.md") {
					return "chapter:" + ch + ":extra:" + name;
				}
			}
			return "fallback:" + p;
		}
		// 从 tree 中提取章节号（数字）
		function listChapterNumbers(files) {
			const nums = new Set();
			const re = /^story\/(\d{4})\/chapter\.md$/i;
			for (const f of (files || [])) {
				const m = String(f).match(re);
				if (m) nums.add(parseInt(m[1], 10));
			}
			const arr = Array.from(nums);
			arr.sort((a, b) => a - b);
			return arr;
		}
		// 从 tree 中提取指定章节下的子文件
		function chapterSubFiles(files, chNum) {
			const prefix = "story/" + String(chNum).padStart(4, "0") + "/";
			const out = [];
			const re = /^story\/\d{4}\/[^/]+$/;
			for (const f of (files || [])) {
				const s = String(f);
				if (s.startsWith(prefix) && re.test(s)) out.push(s);
			}
			out.sort();
			return out;
		}

		// ── 六维世界观 schema 内置镜像 ────────────────────────────────
		// 与 resources/workflows/build/script/render_worldview.py 同源；
		// 客户端用它在 JsonDoc 里把 world/*.json 渲染成可读文档。
		const WORLD_DIMENSION_SCHEMA = {
			core_laws: {
				label: "核心法则",
				fields: [
					{ key: "power_system",       label: "力量体系",     type: "prose" },
					{ key: "axioms",             label: "公理铁律",     type: "table",
						headers: ["名称", "陈述", "代价", "边界", "执行"],
						cols:   ["name", "statement", "cost", "boundary", "enforcement"] },
					{ key: "taboos",             label: "禁忌",         type: "list" },
					{ key: "power_manifestation", label: "力量显化",    type: "prose" },
				],
			},
			space_time: {
				label: "时空地理",
				fields: [
					{ key: "world_layout",       label: "世界格局",     type: "prose" },
					{ key: "key_locations",      label: "关键地点",     type: "table",
						headers: ["名称", "地形", "特征", "风险", "控制势力"],
						cols:   ["name", "terrain", "feature", "risk", "controlling_force"] },
					{ key: "ecology",            label: "生态",         type: "prose" },
					{ key: "era",                label: "时代",         type: "prose" },
					{ key: "environment_texture", label: "环境质感",    type: "prose" },
				],
			},
			society: {
				label: "社会权力",
				fields: [
					{ key: "races",              label: "种族",         type: "table",
						headers: ["名称", "特征", "人口", "社会地位"],
						cols:   ["name", "traits", "population", "social_status"] },
					{ key: "class_structure",    label: "阶层结构",     type: "prose" },
					{ key: "political_system",   label: "政治制度",     type: "prose" },
					{ key: "forces",             label: "势力",         type: "table",
						headers: ["名称", "类型", "权力根基", "目标", "手段"],
						cols:   ["name", "type", "base_of_power", "goals", "methods"] },
					{ key: "force_relations",    label: "势力关系",     type: "table",
						headers: ["来源", "目标", "关系", "张力点"],
						cols:   ["source", "target", "relation", "tension_point"] },
					{ key: "power_visibility",   label: "权力的日常可见性", type: "prose" },
				],
			},
			history_culture: {
				label: "历史文化",
				fields: [
					{ key: "major_events",       label: "重大事件",     type: "table",
						headers: ["事件", "时代", "持久影响"],
						cols:   ["event", "era", "lasting_impact"] },
					{ key: "religions",          label: "宗教",         type: "table",
						headers: ["名称", "核心信条", "信徒范围"],
						cols:   ["name", "core_belief", "follower_scope"] },
					{ key: "customs",            label: "风俗习惯",     type: "prose" },
					{ key: "economy",            label: "经济",         type: "prose" },
					{ key: "daily_slice",        label: "日常切片",     type: "prose" },
				],
			},
			existence: {
				label: "存在基础",
				fields: [
					{ key: "calendar",           label: "历法",         type: "prose" },
					{ key: "lifespan",           label: "寿命与衰老",   type: "prose" },
					{ key: "death",              label: "死亡",         type: "prose" },
					{ key: "disease_and_birth",  label: "疾病与生育",   type: "prose" },
				],
			},
			information: {
				label: "信息传播",
				fields: [
					{ key: "info_speed",         label: "信息流速",     type: "prose" },
					{ key: "knowledge_medium",   label: "知识媒介",     type: "prose" },
					{ key: "info_barriers",      label: "信息壁垒",     type: "prose" },
					{ key: "rumor_and_truth",    label: "谣言与真相",   type: "prose" },
				],
			},
		};
		function isWorldDimensionFile(path) {
			const m = /^world\/([a-z_]+)\.json$/.exec(String(path || ""));
			return m ? WORLD_DIMENSION_SCHEMA[m[1]] : null;
		}
		// 用于 SEMANTIC_GROUPS.world 条目查找其 dimension key
		function dimensionKeyForEntry(g, e) {
			if (g && g.id === "world") {
				const p = String((e && e.path) || "");
				const m = /^world\/([a-z_]+)\.json$/.exec(p);
				if (m) return m[1];
			}
			return null;
		}
		// snake_case → "Snake Case"，并把全大写键、含数字键、过长键做兜底
		function humanizeKey(rawKey) {
			const s = String(rawKey || "");
			if (!s) return "";
			// 命中六维字段表（任何维度共用）则返回表中 label
			for (const dim of Object.keys(WORLD_DIMENSION_SCHEMA)) {
				for (const f of WORLD_DIMENSION_SCHEMA[dim].fields) {
					if (f.key === s) return f.label;
					// 命中 table 字段的 cols[i]，返回对应 headers[i]（中文列名）
					if (Array.isArray(f.cols) && Array.isArray(f.headers)) {
						const ci = f.cols.indexOf(s);
						if (ci >= 0 && ci < f.headers.length) return f.headers[ci];
					}
				}
			}
			// 通用美化
			const spaced = s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_\-]+/g, " ").trim().replace(/\s+/g, " ");
			if (!spaced) return s;
			return spaced.charAt(0).toUpperCase() + spaced.slice(1);
		}
		// JSON 解析异常时给用户看的轻量错误
		function jsonParseError(text) {
			try { JSON.parse(String(text || "")); return null; } catch (e) {
				const msg = String((e && e.message) || e);
				// 尝试给出近似的行列号
				const m = /at position (\d+)/.exec(msg);
				let line = null, col = null;
				if (m) {
					const off = Math.min(parseInt(m[1], 10), String(text || "").length);
					const upto = String(text || "").slice(0, off);
					line = upto.split("\n").length;
					col = off - (upto.lastIndexOf("\n") + 1) + 1;
				}
				return { message: msg, line, col };
			}
		}

		// ── icons ───────────────────────────────────────────────────
		function makeFolderIcon() {
			return h("svg", { viewBox: "0 0 16 16", width: "15", height: "15", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" },
				h("path", { d: "M2 4.5h4l1.5 1.5h6.5v6.5a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5z" }));
		}
		function makeChevron(open) {
			return h("svg", { viewBox: "0 0 12 12", width: "10", height: "10", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", style: { transition: "transform .12s ease", transform: open ? "rotate(90deg)" : "rotate(0deg)" } },
				h("path", { d: "M4 2.5l4 3.5-4 3.5" }));
		}
		function fileIconText(path) {
			const m = /\.([^./\\]+)$/.exec(String(path || ""));
			const ext = m ? m[1].toLowerCase() : "";
			if (ext === "md") return "\uD83D\uDCC4"; // 📄
			if (ext === "json") return "\uD83E\uDDFE"; // 🧾
			if (ext === "py") return "\uD83D\uDC0D"; // 🐍
			if (ext === "txt") return "\uD83D\uDCDD"; // 📝
			if (ext === "yaml" || ext === "yml") return "\u2699"; // ⚙
			if (ext === "js" || ext === "ts") return "\uD83D\uDFE8"; // 🟨
			return "\uD83D\uDCCE"; // 📎
		}
		function getExt(path) {
			const m = /\.([^./\\]+)$/.exec(String(path || ""));
			return m ? m[1].toLowerCase() : "";
		}
		function defaultViewMode(path) {
			const ext = getExt(path);
			// md 直接走 preview；json 也走 preview（OverlayReader 内走 JsonDoc 结构化渲染，
			// 解析失败自动回退等宽源码视图）；其余扩展名保持 source。
			if (ext === "md" || ext === "json") return "preview";
			return "source";
		}
		function countStats(text) {
			const s = String(text || "");
			let lines = 0;
			if (s.length > 0) {
				// 计入总行数（包含末尾空行）
				let i = 0, prev = -1;
				while ((i = s.indexOf("\n", prev + 1)) >= 0) { lines++; prev = i; }
				lines += 1; // 最后一行（即使无换行符）
			}
			// 中文字符数：CJK 统一表意 + 兼容 + 部首 + 笔画 等范围
			let cjk = 0;
			for (let i = 0; i < s.length; i++) {
				const c = s.charCodeAt(i);
				if (c >= 0x4E00 && c <= 0x9FFF) cjk++;
				else if (c >= 0x3400 && c <= 0x4DBF) cjk++;
				else if (c >= 0xF900 && c <= 0xFAFF) cjk++;
			}
			return { lines, cjk, chars: s.length };
		}

				// ── lastFile 记忆 ───────────────────────────────────────────
		function lastFileKey(ws) { return "dsh.bishu.lastFile." + String(ws || ""); }
		function loadLastFile(ws) { try { return localStorage.getItem(lastFileKey(ws)) || null; } catch (e) { return null; } }
		function saveLastFile(ws, path) { try { localStorage.setItem(lastFileKey(ws), String(path || "")); } catch (e) { /* ignore */ } }
		function clearLastFile(ws) { try { localStorage.removeItem(lastFileKey(ws)); } catch (e) { /* ignore */ } }

		// ── shared hooks (fetch providers + pickFolder + openFolder) ──
		function useProviders() {
			const [providers, setProviders] = useState([]);
			useEffect(() => {
				get("/models")
					.then((b) => setProviders(b.providers || []))
					.catch(() => { /* model list is optional */ });
			}, []);
			return providers;
		}
		function useHelpers({ toast, pushError }) {
			const folderIcon = useRef(makeFolderIcon()).current;
			const openFolder = useCallback((ws) => {
				if (!ws || !String(ws).trim()) { toast({ kind: "warn", text: "请先填写工作区路径" }); return; }
				post("/open-workspace", { workspace: String(ws).trim() })
					.then((b) => { if (b && b.error) toast({ kind: "error", text: b.error }); else toast({ kind: "ok", text: "已打开: " + (b && b.workspace ? b.workspace : ws) }); })
					.catch((err) => toast({ kind: "error", text: String((err && err.message) || err) }));
			}, [toast]);
			const pickFolder = useCallback((applyPath) => {
				post("/pick-workspace", {})
					.then((b) => {
						if (b && b.error) { toast({ kind: "error", text: b.error }); return; }
						if (b && b.path) { applyPath(b.path); saveWorkspace(b.path); toast({ kind: "ok", text: "已选择: " + b.path }); }
						else toast({ kind: "warn", text: "已取消选择目录" });
					})
					.catch((err) => toast({ kind: "error", text: String((err && err.message) || err) }));
			}, [toast]);
			return { folderIcon, openFolder, pickFolder };
		}

		// ── error bar (stacked, each dismissable) ───────────────────
		function ErrorBar({ errors, setErrors }) {
			if (!errors || errors.length === 0) return null;
			return h("div", { className: "dsh-bishu-errbar" },
				errors.map((e) => h("div", { key: e.id, className: "row" },
					h("button", { className: "x", title: "关闭", onClick: () => setErrors((prev) => prev.filter((x) => x.id !== e.id)) }, "\u2715"),
					h("div", { className: "t" }, e.text),
				)),
			);
		}

		// ── OverlayReader：全屏右侧滑入的阅读窗 ─────────────────────
		function OverlayReader({
			readerFile,         // { path, title, groupLabel, dimKey } | null
			content,            // 当前文件原始内容（字符串）
			mode,               // "preview" | "source" | "edit"
			editText,           // 编辑文本（受控）
			dirty,              // bool
			error,              // JSON 校验错误（编辑态下使用） null | { message, line, col }
			saving,             // bool —— 保存请求进行中（防重复点击）
			saveStatus,         // { kind: "saving"|"ok"|"err", text: string } | null
			onClose,            // () => void  —— 已通过 dirty 校验
			onRequestClose,     // () => boolean —— 内部 dirty 时弹窗确认，返回是否实际关闭
			onChangeMode,       // (m) => void
			onChangeEditText,   // (next: string) => void
			onSave,             // () => void（外部处理 post + 提示）
			toast,              // 用于本地 toast（如复制/复制路径）
		}) {
			// 受控 anchor：mounted 用于控制 enter/leave 两段动画，open 用于切换 class
			const [mounted, setMounted] = useState(!!readerFile);
			const [open, setOpen] = useState(!!readerFile);
			useEffect(() => {
				if (readerFile) {
					setMounted(true);
					// 下一帧切到 open 状态以触发 transition
					const t = setTimeout(() => setOpen(true), 16);
					return () => clearTimeout(t);
				}
				// 关闭流程：先 open=false 触发过渡，180ms 后卸载
				setOpen(false);
				const t = setTimeout(() => setMounted(false), 200);
				return () => clearTimeout(t);
			}, [readerFile && readerFile.path]);
			// 锁背景滚动
			useEffect(() => {
				if (!mounted) return;
				const prev = document.body.style.overflow;
				document.body.style.overflow = "hidden";
				return () => { document.body.style.overflow = prev; };
			}, [mounted]);
			// ESC 关闭 + Cmd/Ctrl+S 保存
			useEffect(() => {
				if (!mounted) return;
				const onKey = (ev) => {
					if (ev.key === "Escape") {
						ev.preventDefault();
						if (dirty) {
							if (window.confirm("有未保存修改，确定丢弃并关闭？")) onClose();
						} else {
							onClose();
						}
						return;
					}
					if ((ev.ctrlKey || ev.metaKey) && (ev.key === "s" || ev.key === "S")) {
						ev.preventDefault();
						if (mode === "edit" && dirty) onSave();
					}
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [mounted, dirty, mode, onClose, onSave]);
			if (!mounted || !readerFile) return null;
			const ext = getExt(readerFile.path);
			const isMd = ext === "md";
			const isJson = ext === "json";
			const stats = countStats(content);
			const isWorld = isJson ? isWorldDimensionFile(readerFile.path) : null;
			// JSON 六维预览小节 → 点击跳回表单对应字段
			const onEditField = (key) => {
				onChangeMode("edit");
				setTimeout(() => {
					const el = document.getElementById("ff-" + key);
					if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
				}, 80);
			};
			// 渲染 preview 内容
			let previewBody;
			if (editText == null || editText === "") {
				previewBody = h("div", { className: "dsh-bishu-reader-empty" }, "（空文件）");
			} else if (isMd) {
				previewBody = h("div", { className: "dsh-bishu-reader-prose" }, h(MdBlocks, { text: editText, onChange: onChangeEditText }));
			} else if (isJson) {
				let parsed = null;
				let parseErr = null;
				try { parsed = JSON.parse(editText); } catch (e) { parseErr = String((e && e.message) || e); }
				if (parseErr) {
					previewBody = h("div", null,
						h("div", { className: "dsh-bishu-reader-empty" }, "JSON 解析失败，回退到源码视图"),
						h("pre", { className: "dsh-bishu-reader-fallback" }, editText),
					);
				} else {
					previewBody = h("div", { className: "dsh-bishu-reader-prose" },
						h("h1", null, isWorld ? ("世界观 · " + isWorld.label) : readerFile.groupLabel || basename(readerFile.path)),
						h("p", { style: { color: "var(--dsw-alias-label-secondary,#999)", fontSize: 12, fontFamily: "var(--dsw-font-mono,ui-monospace,Menlo,monospace)" } }, readerFile.path),
						h(JsonDoc, { data: parsed, dim: isWorld || undefined, onEditField: isWorld ? onEditField : undefined }));
				}
			} else {
				previewBody = h("pre", { className: "dsh-bishu-reader-fallback" }, editText);
			}
			let sourceBody;
			if (isJson) {
				try {
					const obj = JSON.parse(content || "");
					sourceBody = h("pre", { className: "dsh-bishu-reader-fallback" }, JSON.stringify(obj, null, 2));
				} catch (e) {
					sourceBody = h("pre", { className: "dsh-bishu-reader-fallback" }, content || "");
				}
			} else {
				sourceBody = h("pre", { className: "dsh-bishu-reader-fallback" }, content || "");
			}
			// 六维 JSON：编辑态用表单（解析失败回退源码编辑，便于手工修复语法）
			let worldFormRoot = null;
			if (isJson && isWorld) {
				try {
					const r = JSON.parse(editText || "");
					if (r && typeof r === "object" && !Array.isArray(r)) worldFormRoot = r;
				} catch (e) { /* keep null → fallback textarea */ }
			}
			const editBody = h("div", { className: "dsh-bishu-reader-edit" + (worldFormRoot ? " form" : (isJson ? " json" : "")) },
				error ? h("div", { className: "dsh-bishu-reader-edit-err" },
					"JSON 解析失败：" + error.message + (error.line != null ? "（第 " + error.line + " 行，第 " + error.col + " 列）" : "")) : null,
				worldFormRoot
					? h(JsonForm, { root: worldFormRoot, dim: isWorld, onCommit: (nextRoot) => onChangeEditText(JSON.stringify(nextRoot, null, 2)) })
					: h("textarea", {
						spellCheck: false,
						value: editText,
						placeholder: "在此编辑…（Ctrl/Cmd+S 保存，Esc 关闭）",
						onChange: (ev) => onChangeEditText(ev.target.value),
					}),
			);
			let body;
			if (mode === "edit") body = editBody;
			else if (mode === "source") body = sourceBody;
			else body = previewBody;
			const handleClose = () => {
				if (dirty) {
					if (!window.confirm("「" + readerFile.path + "」有未保存修改，确定丢弃并关闭？")) return;
				}
				onClose();
			};
			const handleSave = () => onSave();
			const showPreview = !isJson || !!isWorld; // JSON 也提供 preview（schema 渲染）
			return h(React.Fragment, null,
				h("div", { className: "dsh-bishu-reader-overlay" + (open ? " open" : "") },
					h("div", { className: "dsh-bishu-reader-backdrop", onClick: handleClose }),
				),
				h("div", { className: "dsh-bishu-reader" + (open ? " open" : ""), role: "dialog", "aria-modal": "true", "aria-label": readerFile.title || readerFile.path },
					h("div", { className: "dsh-bishu-reader-header" },
						h("div", { className: "dsh-bishu-reader-title" },
							h("h1", { title: readerFile.title }, readerFile.title || "未命名"),
							h("p", { title: readerFile.path }, readerFile.path),
							h("div", { className: "dsh-bishu-reader-stats" },
								isMd
									? h(React.Fragment, null,
										h("span", null, "中文 ", h("span", { className: "num" }, stats.cjk)),
										h("span", null, "行 ", h("span", { className: "num" }, stats.lines)),
									  )
									: h(React.Fragment, null,
										h("span", null, "行 ", h("span", { className: "num" }, stats.lines)),
										h("span", null, "字符 ", h("span", { className: "num" }, stats.chars)),
									  ),
							),
						),
						dirty ? h("span", { className: "dsh-bishu-tag warn" }, "未保存") : null,
						saveStatus ? h("span", { className: "dsh-bishu-reader-savestatus " + saveStatus.kind, title: saveStatus.text },
							saveStatus.kind === "saving" ? h("span", { className: "spin" }) : null,
							saveStatus.text,
						) : null,
						h("div", { className: "dsh-bishu-viewtoggle" },
							showPreview ? h("button", { className: mode === "preview" ? "active" : "", onClick: () => onChangeMode("preview"), title: isMd ? "Markdown 预览" : (isJson ? "结构化预览" : "预览") }, "预览") : null,
							h("button", { className: mode === "source" ? "active" : "", onClick: () => onChangeMode("source"), title: isJson ? "JSON 格式化源码（只读）" : "源码（只读）" }, "源码"),
							h("button", { className: mode === "edit" ? "active" : "", onClick: () => onChangeMode("edit"), title: "编辑（Ctrl/Cmd+S 保存）" }, "编辑"),
						),
						h("button", {
							className: "dsh-bishu-btn dsh-bishu-btn-primary dsh-bishu-btn-small",
							onClick: handleSave, disabled: !dirty || saving, title: "保存（Ctrl/Cmd+S）",
						}, saving ? "保存中…" : "保存"),
						h("button", { className: "dsh-bishu-iconbtn", onClick: handleClose, title: "关闭（Esc）" }, "\u2715"),
					),
					h("div", { className: "dsh-bishu-reader-body" },
						body,
					),
				),
			);
		}

		// ── BookTab (default) ───────────────────────────────────────
		function BookTab({ workspace, setWorkspace, pushError, dismissError, toast, gotoWorkflow, dirtyCheckRef }) {
			const { folderIcon, pickFolder, openFolder } = useHelpers({ toast, pushError });
			const providers = useProviders();
			const [recent, setRecent] = useState(null); // null = unknown / unavailable; [] = empty list
			const [bookStatus, setBookStatus] = useState(null);
			const [loadingStatus, setLoadingStatus] = useState(false);
			const [tree, setTree] = useState(null);
			// 阅读窗：当前打开的文件元数据 + 内容视图
			const [readerFile, setReaderFile] = useState(null); // { path, title, groupLabel, dimKey } | null
			const [readerView, setReaderView] = useState(null); // { content, mode, editText, dirty, jsonError } | null
			// 保存中：按钮禁用 / 防止重复点击；保存状态条：阅读窗内可见反馈（解决「保存没反应」的用户感知问题）
			const [saving, setSaving] = useState(false);
			const [saveStatus, setSaveStatus] = useState(null); // { kind: "saving"|"ok"|"err", text: string } | null
			// 组展开状态：默认全展开（缺省视为 true）
			const [groupsOpen, setGroupsOpen] = useState({});
			// 每个 workspace 只在首次拿到 tree 时尝试一次 lastFile 自动恢复
			const autoOpenedFor = useRef(null);
			// 注册未保存检测给 App，用于切 tab 前的确认
			useEffect(() => {
				if (!dirtyCheckRef) return;
				dirtyCheckRef.current = () => !!(readerView && readerView.dirty);
				return () => { if (dirtyCheckRef) dirtyCheckRef.current = () => false; };
			}, [readerView, dirtyCheckRef]);

			// 保存反馈 3.5s 后自动消失（saving 状态跟随请求生命周期，不自动清）
			useEffect(() => {
				if (!saveStatus || saveStatus.kind === "saving") return undefined;
				const t = setTimeout(() => setSaveStatus(null), 3500);
				return () => clearTimeout(t);
			}, [saveStatus && saveStatus.kind + ":" + (saveStatus && saveStatus.text)]);
			// 切换/关闭阅读窗时清空保存反馈，避免显示陈旧信息
			useEffect(() => {
				if (!readerFile) { setSaveStatus(null); setSaving(false); }
			}, [readerFile && readerFile.path]);

			// recent workspaces — silently hide on failure
			useEffect(() => {
				let cancelled = false;
				get("/recent-workspaces")
					.then((b) => {
						if (cancelled) return;
						if (b && Array.isArray(b.workspaces)) setRecent(b.workspaces);
					})
					.catch(() => { /* endpoint may not yet exist; silently hide */ });
				return () => { cancelled = true; };
			}, []);

			const refreshStatus = useCallback(() => {
				if (!workspace) return;
				setLoadingStatus(true);
				post("/book-status", { workspace })
					.then((b) => { setBookStatus(b); dismissError("book-status"); })
					.catch((err) => pushError("book-status", String((err && err.message) || err)))
					.finally(() => setLoadingStatus(false));
			}, [workspace, pushError, dismissError]);
			const refreshTree = useCallback(() => {
				if (!workspace) return;
				get("/tree", { workspace })
					.then((b) => {
						setTree(b.files || []);
						dismissError("tree");
					})
					.catch((err) => pushError("tree", String((err && err.message) || err)));
			}, [workspace, pushError, dismissError]);

			useEffect(() => {
				setBookStatus(null);
				setTree(null);
				setReaderFile(null);
				setReaderView(null);
				setGroupsOpen({});
				autoOpenedFor.current = null;
				if (workspace) { refreshStatus(); refreshTree(); }
			}, [workspace]); // eslint-disable-line react-hooks/exhaustive-deps

			// 把文件读取到 readerView，并设 readerFile
			const loadIntoReader = useCallback((rel, fileMeta) => {
				if (!workspace || !rel) return;
				get("/artifact", { workspace, path: rel })
					.then((b) => {
						const c = b && b.exists ? b.content : "";
						const ext = getExt(rel);
						// md 默认 preview；JSON 默认 source（结构化预览可点「预览」切换）
						const initialMode = defaultViewMode(rel);
						setReaderView({ content: c, mode: initialMode, editText: c, dirty: false, jsonError: null });
						setReaderFile(fileMeta || { path: rel, title: basename(rel), groupLabel: "文件" });
						dismissError("artifact-read");
						if (workspace) saveLastFile(workspace, rel);
					})
					.catch((err) => pushError("artifact-read", String((err && err.message) || err)));
			}, [workspace, pushError, dismissError]);
			const saveFile = useCallback(() => {
				if (!readerFile || !readerView) return;
				if (saving) return; // 防重复点击
				const text = readerView.editText;
				const meta = readerFile;
				// JSON 编辑态保存前校验
				if (getExt(meta.path) === "json") {
					const err = jsonParseError(text);
					if (err) {
						setReaderView({ ...readerView, jsonError: err });
						setSaveStatus({ kind: "err", text: "JSON 解析失败：" + err.message });
						toast({ kind: "error", text: "JSON 解析失败：" + err.message });
						return;
					}
				}
				setSaving(true);
				setSaveStatus({ kind: "saving", text: "正在保存…" });
				post("/write-artifact", { workspace, path: meta.path, content: text })
					.then((b) => {
						if (b && b.error) {
							setSaveStatus({ kind: "err", text: "保存失败：" + b.error });
							toast({ kind: "error", text: b.error });
							return;
						}
						setReaderView({ content: text, mode: readerView.mode === "edit" ? "preview" : readerView.mode, editText: text, dirty: false, jsonError: null });
						setSaveStatus({ kind: "ok", text: "已保存 " + meta.path });
						toast({ kind: "ok", text: "已保存: " + meta.path });
						refreshStatus();
						refreshTree();
					})
					.catch((err) => {
						const msg = String((err && err.message) || err);
						setSaveStatus({ kind: "err", text: "保存失败：" + msg });
						toast({ kind: "error", text: msg });
					})
					.finally(() => { setSaving(false); });
			}, [readerFile, readerView, workspace, toast, refreshStatus, refreshTree, saving]);

			// 切换 mode：离开 edit 时清 jsonError
			const onChangeMode = useCallback((next) => {
				setReaderView((v) => v ? { ...v, mode: next, jsonError: null } : v);
			}, []);
			const onChangeEditText = useCallback((next) => {
				setReaderView((v) => v ? { ...v, editText: next, dirty: next !== v.content, jsonError: null } : v);
			}, []);

			// 受保护的打开 / 关闭：dirty 时弹窗确认
			const readerOpenPath = useCallback((fileMeta) => {
				if (!fileMeta || !fileMeta.path) return;
				if (readerView && readerView.dirty) {
					if (!window.confirm("「" + (readerFile && readerFile.path) + "」有未保存修改，确定丢弃并打开新文件？")) return;
				}
				loadIntoReader(fileMeta.path, fileMeta);
			}, [readerView, readerFile, loadIntoReader]);
			const readerClose = useCallback(() => {
				if (readerView && readerView.dirty) {
					if (!window.confirm("「" + (readerFile && readerFile.path) + "」有未保存修改，确定丢弃并关闭？")) return;
				}
				if (workspace) clearLastFile(workspace);
				setReaderFile(null);
				setReaderView(null);
			}, [readerView, readerFile, workspace]);

			// 切换工作区/抽屉时，自动恢复最后打开的文件（仅对该 workspace 做一次）
			useEffect(() => {
				if (!workspace || !tree) return;
				if (autoOpenedFor.current === workspace) return;
				autoOpenedFor.current = workspace;
				const last = loadLastFile(workspace);
				if (last && tree.indexOf(last) >= 0 && !readerFile) {
					const tok = semanticEntryKeyFor(last);
					let meta = null;
					if (tok && tok.indexOf("semantic:") === 0) {
						const parts = tok.split(":");
						const g = SEMANTIC_GROUPS.find((x) => x.id === parts[1]);
						if (g && g.entries) {
							const e = g.entries.find((x) => x.id === parts[2]);
							if (e) meta = { path: last, title: e.title, groupLabel: g.title, dimKey: dimensionKeyForEntry(g, e) };
						}
					} else if (tok && tok.indexOf("chapter:") === 0) {
						const ch = tok.split(":")[1];
						meta = { path: last, title: "第 " + parseInt(ch, 10) + " 章", groupLabel: "章节" };
					}
					if (!meta) meta = { path: last, title: basename(last), groupLabel: "文件" };
					loadIntoReader(last, meta);
				} else if (last && tree.indexOf(last) < 0) {
					// 文件已不存在，清掉记忆
					clearLastFile(workspace);
				}
			}, [workspace, tree, readerFile, loadIntoReader]);

			const summary = bookStatus ? nextPendingStage(bookStatus.files) : null;
			const fileMaps = bookStatus ? (() => {
				const m = {};
				for (const f of (bookStatus.files || [])) m[f.path] = !!f.exists;
				return m;
			})() : {};

			// ── 手风琴辅助 ──
			const isGroupOpen = (id) => groupsOpen[id] !== false;
			const toggleGroupOpen = (id) => setGroupsOpen((prev) => ({ ...prev, [id]: !(prev[id] !== false) }));
			// 文件存在：tree 里有就当作已生成；bookStatus 标记存在也可
			const fileExistsAny = (rel) =>
				(Array.isArray(tree) && tree.indexOf(rel) >= 0) || !!fileMaps[rel];
			const gotoGroup = (g) => { if (g && g.workflow) gotoWorkflow(g.workflow); };
			const chapterNumbers = Array.isArray(tree) ? listChapterNumbers(tree) : [];
			// 右侧小字：已加载文件给字数/行数，未加载给扩展名
			const entryMeta = (path) => {
				if (readerFile && readerFile.path === path && readerView) {
					const st = countStats(readerView.content);
					const ext = getExt(path);
					if (ext === "md") return st.cjk + " 字 · " + st.lines + " 行";
					return st.lines + " 行 · " + st.chars + " 字符";
				}
				const ext = getExt(path);
				return ext ? ("." + ext) : "文件";
			};

			// ── 渲染辅助：组、语义条目、章节、子项 ──
			function chapterSubLabel(p) {
				if (p.endsWith("/chapter.md")) return "正文";
				if (p.endsWith("/single_chapter_guide.md")) return "单章指南";
				if (/diff_world_resolved\.md$/.test(p)) return "后验·世界";
				if (/diff_story_confirmed\.md$/.test(p)) return "后验·故事";
				if (/diff_character\.md$/.test(p)) return "后验·角色";
				if (/\/diff_.*\.md$/.test(p)) return "后验差异";
				if (p.endsWith("/world_state.md")) return "世界状态";
				if (p.endsWith("/world_events.md")) return "世界事件";
				if (p.endsWith("/character_state_long.md")) return "长线角色";
				if (p.endsWith("/character_minor.md")) return "次要角色";
				if (p.endsWith("/storyboard.md")) return "分镜";
				if (p.endsWith("/world_foundation_trimmed.md")) return "裁剪世界观";
				if (p.endsWith("/character_profiles_trimmed.md")) return "裁剪角色";
				return "";
			}
			function renderSemanticRow(g, e) {
				const path = e.path;
				const isOpen = readerFile && readerFile.path === path;
				const exists = fileExistsAny(path);
				const meta = { path, title: e.title, groupLabel: g.title, dimKey: dimensionKeyForEntry(g, e) };
				return h("div", { key: path },
					h("div", {
						className: "dsh-bishu-entry-row" + (isOpen ? " expanded" : "") + (!exists ? " disabled" : ""),
						onClick: exists
							? () => { if (isOpen) readerClose(); else readerOpenPath(meta); }
							: undefined,
					},
						h("span", { className: "dsh-bishu-entry-dot " + (exists ? "done" : "miss") }),
						h("span", { className: "dsh-bishu-entry-name" }, e.title),
						exists
							? h("span", { className: "dsh-bishu-entry-meta" }, entryMeta(path))
							: h("button", {
								className: "dsh-bishu-entry-goto",
								onClick: (ev) => { ev.stopPropagation(); gotoGroup(g); },
							}, "前往生成 →"),
					),
				);
			}
			function renderChapterSublist(g, chStr, chNum) {
				const subs = chapterSubFiles(tree, parseInt(chStr, 10));
				const order = (p) => {
					if (p.endsWith("/chapter.md")) return 0;
					if (p.endsWith("/single_chapter_guide.md")) return 1;
					if (/\/diff_.*\.md$/.test(p)) return 2;
					return 3;
				};
				const sorted = subs.slice().sort((a, b) => {
					const oa = order(a), ob = order(b);
					if (oa !== ob) return oa - ob;
					return a.localeCompare(b);
				});
				return h("div", { key: "sub-" + chStr, className: "dsh-bishu-entry-sublist" },
					sorted.map((p) => {
						const active = readerFile && readerFile.path === p;
						return h("div", {
							key: p,
							className: "dsh-bishu-entry-sub" + (active ? " active" : ""),
							onClick: () => {
								const meta = { path: p, title: "第 " + chNum + " 章 · " + chapterSubLabel(p), groupLabel: "章节" };
								if (active) readerClose(); else readerOpenPath(meta);
							},
							title: p,
						},
							h("span", { className: "ic" }, fileIconText(p)),
							h("span", { className: "p" }, basename(p)),
							h("span", { className: "dsh-bishu-entry-meta" }, chapterSubLabel(p)),
						);
					}),
				);
			}
			function renderChapterRow(g, chNum) {
				const chStr = String(chNum).padStart(4, "0");
				const bodyPath = "story/" + chStr + "/chapter.md";
				const exists = fileExistsAny(bodyPath);
				const isChapterActive = !!(readerFile && readerFile.path && readerFile.path.indexOf("story/" + chStr + "/") === 0);
				const subs = exists ? chapterSubFiles(tree, parseInt(chStr, 10)) : [];
				const showSub = isChapterActive && exists && subs.length > 0;
				return h("div", { key: chStr },
					h("div", {
						className: "dsh-bishu-entry-row" + (isChapterActive ? " expanded" : "") + (!exists ? " disabled" : ""),
						onClick: exists
							? () => {
								if (isChapterActive) { readerClose(); return; }
								// 整行点击 = 打开 chapter.md（也方便从空子列表开始阅读）
								readerOpenPath({ path: bodyPath, title: "第 " + chNum + " 章 · 正文", groupLabel: "章节" });
							}
							: undefined,
					},
						h("span", { className: "dsh-bishu-entry-dot " + (exists ? "done" : "miss") }),
						h("span", { className: "dsh-bishu-entry-name" }, "第 " + chNum + " 章"),
						exists
							? h("span", { className: "dsh-bishu-entry-meta" }, entryMeta(bodyPath))
							: h("button", {
								className: "dsh-bishu-entry-goto",
								onClick: (ev) => { ev.stopPropagation(); gotoGroup(g); },
							}, "前往生成 →"),
					),
					showSub ? renderChapterSublist(g, chStr, chNum) : null,
				);
			}
			function renderGroup(g) {
				const open = isGroupOpen(g.id);
				const isChapter = !!g.chapterBased;
				const entries = isChapter ? [] : g.entries;
				const total = isChapter ? chapterNumbers.length : entries.length;
				let done = 0;
				if (isChapter) done = chapterNumbers.length;
				else for (const e of entries) if (fileExistsAny(e.path)) done++;
				const allDone = total > 0 && done === total;
				return h("div", { key: g.id, className: "dsh-bishu-accordion-group" },
					h("div", {
						className: "dsh-bishu-accordion-head" + (open ? " open" : "") + (allDone ? " prog-done" : ""),
						onClick: () => toggleGroupOpen(g.id),
					},
						h("span", { className: "ic" }, g.icon || "📄"),
						h("span", { className: "name" }, g.title),
						h("span", { className: "prog" }, isChapter ? (total + " 章") : (done + "/" + total)),
						h("span", { className: "chv" }, makeChevron(open)),
					),
					open
						? h("div", { className: "dsh-bishu-accordion-entries" },
							isChapter
								? chapterNumbers.map((n) => renderChapterRow(g, n))
								: entries.map((e) => renderSemanticRow(g, e)),
						)
						: null,
				);
			}

			return h("div", null,
				h(SectionCard, { icon: h("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M2 4.5h4l1.5 1.5h6.5v6.5a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5z" })), title: "书籍工作区", sub: "所有产物落在该目录" },
					h("div", { className: "dsh-bishu-field" },
						h("label", { className: "dsh-bishu-label" }, "工作区路径", h("span", { className: "req" }, "*")),
						h("div", { className: "dsh-bishu-wsrow" },
							h("input", {
								className: "dsh-bishu-input",
								placeholder: "绝对路径，例如 D:/books/my-novel",
								value: workspace,
								onChange: (ev) => { setWorkspace(ev.target.value); saveWorkspace(ev.target.value); },
							}),
							h("button", { className: "dsh-bishu-iconbtn", title: "选择目录", onClick: () => pickFolder(setWorkspace) }, folderIcon),
							h("button", { className: "dsh-bishu-btn dsh-bishu-btn-ghost dsh-bishu-btn-small", onClick: () => openFolder(workspace), title: "在资源管理器中打开" }, "打开"),
						),
						recent && recent.length > 0 ? h("div", { className: "dsh-bishu-recent" },
							h("div", { className: "lbl" }, "最近工作区"),
							h("select", {
								className: "dsh-bishu-input",
								value: "",
								onChange: (ev) => {
									const v = ev.target.value;
									if (v) { setWorkspace(v); saveWorkspace(v); }
									ev.target.value = "";
								},
							},
								h("option", { value: "" }, "切换到…"),
								recent.map((p) => h("option", { key: p, value: p }, p)),
							),
						) : null,
					),
				),

				h(SectionCard, { icon: h("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M2 3h12M2 7h12M2 11h12M2 15h12" })), title: "书籍进度", sub: "5 阶段流水线" },
					!workspace ? h("div", { className: "dsh-bishu-empty" }, "请先填写书籍工作区") :
					loadingStatus && !bookStatus ? h("div", { className: "dsh-bishu-empty" }, "检查中…") :
					bookStatus ? h("div", null,
						h("div", { className: "dsh-bishu-pipeline" },
							STAGES.map((s, i) => {
								const r = summarizeStage(bookStatus.files, s);
								const cls = r.done ? "dsh-bishu-stage done" : (r.present.length > 0 ? "dsh-bishu-stage partial" : "dsh-bishu-stage");
								return h("div", { key: s.id, style: { display: "contents" } },
									i > 0 ? h("div", { className: "dsh-bishu-stage-arrow" },
										h("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" },
											h("path", { d: "M3 8h10M9 4l4 4-4 4" })),
									) : null,
									h("div", { className: cls, title: s.files.join("\n") },
										h("div", { className: "dsh-bishu-stage-icon" }, r.done ? "\u2713" : String(i + 1)),
										h("div", { className: "dsh-bishu-stage-label" }, s.label),
										h("div", { className: "dsh-bishu-stage-files" },
											"对应工作流 " + s.workflow + " · " + r.present.length + "/" + r.total + " 文件",
										),
									),
								);
							}),
						),
						h("div", { style: { display: "flex", gap: 6, marginTop: 10, alignItems: "center" } },
							h("button", { className: "dsh-bishu-btn dsh-bishu-btn-ghost dsh-bishu-btn-small", onClick: refreshStatus, disabled: loadingStatus }, loadingStatus ? "检查中…" : "刷新状态"),
							h("span", { className: "dsh-bishu-spacer" }),
						),
						summary ? h("div", { style: { marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid var(--dsw-alias-border-l1,#2a2a2a)", background: "var(--dsw-alias-bg-layer-2,#1c1c1c)" } },
							h("div", { style: { fontSize: 12, fontWeight: 700, marginBottom: 4 } }, "下一步建议"),
							h("div", { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary,#bbb)", marginBottom: 8 } },
								"阶段「" + summary.stage.label + "」未完成 → 启动 ",
								h("span", { className: "dsh-bishu-ws-link", style: { display: "inline" } }, summary.stage.workflow),
								"（缺 " + summary.summary.missing.length + " 文件）",
							),
							h("button", {
								className: "dsh-bishu-btn dsh-bishu-btn-primary dsh-bishu-btn-small",
								onClick: () => gotoWorkflow(summary.stage.workflow),
							}, "前往工作流 →"),
						) : h("div", { style: { marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 45%,transparent)", background: "color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 8%,transparent)", fontSize: 12, color: "var(--dsw-alias-state-success-primary,#22c55e)" } }, "所有阶段已完成"),
					) : null,
				),

				h(SectionCard, { icon: h("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M3 2.5h10v11H3z" }), h("path", { d: "M5.5 6h5M5.5 8.5h5" })), title: "产物浏览", sub: "语义分组 · 手风琴 · 点条目打开阅读窗" },
					!workspace ? h("div", { className: "dsh-bishu-empty" }, "请先填写书籍工作区") :
					h("div", null,
						h("div", { style: { display: "flex", gap: 6, marginBottom: 8, alignItems: "center" } },
							h("button", { className: "dsh-bishu-btn dsh-bishu-btn-ghost dsh-bishu-btn-small", onClick: refreshTree, title: "重新拉取产物列表" }, "刷新"),
							h("span", { className: "dsh-bishu-spacer" }),
							tree ? h("span", { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary,#888)" } }, tree.length + " 个文件") : null,
						),
						// 语义分组手风琴
						h("div", { className: "dsh-bishu-accordion" },
							SEMANTIC_GROUPS.map(renderGroup)
						),
						// 兜底：原始文件列表（默认收起，访问 cache/、archive/ 等语义结构外文件）
						h("div", { className: "dsh-bishu-fallback" },
							h("details", null,
								h("summary", null, "原始文件列表（cache、archive 等）(" + (Array.isArray(tree) ? tree.length : 0) + " 个）"),
								!Array.isArray(tree)
									? h("div", { className: "dsh-bishu-fallback-empty" }, "未加载，先点击上方「刷新」")
									: tree.length === 0
										? h("div", { className: "dsh-bishu-fallback-empty" }, "工作区还没有文件")
										: h("div", { className: "dsh-bishu-fallback-list" },
											tree.slice().sort().map((p) => {
												const active = readerFile && readerFile.path === p;
												return h("div", {
													key: p,
													className: "row" + (active ? " active" : ""),
													title: p,
													onClick: () => {
														const meta = { path: p, title: basename(p), groupLabel: "文件" };
														if (active) readerClose(); else readerOpenPath(meta);
													},
												},
													h("span", null, fileIconText(p)),
													h("span", { style: { opacity: .55, marginRight: 4 } }, " "),
													h("span", null, p),
												);
											}),
										),
							),
						),
					),
				),

				// 全局阅读窗（最外层挂载，避免被章节组/Section 嵌套影响）
				h(OverlayReader, {
					readerFile,
					content: readerView ? readerView.content : "",
					mode: readerView ? readerView.mode : "preview",
					editText: readerView ? readerView.editText : "",
					dirty: !!(readerView && readerView.dirty),
					error: readerView ? readerView.jsonError : null,
					saving,
					saveStatus,
					onClose: readerClose,
					onChangeMode,
					onChangeEditText,
					onSave: saveFile,
					toast,
				}),
			);
		}

		// ── WorkflowsTab ────────────────────────────────────────────
		function WorkflowsTab({ workspace, setWorkspace, pushError, dismissError, toast, gotoRun, initialSelId, clearInitialSel }) {
			const { folderIcon, pickFolder } = useHelpers({ toast, pushError });
			const providers = useProviders();
			const [workflows, setWorkflows] = useState([]);
			const [loadingWf, setLoadingWf] = useState(true);
			const [runs, setRuns] = useState([]);
			const [selId, setSelId] = useState(initialSelId || null);
			const [def, setDef] = useState(null);
			const [paramVals, setParamVals] = useState({});
			const [validation, setValidation] = useState({});
			const [starting, setStarting] = useState(false);
			const [modelSel, setModelSel] = useState("");
			const [nodeModelSel, setNodeModelSel] = useState({});
			const [approval, setApproval] = useState(false);
			const [quickChapter, setQuickChapter] = useState("");

			// sync initial selection from outside (book tab "go to workflow")
			useEffect(() => {
				if (initialSelId) { setSelId(initialSelId); clearInitialSel(); }
			}, [initialSelId, clearInitialSel]);

			const loadWorkflows = useCallback(() => {
				setLoadingWf(true);
				get("/workflows")
					.then((b) => { setWorkflows(b.workflows || []); dismissError("wf-list"); })
					.catch((err) => pushError("wf-list", String((err && err.message) || err)))
					.finally(() => setLoadingWf(false));
			}, [pushError, dismissError]);
			useEffect(() => { loadWorkflows(); }, [loadWorkflows]);

			// fetch latest run per workflow (for status badge on workflow card)
			useEffect(() => {
				get("/runs")
					.then((b) => setRuns(b.runs || []))
					.catch(() => { /* optional */ });
			}, []);

			useEffect(() => {
				if (!selId) { setDef(null); return; }
				get("/workflow", { workflow_id: selId })
					.then((b) => {
						setDef(b.workflow);
						setParamVals(initParamDefaults(b.workflow));
						setValidation({});
						const prefs = b.model_prefs || {};
						setModelSel(prefs.model ? prefs.model.provider + "/" + prefs.model.model : "");
						const nm = {};
						for (const at of (b.workflow.agent_types || [])) {
							const p = prefs.node_models && prefs.node_models[at];
							nm[at] = p ? p.provider + "/" + p.model : "";
						}
						setNodeModelSel(nm);
						dismissError("wf-def");
					})
					.catch((err) => pushError("wf-def", String((err && err.message) || err)));
			}, [selId, pushError, dismissError]);

			// infer next chapter number from /tree when workspace changes
			useEffect(() => {
				if (!workspace) { setQuickChapter(""); return; }
				let cancelled = false;
				get("/tree", { workspace })
					.then((b) => {
						if (cancelled) return;
						const files = b.files || [];
						const chapters = [];
						const re = /^story\/(\d{4})\/chapter\.md$/i;
						for (const f of files) {
							const m = f.match(re);
							if (m) chapters.push(parseInt(m[1], 10));
						}
						if (chapters.length === 0) {
							setQuickChapter("0001");
						} else {
							chapters.sort((a, b) => a - b);
							const next = chapters[chapters.length - 1] + 1;
							setQuickChapter(String(next).padStart(4, "0"));
						}
					})
					.catch(() => { setQuickChapter(""); });
				return () => { cancelled = true; };
			}, [workspace]);

			const latestByWorkflow = useRef({});
			latestByWorkflow.current = (() => {
				const m = {};
				for (const r of runs) if (!m[r.workflow_id]) m[r.workflow_id] = r;
				return m;
			})();

			const startRun = (overrides) => {
				const wsel = (overrides && overrides.workspace) || workspace;
				const wid = (overrides && overrides.workflow_id) || selId;
				const params = (overrides && overrides.parameters) || paramVals;
				if (!wid) { toast({ kind: "warn", text: "请选择工作流" }); return; }
				if (!wsel) { toast({ kind: "warn", text: "请填写工作区路径" }); return; }
				if (!overrides) {
					const errs = {};
					const vars = def ? (def.variables || []).filter((v) => !v.hidden && v.required) : [];
					for (const v of vars) {
						const effective = String(params[v.key] ?? (def.variables.find((x) => x.key === v.key) || {}).default ?? "").trim();
						if (!effective) errs[v.key] = "必填项";
					}
					if (Object.keys(errs).length > 0) { setValidation(errs); return; }
				}
				setValidation({});
				setStarting(true);
				const model = modelSel ? { provider: modelSel.split("/")[0], model: modelSel.slice(modelSel.indexOf("/") + 1) } : undefined;
				const nodeModels = {};
				for (const [at, v] of Object.entries(nodeModelSel || {})) {
					if (!v) continue;
					const i = v.indexOf("/");
					nodeModels[at] = { provider: v.slice(0, i), model: v.slice(i + 1) };
				}
				post("/run", { workflow_id: wid, workspace: wsel, parameters: params, model, node_models: nodeModels, approval })
					.then((b) => {
						if (b && b.error) { toast({ kind: "error", text: b.error }); return; }
						saveWorkspace(wsel);
						const wfDef = workflows.find((w) => w.workflow_id === wid);
						toast({ kind: "ok", text: "已启动 " + (wfDef && wfDef.name ? wfDef.name : wid) });
						gotoRun({ run_id: b.run_id, workflow_id: b.workflow_id, workflow_name: (wfDef && wfDef.name) || wid, workspace: wsel, status: b.status, steps: [], produced_files: [], elapsed_ms: null, error: null, current_node: null, parameters: params, model_override: model || null, node_models: nodeModels });
					})
					.catch((err) => toast({ kind: "error", text: String((err && err.message) || err) }))
					.finally(() => setStarting(false));
			};

			const quickStart = (workflowId) => {
				const chap = String(quickChapter || "").trim();
				if (!chap) { toast({ kind: "warn", text: "请填写章节号（4 位数字，如 0001）" }); return; }
				if (!workspace) { toast({ kind: "warn", text: "请先选择书籍工作区" }); return; }
				startRun({
					workflow_id: workflowId,
					workspace,
					parameters: { chapter_number: chap, prev_chapter: String(Math.max(0, parseInt(chap, 10) - 1)).padStart(4, "0") },
				});
			};

			const formVars = def ? (def.variables || []).filter((v) => !v.hidden) : [];
			const wfOrder = { build: 0, character: 1, "story-plan": 2, outline: 3, mvp: 4, polish: 5, "post-hoc": 6 };
			const setup = workflows.slice().sort((a, b) => (wfOrder[a.workflow_id] ?? 99) - (wfOrder[b.workflow_id] ?? 99));

			function WfCard({ wf, showArrow, isLast }) {
				const last = latestByWorkflow.current[wf.workflow_id];
				return h("div", { style: { display: "contents" } },
					showArrow ? h("div", { className: "dsh-bishu-stage-arrow" },
						h("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M3 8h10M9 4l4 4-4 4" })),
					) : null,
					h("div", {
						className: "dsh-bishu-wfrow" + (selId === wf.workflow_id ? " selected" : ""),
						style: { flex: 1, flexDirection: "column", alignItems: "stretch", padding: "10px 12px", gap: 6 },
						onClick: () => setSelId(wf.workflow_id),
					},
						h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
							h("span", { className: "id" }, wf.workflow_id),
							h("span", { className: "name" }, wf.name),
							last ? h(StatusTag, { status: last.status }) : h("span", { className: "dsh-bishu-tag wait" }, "未启动"),
						),
						h("div", { style: { display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: "var(--dsw-alias-label-secondary,#888)" } },
							h("span", null, "v" + (wf.version || 1)),
							h("span", null, wf.nodes + " 节点"),
							h("span", null, ((wf.required_variables || []).length) + " 必填"),
						),
					),
				);
			}

			return h("div", null,
				h(SectionCard, { icon: h("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M3 8h10M9 4l4 4-4 4" })), title: "下一章快捷", sub: "先填章节号，一键启动 mvp / polish / post-hoc" },
					h("div", { className: "dsh-bishu-field" },
						h("label", { className: "dsh-bishu-label" }, "工作区"),
						h("div", { className: "dsh-bishu-wsrow" },
							h("input", {
								className: "dsh-bishu-input",
								placeholder: "绝对路径（默认取书籍 tab 当前选择）",
								value: workspace,
								onChange: (ev) => { setWorkspace(ev.target.value); saveWorkspace(ev.target.value); },
							}),
							h("button", { className: "dsh-bishu-iconbtn", title: "选择目录", onClick: () => pickFolder(setWorkspace) }, folderIcon),
						),
					),
					h("div", { className: "dsh-bishu-field" },
						h("label", { className: "dsh-bishu-label" }, "章节号（4 位数字）", h("span", { className: "vkey" }, "chapter_number")),
						h("input", {
							className: "dsh-bishu-input",
							placeholder: "例如 0001",
							value: quickChapter,
							onChange: (ev) => setQuickChapter(ev.target.value),
						}),
						h("div", { className: "dsh-bishu-desc" }, "默认推断为「已有最大章节号 + 1」，可在工作区没章节时改为 0001"),
					),
					h("div", { className: "dsh-bishu-quickrow" },
						h("button", { className: "dsh-bishu-btn dsh-bishu-btn-primary", disabled: starting || !workspace || !quickChapter, onClick: () => quickStart("mvp") }, starting ? "启动中…" : "▶ mvp"),
						h("button", { className: "dsh-bishu-btn dsh-bishu-btn-ghost", disabled: starting || !workspace || !quickChapter, onClick: () => quickStart("polish"), title: "润色：可选，会覆盖 story/<章节号>/chapter.md" }, "✎ polish"),
						h("button", { className: "dsh-bishu-btn dsh-bishu-btn-ghost", disabled: starting || !workspace || !quickChapter, onClick: () => quickStart("post-hoc") }, "🔍 post-hoc"),
					),
				),

				h(SectionCard, { icon: h("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M3 2.5h6l4 4v7H3z" }), h("path", { d: "M9 2.5v4h4" })), title: "流水线", sub: "按推荐顺序分组" },
					loadingWf ? h("div", { className: "dsh-bishu-empty" }, "加载中…") :
					setup.length === 0 ? h("div", { className: "dsh-bishu-empty" }, "没有可用的工作流") :
					h("div", { className: "dsh-bishu-pipelinegroup" },
						h("div", { className: "gtitle" }, "新书前置"),
						h("div", { className: "dsh-bishu-pipeline" },
							setup.filter((w) => ["build", "character", "story-plan", "outline"].includes(w.workflow_id)).map((wf, i, arr) => h(WfCard, { key: wf.workflow_id, wf, showArrow: i > 0 })),
						),
						h("div", { className: "gtitle", style: { marginTop: 14 } }, "章节循环"),
						h("div", { className: "dsh-bishu-pipeline" },
							setup.filter((w) => ["mvp", "polish", "post-hoc"].includes(w.workflow_id)).map((wf, i, arr) => h(WfCard, { key: wf.workflow_id, wf, showArrow: i > 0 })),
						),
					),
				),

				def ? h(SectionCard, { icon: h("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M4 3h8v10H4z" }), h("path", { d: "M6.5 6h3M6.5 8.5h3" })), title: "启动表单", sub: def.name + " · " + def.nodes + " 节点" },
					h("div", { className: "dsh-bishu-field" },
						h("label", { className: "dsh-bishu-label" }, "运行模型"),
						h("select", {
							className: "dsh-bishu-input",
							style: { appearance: "auto" },
							value: modelSel,
							onChange: (ev) => setModelSel(ev.target.value),
						},
							h("option", { value: "" }, "默认（主会话模型）"),
							providers.map((p) => p.models.map((m) => h("option", { key: p.id + "/" + m.id, value: p.id + "/" + m.id }, p.name + " · " + m.name))),
						),
						h("div", { className: "dsh-bishu-desc" }, "整个工作流的 agent 节点都用所选模型执行；缺省继承主会话默认模型"),
					),
					h("details", { className: "dsh-bishu-details" },
						h("summary", null, "\u2699 节点模型（按 agent 节点单独指定，可选）"),
						h("div", null,
							(def.agent_types || []).map((at) => h("div", { key: at, className: "dsh-bishu-node" },
								h("span", { className: "at", title: at }, at),
								h("select", {
									className: "dsh-bishu-input",
									style: { appearance: "auto" },
									value: nodeModelSel[at] || "",
									onChange: (ev) => setNodeModelSel((prev) => ({ ...prev, [at]: ev.target.value })),
								},
									h("option", { value: "" }, "继承运行模型"),
									providers.map((p) => p.models.map((m) => h("option", { key: p.id + "/" + m.id, value: p.id + "/" + m.id }, p.name + " · " + m.name))),
								),
							)),
						),
					),
					h("div", { className: "dsh-bishu-field" },
						h("label", { className: "dsh-bishu-label" }, "书籍工作区", h("span", { className: "req" }, "*")),
						h("div", { className: "dsh-bishu-wsrow" },
							h("input", {
								className: "dsh-bishu-input",
								placeholder: "选择或输入书籍目录（绝对路径）",
								value: workspace,
								onChange: (ev) => { setWorkspace(ev.target.value); saveWorkspace(ev.target.value); },
							}),
							h("button", { className: "dsh-bishu-iconbtn", title: "选择目录", onClick: () => pickFolder(setWorkspace) }, folderIcon),
						),
					),
					formVars.map((v) => h("div", { key: v.key, className: "dsh-bishu-field" },
						h("label", { className: "dsh-bishu-label" },
							v.name,
							v.required ? h("span", { className: "req" }, "*") : null,
							h("span", { className: "vkey" }, "{{" + v.key + "}}"),
						),
						v.type === "textarea"
							? h("textarea", {
								className: "dsh-bishu-textarea" + (validation[v.key] ? " err" : ""),
								placeholder: v.default || v.description || "",
								value: paramVals[v.key] ?? v.default ?? "",
								onChange: (ev) => setParamVals((prev) => ({ ...prev, [v.key]: ev.target.value })),
							})
							: h("input", {
								className: "dsh-bishu-input" + (validation[v.key] ? " err" : ""),
								placeholder: v.default || v.description || (v.type === "file" ? "相对工作区的文件路径" : ""),
								value: paramVals[v.key] ?? v.default ?? "",
								onChange: (ev) => setParamVals((prev) => ({ ...prev, [v.key]: ev.target.value })),
							}),
						v.description ? h("div", { className: "dsh-bishu-desc" }, v.description) : null,
						validation[v.key] ? h("div", { className: "dsh-bishu-fielderr" }, "请填写此项") : null,
					)),
					h("label", { className: "dsh-bishu-check" },
						h("input", { type: "checkbox", checked: approval, onChange: (ev) => setApproval(ev.target.checked) }),
						"逐节点审批（每个 agent 节点产出后暂停审批）"),
					h("button", { className: "dsh-bishu-btn dsh-bishu-btn-primary", style: { marginTop: 6 }, disabled: starting, onClick: () => startRun() },
						starting ? "启动中…" : "\u25b6 启动工作流"),
				) : h(SectionCard, { icon: h("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M4 3h8v10H4z" })), title: "启动表单", sub: "请在上方流水线选一条工作流" },
					h("div", { className: "dsh-bishu-empty" }, selId ? "加载中…" : "未选择工作流"),
				),
			);
		}

		// ── RunsTab ─────────────────────────────────────────────────
		function RunsTab({ workspace, pushError, dismissError, toast, activeRun, setActiveRun }) {
			const { folderIcon, openFolder } = useHelpers({ toast, pushError });
			const [runs, setRuns] = useState([]);
			const [filter, setFilter] = useState("");
			const [loading, setLoading] = useState(false);

			const refresh = useCallback(() => {
				setLoading(true);
				get("/runs")
					.then((b) => { setRuns(b.runs || []); dismissError("runs-list"); })
					.catch((err) => pushError("runs-list", String((err && err.message) || err)))
					.finally(() => setLoading(false));
			}, [pushError, dismissError]);

			// refresh on tab open; also poll while any run is active or pending
			const hasActive = runs.some((r) => r.status === "running" || r.status === "awaiting_approval" || r.status === "queued");
			useEffect(() => {
				refresh();
				if (!hasActive) return;
				const timer = setInterval(refresh, 2000);
				return () => clearInterval(timer);
			}, [hasActive, refresh]);

			const filtered = filter ? runs.filter((r) => r.status === filter) : runs;
			const chips = [["", "全部"], ["running", "运行中"], ["awaiting_approval", "待审批"], ["completed", "已完成"], ["failed", "失败"]];

			const openArtifact = (rel) => {
				if (!workspace || !rel) return;
				// piggyback on artifact fetch + show inside active run as inline preview
				get("/artifact", { workspace, path: rel })
					.then((b) => {
						const c = b && b.exists ? b.content : "";
						setActiveRun((prev) => prev && prev.run_id === (activeRun && activeRun.run_id) ? { ...prev, _inlineArtifact: { path: rel, content: c } } : prev);
					})
					.catch((err) => pushError("runs-artifact", String((err && err.message) || err)));
			};

			return activeRun && activeRun.run_id
				? h(RunDetail, {
					runKey: activeRun.run_id,
					initialRun: activeRun,
					onBack: () => setActiveRun(null),
					openArtifact,
					openFolder,
					folderIcon,
					toast,
					pushError,
					dismissError,
					runs,
				})
				: h("div", null,
					h(SectionCard, { icon: h("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M2.5 3h11v10h-11z" }), h("path", { d: "M2.5 6.5h11" })), title: "运行记录", sub: "点行查看详情" },
						h("div", { className: "dsh-bishu-tagbar" },
							chips.map(([val, label]) =>
								h("button", { key: val, className: "dsh-bishu-tabpill" + (filter === val ? " active" : ""), onClick: () => setFilter(val) }, label)),
						),
						loading && runs.length === 0 ? h("div", { className: "dsh-bishu-empty" }, "加载中…") :
						filtered.length === 0 ? h("div", { className: "dsh-bishu-empty" }, "没有匹配的运行") :
						filtered.map((r) => h("div", {
							key: r.run_id,
							className: "dsh-bishu-runrow",
							onClick: () => setActiveRun({ run_id: r.run_id, workflow_id: r.workflow_id, workflow_name: r.workflow_name, workspace: r.workspace, status: r.status, current_node: r.current_node, steps: [], error: r.error, produced_files: [], elapsed_ms: r.elapsed_ms, parameters: r.parameters, model_override: r.model_override, node_models: r.node_models }),
						},
							h(StatusDot, { status: r.status }),
							h("div", { className: "main" },
								h("div", { className: "wf" }, r.workflow_name || r.workflow_id),
								h("div", { className: "meta" },
									h("span", { className: "mono" }, r.run_id),
									h("span", null, fmtTime(r.started_at)),
									r.elapsed_ms != null ? h("span", null, fmtDur(r.elapsed_ms)) : null,
									h("span", null, r.steps_done + "/" + r.steps_total + " 节点"),
									h("span", null, basename(r.workspace || "")),
								),
								(r.steps_total > 0) ? h("div", { className: "dsh-bishu-progress" },
									h("div", { className: "dsh-bishu-progress-inner", style: { width: (r.steps_done / r.steps_total) * 100 + "%" } }),
								) : null,
							),
							h(StatusTag, { status: r.status }),
						)),
					),
				);
		}

		// ── RunDetail ───────────────────────────────────────────────
		function RunDetail({ runKey, initialRun, onBack, openArtifact, openFolder, folderIcon, toast, pushError, dismissError, runs }) {
			// local state mirrors server run; user input (approval feedback / full preview) is kept separately
			const [run, setRun] = useState(initialRun || {});
			const [approvalFeedback, setApprovalFeedback] = useState("");
			const [approvalFull, setApprovalFull] = useState(null);
			const [approvalFullLoading, setApprovalFullLoading] = useState(false);
			const [approving, setApproving] = useState(false);

			// reset local state when run id changes (but preserve while polling updates the same run)
			useEffect(() => {
				setRun(initialRun || {});
				setApprovalFeedback("");
				setApprovalFull(null);
			}, [runKey]);

			// poll
			useEffect(() => {
				if (!runKey) return;
				let cancelled = false;
				const tick = () => {
					get("/status", { run_id: runKey })
						.then((b) => {
							if (cancelled) return;
							setRun((prev) => ({ ...prev, ...b }));
							dismissError("run-status");
						})
						.catch((err) => { if (cancelled) return; pushError("run-status", String((err && err.message) || err)); });
				};
				tick();
				const timer = setInterval(tick, 2000);
				return () => { cancelled = true; clearInterval(timer); };
			}, [runKey, pushError, dismissError]);

			const approveNode = (approved) => {
				if (approving) return;
				if (!approved && !String(approvalFeedback || "").trim()) {
					toast({ kind: "warn", text: "拒绝时必须填写反馈" });
					return;
				}
				setApproving(true);
				post("/approve", { run_id: run.run_id, approved, feedback: approved ? "" : approvalFeedback })
					.then((b) => {
						if (b && b.error) { toast({ kind: "error", text: b.error }); return; }
						toast({ kind: "ok", text: approved ? "已通过，继续执行" : "已拒绝，节点将按反馈重新生成" });
						setApprovalFeedback("");
						setApprovalFull(null);
					})
					.catch((err) => toast({ kind: "error", text: String((err && err.message) || err) }))
					.finally(() => setApproving(false));
			};

			const loadFull = () => {
				const pa = run.pending_approval;
				if (!pa) return;
				setApprovalFullLoading(true);
				get("/artifact", { workspace: run.workspace, path: pa.output_path })
					.then((b) => setApprovalFull(b && b.exists ? b.content : "(无法读取该文件)"))
					.catch((err) => setApprovalFull(String((err && err.message) || err)))
					.finally(() => setApprovalFullLoading(false));
			};

			const pa = run.pending_approval;
			const steps = run.steps || [];
			const done = steps.filter((s) => s.status === "completed").length;
			const isTerminal = run.status === "completed" || run.status === "failed";

			const redoRun = () => {
				const model = run.model_override || null;
				const nodeModels = run.node_models || {};
				post("/run", {
					workflow_id: run.workflow_id,
					workspace: run.workspace,
					parameters: run.parameters || {},
					model,
					node_models: nodeModels,
				})
					.then((b) => {
						if (b && b.error) { toast({ kind: "error", text: b.error }); return; }
						toast({ kind: "ok", text: "已重做: " + (b.run_id || "") });
						onBack();
					})
					.catch((err) => toast({ kind: "error", text: String((err && err.message) || err) }));
			};

			return h("div", null,
				h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 } },
					h("button", { className: "dsh-bishu-back", onClick: onBack }, "\u2190 返回"),
					h("span", { style: { fontSize: 13, fontWeight: 700 } }, run.run_id),
					h("span", { className: "dsh-bishu-spacer" }),
					isTerminal ? h("button", { className: "dsh-bishu-btn dsh-bishu-btn-ghost dsh-bishu-btn-small", onClick: redoRun }, "\u21bb 重做") : null,
				),
				h("div", { className: "dsh-bishu-banner" },
					h(StatusTag, { status: run.status }),
					h("span", null, run.workflow_name || run.workflow_id),
					h("span", { className: "mono" }, fmtDur(run.elapsed_ms)),
					run.current_node ? h("span", { style: { color: "var(--dsw-alias-label-secondary,#999)", fontSize: 12 } }, "→ " + run.current_node.label) : null,
				),
				run.workspace ? h("div", { className: "dsh-bishu-ws-link", style: { marginTop: 8 }, onClick: () => openFolder(run.workspace), title: "在资源管理器中打开" },
					folderIcon, h("span", { className: "p" }, run.workspace)) : null,
				run.error ? h("div", { className: "dsh-bishu-error", style: { marginTop: 8 } }, run.error) : null,
				pa ? h("div", { className: "dsh-bishu-approve" },
					h("div", { className: "head" }, "\u26a0 节点待审批"),
					h("div", { className: "meta" },
						"节点：", pa.node_label,
						"　类型：", pa.agent_type,
						"　第 " + pa.attempt + " 次尝试",
					),
					h("div", { className: "meta" }, "产出文件：", pa.output_path),
					h("div", null,
						approvalFull != null
							? h(MdView, { text: approvalFull, fallback: "(无法读取该文件)", className: "dsh-bishu-approve-md" })
							: h(MdView, { text: pa.preview, fallback: "（无预览）", className: "dsh-bishu-approve-md" }),
					),
					h("button", { className: "dsh-bishu-btn dsh-bishu-btn-ghost dsh-bishu-btn-small", onClick: () => {
						if (approvalFull != null) { setApprovalFull(null); return; }
						loadFull();
					}, disabled: approvalFullLoading }, approvalFullLoading ? "加载中…" : (approvalFull != null ? "收起完整产出" : "查看完整产出")),
					h("textarea", {
						className: "dsh-bishu-textarea",
						style: { marginTop: 8, minHeight: 52 },
						placeholder: "拒绝时必填反馈（例如：世界观设定不够具体 / 力量体系要更严谨 …）",
						value: approvalFeedback,
						onChange: (ev) => setApprovalFeedback(ev.target.value),
					}),
					h("div", { className: "actions" },
						h("button", { className: "dsh-bishu-btn dsh-bishu-btn-primary", disabled: approving, onClick: () => approveNode(true) }, approving ? "提交中…" : "✓ 通过"),
						h("button", { className: "dsh-bishu-btn dsh-bishu-btn-ghost", disabled: approving, onClick: () => approveNode(false) }, "✗ 拒绝并反馈"),
					),
				) : null,
				steps.length > 0 ? h("div", { className: "dsh-bishu-progress" },
					h("div", { className: "dsh-bishu-progress-inner", style: { width: (done / steps.length) * 100 + "%" } }),
				) : null,
				steps.length > 0 ? h("div", { className: "dsh-bishu-steps" },
					steps.map((s) => h("div", { key: s.id, className: "dsh-bishu-step" },
						h("div", { className: "dsh-bishu-step-head" },
							h(StatusDot, { status: s.status }),
							h("span", { className: "dsh-bishu-step-name" }, s.label),
							s.error ? h("span", { className: "dsh-bishu-tag err" }, "失败") : null,
							s.output ? h("button", { className: "dsh-bishu-step-link", onClick: () => openArtifact(s.output) }, "查看") : null,
						),
						s.error ? h("div", { className: "dsh-bishu-step-error" }, s.error) : null,
					)),
				) : null,
				run.status === "completed" && run.produced_files && run.produced_files.length > 0 ? h("div", { style: { marginTop: 12 } },
					h("div", { style: { fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--dsw-alias-label-secondary,#bbb)" } }, "产物文件"),
					run.produced_files.map((f) => h("div", { key: f, className: "dsh-bishu-file", onClick: () => openArtifact(f) },
						h("span", null, "\uD83D\uDCC4"), f,
					)),
				) : null,
				run._inlineArtifact ? h("div", { style: { marginTop: 12 } },
					h("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 } },
						h("span", { style: { fontSize: 12, fontWeight: 700, color: "var(--dsw-alias-label-secondary,#bbb)" } }, "预览: " + run._inlineArtifact.path),
						h("span", { className: "dsh-bishu-spacer" }),
						h("button", { className: "dsh-bishu-btn dsh-bishu-btn-ghost dsh-bishu-btn-small", onClick: () => setRun((prev) => { const n = { ...prev }; delete n._inlineArtifact; return n; }) }, "关闭预览"),
					),
					h(MdView, { text: run._inlineArtifact.content, fallback: "（空）" }),
				) : null,
			);
		}

		// ── App ──────────────────────────────────────────────────────
		function App({ controller }) {
			const [tab, setTab] = useState("book");
			const [errors, setErrors] = useState([]); // [{ id, text }]
			const [toast, setToast] = useState(null);
			const [toastSeq, setToastSeq] = useState(0);
			const [workspace, setWorkspace] = useState(() => loadWorkspace());
			const [initialSelId, setInitialSelId] = useState(null);
			const [activeRun, setActiveRun] = useState(null);
			// BookTab 写入当前 dirty 状态；切 tab 时由 App 读取并确认
			const bookDirtyCheckRef = useRef(() => false);

			const pushError = useCallback((id, text) => {
				setErrors((prev) => {
					const filtered = prev.filter((e) => e.id !== id);
					filtered.push({ id, text });
					return filtered;
				});
			}, []);
			const dismissError = useCallback((id) => {
				setErrors((prev) => prev.filter((e) => e.id !== id));
			}, []);

			const showToast = useCallback((t) => {
				setToast({ ...t, _seq: Date.now() });
				setToastSeq((n) => n + 1);
			}, []);
			useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast && toast._seq]);

			// 受保护的 tab 切换：从 book 离开前如有未保存修改，先弹窗确认
			const requestSetTab = useCallback((next) => {
				if (tab === "book" && next !== "book" && bookDirtyCheckRef.current()) {
					if (!window.confirm("书籍 tab 有未保存修改，确定丢弃并切换？")) return;
				}
				setTab(next);
			}, [tab]);
			const gotoWorkflow = (wfId) => {
				if (tab === "book" && bookDirtyCheckRef.current()) {
					if (!window.confirm("书籍 tab 有未保存修改，确定丢弃并前往工作流？")) return;
				}
				setInitialSelId(wfId);
				setTab("wf");
			};
			const gotoRun = (runInfo) => {
				setActiveRun(runInfo);
				setTab("run");
			};

			return h("div", { className: "dsh-bishu-drawer" + (controller.getSnapshot().panelOpen ? "" : " dsh-bishu-hidden") },
				h("div", { className: "dsh-bishu-header" },
					h("span", { style: { color: "var(--dsw-alias-brand-primary,#2563eb)", display: "inline-flex" } },
						h("svg", { viewBox: "0 0 16 16", width: "18", height: "18", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" },
							h("path", { d: "M3 2.5h6l4 4v7H3z" }), h("path", { d: "M9 2.5v4h4" }), h("path", { d: "M5.5 8.5h5M5.5 11h3" }))),
					h("div", { className: "dsh-bishu-title" },
						h("h1", null, "Bishu Novel"),
						h("p", null, "本地小说生产工作流"),
					),
					h("span", { className: "dsh-bishu-spacer" }),
					h("button", { className: "dsh-bishu-iconbtn", onClick: () => controller.close(), title: "关闭" }, "\u2715"),
				),
				h("div", { className: "dsh-bishu-tabs" },
					h("button", { className: "dsh-bishu-tab" + (tab === "book" ? " active" : ""), onClick: () => requestSetTab("book") }, "书籍"),
					h("button", { className: "dsh-bishu-tab" + (tab === "wf" ? " active" : ""), onClick: () => requestSetTab("wf") }, "工作流"),
					h("button", { className: "dsh-bishu-tab" + (tab === "run" ? " active" : ""), onClick: () => requestSetTab("run") }, "运行"),
				),
				h("div", { className: "dsh-bishu-body" },
					h(ErrorBar, { errors, setErrors }),
					tab === "book" ? h(BookTab, { workspace, setWorkspace, pushError, dismissError, toast: showToast, gotoWorkflow, dirtyCheckRef: bookDirtyCheckRef }) :
					tab === "wf" ? h(WorkflowsTab, { workspace, setWorkspace, pushError, dismissError, toast: showToast, gotoRun, initialSelId, clearInitialSel: () => setInitialSelId(null) }) :
					h(RunsTab, { workspace, pushError, dismissError, toast: showToast, activeRun, setActiveRun }),
				),
				toast ? h("div", { className: "dsh-bishu-toast " + toast.kind },
					h("span", null, toast.text),
					h("button", { className: "x", title: "关闭", onClick: () => setToast(null) }, "\u2715"),
				) : null,
			);
		}

		// ── DOM mounts ───────────────────────────────────────────────
		function sidebarRoot() {
			const column = document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]");
			if (column === null) return undefined;
			return column.querySelector("[class*=\"logoRow\"]")?.parentElement ?? column.firstElementChild;
		}
		function createEntry(controller) {
			const entry = document.createElement("button");
			entry.type = "button";
			entry.dataset.dshBishuEntry = "";
			entry.className = "dsh-bishu-entry";
			entry.setAttribute("aria-label", "Bishu Novel");
			entry.setAttribute("title", "Bishu Novel 写作工作流");
			entry.innerHTML = "<span class=\"dsh-bishu-entry-icon\"><svg viewBox=\"0 0 16 16\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 2.5h6l4 4v7H3z\"/><path d=\"M9 2.5v4h4\"/><path d=\"M5.5 8.5h5M5.5 11h3\"/></svg></span><span class=\"dsh-bishu-entry-label\">Bishu Novel</span>";
			entry.addEventListener("click", () => controller.toggle());
			return entry;
		}
		function placeEntry(root, entry) {
			const button = root.querySelector("button[class*=\"newSession\"]");
			const base = button || Array.from(root.children).find((el) => el.tagName === "BUTTON");
			if (!base || base.parentElement !== root) return false;
			if (entry.parentElement !== root) {
				const family = Array.from(root.children).filter((el) => el instanceof HTMLElement && el.matches("[data-dsh-taskboard-entry], [data-dsh-ssh-entry], [data-dsh-bishu-entry]"));
				const anchor = family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling;
				root.insertBefore(entry, anchor);
			}
			return true;
		}
		function mountSidebarEntry(controller) {
			const entry = createEntry(controller);
			let root;
			let placed = false;
			let rootObserver;
			const tryPlace = () => {
				if (root !== undefined && !root.isConnected) { if (rootObserver) rootObserver.disconnect(); root = undefined; placed = false; }
				if (placed) {
					if (document.body.contains(entry)) return;
					if (rootObserver) rootObserver.disconnect();
					root = undefined;
					placed = false;
				}
				root = root || sidebarRoot();
				if (root === undefined) return;
				placed = placeEntry(root, entry);
				if (placed) {
					rootObserver = new MutationObserver(() => {
						if (root === undefined || !root.isConnected) { placed = false; tryPlace(); return; }
						if (!root.contains(entry)) placed = placeEntry(root, entry);
					});
					rootObserver.observe(root, { childList: true, subtree: true });
				}
			};
			const waitObserver = new MutationObserver(() => tryPlace());
			waitObserver.observe(document.body, { childList: true, subtree: true });
			const syncActive = () => {
				if (controller.getSnapshot().panelOpen) entry.dataset.active = "true";
				else delete entry.dataset.active;
			};
			const unsub = controller.subscribe(syncActive);
			syncActive();
			tryPlace();
			return () => {
				waitObserver.disconnect();
				if (rootObserver) rootObserver.disconnect();
				unsub();
				entry.remove();
			};
		}
		function mountDrawer(controller) {
			const style = document.createElement("style");
			style.id = "dsh-bishu-styles";
			style.textContent = CSS;
			document.head.appendChild(style);
			const host = document.createElement("div");
			document.body.appendChild(host);
			const root = createRoot(host);
			const render = () => {
				root.render(React.createElement(App, { controller }));
			};
			const unsub = controller.subscribe(render);
			render();
			return () => {
				unsub();
				root.unmount();
				host.remove();
				style.remove();
			};
		}

		// ── client plugin ────────────────────────────────────────────
		const inject = [];
		function apply(ctx) {
			const controller = makeController();
			const disposers = [];
			try {
				disposers.push(mountSidebarEntry(controller));
				disposers.push(mountDrawer(controller));
			} catch (error) {
				console.warn("[dsh-bishu-novel] mount failed:", error);
			}
			ctx.effect(() => () => {
				for (const dispose of disposers.splice(0)) dispose();
			}, "dsh-bishu-novel: ui mounts");
		}

		const exports = { inject, apply };
		return exports;
	},
});