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
.dsh-bishu-tree{display:flex;flex-direction:column;gap:1px;max-height:260px;overflow:auto;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);border-radius:8px;padding:4px}
.dsh-bishu-tree-item{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;font-size:12px;cursor:pointer;color:var(--dsw-alias-label-primary,#eee)}
.dsh-bishu-tree-item:hover{background:var(--dsw-alias-bg-layer-2,#1e1e1e)}
.dsh-bishu-tree-item .ic{flex:none;color:var(--dsw-alias-label-secondary,#777)}
.dsh-bishu-tree-item .p{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);font-size:11px}
.dsh-bishu-editor-bar{display:flex;align-items:center;gap:6px;margin-bottom:6px}
.dsh-bishu-editor-bar .fp{flex:1;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-bishu-fileview{background:var(--dsw-alias-bg-layer-1,#161616);border:1px solid var(--dsw-alias-border-l1,#2a2a2a);border-radius:8px;padding:10px 12px;max-height:300px;overflow:auto;font-size:12px;line-height:1.5;white-space:pre-wrap;font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace)}
.dsh-bishu-editarea{width:100%;box-sizing:border-box;min-height:200px;padding:10px 12px;font-size:12px;line-height:1.5;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);background:var(--dsw-alias-bg-layer-2,#1c1c1c);color:var(--dsw-alias-label-primary,#eee);font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);resize:vertical}
.dsh-bishu-editarea:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#3b82f6)}
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
.dsh-bishu-toast{position:fixed;bottom:20px;right:580px;z-index:1300;max-width:380px;padding:9px 14px;border-radius:8px;font-size:12px;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;gap:8px}
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

/* product browser v2 — tree + search + chips + tri-mode fileview */
.dsh-bishu-search{position:relative;margin-bottom:8px}
.dsh-bishu-search input{width:100%;box-sizing:border-box;padding:7px 26px 7px 28px;font-size:12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);background:var(--dsw-alias-bg-layer-2,#1c1c1c);color:var(--dsw-alias-label-primary,#eee);transition:border-color .12s ease}
.dsh-bishu-search input::placeholder{color:var(--dsw-alias-label-secondary,#555)}
.dsh-bishu-search input:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#3b82f6)}
.dsh-bishu-search .si{position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--dsw-alias-label-secondary,#777);pointer-events:none;display:inline-flex}
.dsh-bishu-search .x{position:absolute;right:4px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--dsw-alias-label-secondary,#777);cursor:pointer;font-size:12px;padding:1px 5px;border-radius:4px;line-height:1}
.dsh-bishu-search .x:hover{color:var(--dsw-alias-label-primary,#eee);background:var(--dsw-alias-bg-layer-1,#161616)}
.dsh-bishu-commonchips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}
.dsh-bishu-commonchip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:11px;background:var(--dsw-alias-bg-layer-2,#1c1c1c);border:1px solid var(--dsw-alias-border-l1,#2a2a2a);color:var(--dsw-alias-label-primary,#eee);cursor:pointer;transition:background .12s ease,border-color .12s ease,color .12s ease}
.dsh-bishu-commonchip:hover{background:var(--dsw-alias-bg-layer-1,#161616);border-color:var(--dsw-alias-brand-primary,#3b82f6);color:var(--dsw-alias-brand-primary,#3b82f6)}
.dsh-bishu-commonchip .ic{flex:none;opacity:.85;display:inline-flex}
.dsh-bishu-commonchip .lbl{font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-bishu-tree{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);border-radius:8px;padding:4px;background:var(--dsw-alias-bg-layer-1,#161616);max-height:340px;overflow:auto}
.dsh-bishu-tree-row{display:flex;align-items:center;gap:5px;padding:4px 6px;border-radius:6px;font-size:12px;cursor:pointer;color:var(--dsw-alias-label-primary,#eee);user-select:none;line-height:1.3}
.dsh-bishu-tree-row:hover{background:var(--dsw-alias-bg-layer-2,#1e1e1e)}
.dsh-bishu-tree-row .ic{flex:none;color:var(--dsw-alias-label-secondary,#888);width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;font-size:11px}
.dsh-bishu-tree-row .p{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);font-size:11px}
.dsh-bishu-tree-row.dir{color:var(--dsw-alias-label-primary,#eee);font-weight:600}
.dsh-bishu-tree-row.dir .p{font-family:var(--dsw-font-family,system-ui);font-size:12px;font-weight:600}
.dsh-bishu-tree-row.dir.dim .p{font-weight:500;color:var(--dsw-alias-label-secondary,#bbb)}
.dsh-bishu-tree-row.file.active{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#3b82f6) 20%,transparent);color:#fff}
.dsh-bishu-tree-row.file.active .ic{color:#fff}
.dsh-bishu-tree-row.file.active .p{color:#fff}
.dsh-bishu-tree-children{margin-left:10px;border-left:1px dashed var(--dsw-alias-border-l1,#2a2a2a);padding-left:6px}
.dsh-bishu-tree-empty{font-size:11px;color:var(--dsw-alias-label-secondary,#888);padding:12px;text-align:center}
.dsh-bishu-fileview-shell{margin-top:12px;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#161616);overflow:hidden;display:flex;flex-direction:column;max-height:60vh}
.dsh-bishu-fileview-bar{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1,#2a2a2a);background:var(--dsw-alias-bg-layer-1,#161616)}
.dsh-bishu-fileview-bc{flex:1;min-width:120px;font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);font-size:11px;color:var(--dsw-alias-label-primary,#eee);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-bishu-fileview-bc .seg{color:var(--dsw-alias-label-secondary,#888)}
.dsh-bishu-fileview-bc .seg.last{color:var(--dsw-alias-label-primary,#eee);font-weight:700}
.dsh-bishu-fileview-info{font-size:10px;color:var(--dsw-alias-label-secondary,#999);font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);white-space:nowrap}
.dsh-bishu-fileview-info .num{color:var(--dsw-alias-label-primary,#eee);font-weight:700}
.dsh-bishu-viewtoggle{display:inline-flex;border:1px solid var(--dsw-alias-border-l1,#2a2a2a);border-radius:6px;overflow:hidden;flex:none}
.dsh-bishu-viewtoggle button{padding:4px 9px;font-size:11px;font-weight:600;background:none;border:none;color:var(--dsw-alias-label-secondary,#999);cursor:pointer;transition:background .12s ease,color .12s ease}
.dsh-bishu-viewtoggle button + button{border-left:1px solid var(--dsw-alias-border-l1,#2a2a2a)}
.dsh-bishu-viewtoggle button:hover{background:var(--dsw-alias-bg-layer-2,#1e1e1e);color:var(--dsw-alias-label-primary,#eee)}
.dsh-bishu-viewtoggle button.active{background:var(--dsw-alias-brand-primary,#2563eb);color:#fff}
.dsh-bishu-fileview-body{flex:1;overflow:auto;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-primary,#eee)}
.dsh-bishu-fileview-body.md{padding:10px 14px;background:transparent}
.dsh-bishu-fileview-body.src{padding:10px 14px;white-space:pre-wrap;word-break:break-word;font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);background:transparent;font-size:11.5px}
.dsh-bishu-fileview-body.edit{padding:0;background:transparent;display:flex}
.dsh-bishu-fileview-body.edit textarea{width:100%;min-height:100%;flex:1;box-sizing:border-box;padding:10px 14px;font-size:12px;line-height:1.55;border:none;border-radius:0;background:transparent;color:var(--dsw-alias-label-primary,#eee);font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);resize:none;outline:none}
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
		function renderMarkdown(text) {
			try {
				const lines = String(text || "").split(/\r?\n/);
				const out = [];
				let inCode = false;
				let codeBuf = [];
				let listBuf = [];
				let listKind = null;
				let paraBuf = [];
				const flushPara = () => {
					if (paraBuf.length) { out.push("<p>" + inlineMd(paraBuf.join(" ")) + "</p>"); paraBuf = []; }
				};
				const flushList = () => {
					if (listBuf.length) {
						const tag = listKind === "ol" ? "ol" : "ul";
						out.push("<" + tag + ">" + listBuf.map((it) => "<li>" + inlineMd(it) + "</li>").join("") + "</" + tag + ">");
						listBuf = []; listKind = null;
					}
				};
				for (let i = 0; i < lines.length; i++) {
					const ln = lines[i];
					if (inCode) {
						if (/^```/.test(ln)) {
							out.push("<pre><code>" + escapeHtml(codeBuf.join("\n")) + "</code></pre>");
							codeBuf = []; inCode = false;
						} else codeBuf.push(ln);
						continue;
					}
					if (/^```/.test(ln)) { flushPara(); flushList(); inCode = true; continue; }
					if (/^\s*$/.test(ln)) { flushPara(); flushList(); continue; }
					const h6 = ln.match(/^(#{1,6})\s+(.*)$/);
					if (h6) { flushPara(); flushList(); out.push("<h" + h6[1].length + ">" + inlineMd(h6[2]) + "</h" + h6[1].length + ">"); continue; }
					const lm = ln.match(/^[\-\*]\s+(.*)$/);
					if (lm) { flushPara(); if (listKind && listKind !== "ul") flushList(); listKind = "ul"; listBuf.push(lm[1]); continue; }
					const lo = ln.match(/^\d+\.\s+(.*)$/);
					if (lo) { flushPara(); if (listKind && listKind !== "ol") flushList(); listKind = "ol"; listBuf.push(lo[1]); continue; }
					const q = ln.match(/^>\s*(.*)$/);
					if (q) { flushPara(); flushList(); out.push("<blockquote>" + inlineMd(q[1]) + "</blockquote>"); continue; }
					paraBuf.push(ln);
				}
				if (inCode) out.push("<pre><code>" + escapeHtml(codeBuf.join("\n")) + "</code></pre>");
				flushPara(); flushList();
				return out.join("\n");
			} catch (e) {
				return "<pre>" + escapeHtml(text) + "</pre>";
			}
		}
		function MdView({ text, fallback, className }) {
			const cls = "dsh-bishu-md" + (className ? " " + className : "");
			if (text == null || text === "") return h("div", { className: "dsh-bishu-empty" }, fallback || "（空）");
			return h("div", { className: cls, dangerouslySetInnerHTML: { __html: renderMarkdown(text) } });
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
			if (ext === "md") return "preview";
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

		// ── artifact tree ───────────────────────────────────────────
		// 把 /tree 返回的扁平相对路径数组组装成可折叠树
		const AUTO_EXPAND_DIRS = new Set(["meta", "outline", "story"]);
		function buildTree(files) {
			// root 节点，children 是顶层目录或文件
			const root = { name: "", path: "", kind: "dir", children: [] };
			if (!Array.isArray(files) || files.length === 0) return root;
			for (const raw of files) {
				const fp = String(raw).replace(/\\/g, "/");
				const segs = fp.split("/").filter(Boolean);
				if (segs.length === 0) continue;
				let cur = root;
				for (let i = 0; i < segs.length; i++) {
					const seg = segs[i];
					const isFile = i === segs.length - 1;
					if (!Array.isArray(cur.children)) cur.children = [];
					let child = cur.children.find((c) => c.name === seg && c.kind === (isFile ? "file" : "dir"));
					if (!child) {
						child = {
							name: seg,
							path: segs.slice(0, i + 1).join("/"),
							kind: isFile ? "file" : "dir",
							children: isFile ? null : [],
						};
						cur.children.push(child);
					}
					cur = child;
				}
			}
			// 排序：目录在前，文件在后；按名字 / 数字稳定排序
			const sortNodes = (nodes) => {
				if (!nodes) return;
				nodes.sort((a, b) => {
					if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
					const an = a.name, bn = b.name;
					// 数字段按数字排序（如 0001 / 0002）
					if (/^\d+$/.test(an) && /^\d+$/.test(bn)) {
						return parseInt(an, 10) - parseInt(bn, 10);
					}
					return an.localeCompare(bn);
				});
				for (const c of nodes) if (c.kind === "dir") sortNodes(c.children);
			};
			sortNodes(root.children);
			return root;
		}
		function shouldAutoExpandDir(node) {
			if (!node || !node.name) return false;
			return AUTO_EXPAND_DIRS.has(node.name);
		}
		function findLatestChapter(files) {
			if (!Array.isArray(files)) return null;
			const re = /^story\/(\d{4})\/chapter\.md$/i;
			const nums = [];
			for (const f of files) {
				const m = String(f).match(re);
				if (m) nums.push(parseInt(m[1], 10));
			}
			if (nums.length === 0) return null;
			nums.sort((a, b) => a - b);
			const n = nums[nums.length - 1];
			return "story/" + String(n).padStart(4, "0") + "/chapter.md";
		}
		// 收集 STAGES 关键文件中确实存在的，作为「常用」
		function collectCommonChips(files, fileMaps) {
			if (!Array.isArray(files)) return [];
			const set = new Set(files);
			const out = [];
			// STAGES 中关键（每个 stage 取第一个文件作为代表）
			for (const s of STAGES) {
				const rep = s.files.find((p) => set.has(p) && (fileMaps ? fileMaps[p] : true));
				if (rep && !out.find((x) => x.path === rep)) out.push({ path: rep, label: basename(rep) });
			}
			// 加上最新章节
			const last = findLatestChapter(files);
			if (last && !out.find((x) => x.path === last)) out.push({ path: last, label: basename(last) + "（最新）" });
			return out;
		}

		// ── lastFile 记忆 ───────────────────────────────────────────
		function lastFileKey(ws) { return "dsh.bishu.lastFile." + String(ws || ""); }
		function loadLastFile(ws) { try { return localStorage.getItem(lastFileKey(ws)) || null; } catch (e) { return null; } }
		function saveLastFile(ws, path) { try { localStorage.setItem(lastFileKey(ws), String(path || "")); } catch (e) { /* ignore */ } }
		function clearLastFile(ws) { try { localStorage.removeItem(lastFileKey(ws)); } catch (e) { /* ignore */ } }

		// ── ArtifactTree 独立组件 ─────────────────────────────────
		// 递归渲染树；展开/收起由父组件通过 expanded 状态管理
		function ArtifactTree({ node, depth, currentPath, expanded, onToggle, onOpen, filter, matched }) {
			if (!node) return null;
			if (node.kind === "file") {
				const active = currentPath === node.path;
				const dim = filter && !matched.has(node.path);
				return h("div", {
					key: node.path,
					className: "dsh-bishu-tree-row file" + (active ? " active" : ""),
					style: dim ? { opacity: 0.35 } : undefined,
					onClick: () => onOpen(node.path),
					title: node.path,
				},
					h("span", { className: "ic" }, fileIconText(node.name)),
					h("span", { className: "p" }, node.name),
				);
			}
			if (node.kind === "dir") {
				const open = expanded.has(node.path);
				const kids = node.children || [];
				// 过滤态：子节点全部不匹配则隐藏
				const visibleKids = filter
					? kids.filter((c) => {
						if (c.kind === "file") return matched.has(c.path);
						// 目录：递归判断是否有任一后代匹配
						const stack = [c];
						while (stack.length) {
							const n = stack.pop();
							if (n.kind === "file" && matched.has(n.path)) return true;
							if (n.kind === "dir" && Array.isArray(n.children)) for (const cc of n.children) stack.push(cc);
						}
						return false;
					})
					: kids;
				if (filter && visibleKids.length === 0) return null;
				return h("div", { key: node.path || "_root_" },
					h("div", {
						className: "dsh-bishu-tree-row dir" + (depth > 0 ? "" : " dim"),
						style: { paddingLeft: 4 + depth * 0 },
						onClick: () => onToggle(node.path),
						title: node.path,
					},
						h("span", { className: "ic" }, makeChevron(open)),
						h("span", { className: "ic", style: { width: 14, display: "inline-flex", alignItems: "center", justifyContent: "center" } }, "\uD83D\uDCC1"),
						h("span", { className: "p" }, node.name || "/"),
					),
					open ? h("div", { className: "dsh-bishu-tree-children" },
						visibleKids.map((c) => h(ArtifactTree, {
							key: c.path, node: c, depth: depth + 1, currentPath, expanded, onToggle, onOpen, filter, matched,
						})),
					) : null,
				);
			}
			return null;
		}

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

		// ── BookTab (default) ───────────────────────────────────────
		function BookTab({ workspace, setWorkspace, pushError, dismissError, toast, gotoWorkflow, dirtyCheckRef }) {
			const { folderIcon, pickFolder, openFolder } = useHelpers({ toast, pushError });
			const providers = useProviders();
			const [recent, setRecent] = useState(null); // null = unknown / unavailable; [] = empty list
			const [bookStatus, setBookStatus] = useState(null);
			const [loadingStatus, setLoadingStatus] = useState(false);
			const [tree, setTree] = useState(null);
			const [loadingTree, setLoadingTree] = useState(false);
			const [fileView, setFileView] = useState(null); // { path, content, mode, editText, dirty }
			const [searchQuery, setSearchQuery] = useState("");
			const [expanded, setExpanded] = useState(new Set());
			// 自动展开标记：每个 workspace 只在「tree 首次就绪」时尝试一次自动恢复
			const autoOpenedFor = useRef(null);
			// 注册未保存检测给 App，用于切 tab 前的确认
			useEffect(() => {
				if (!dirtyCheckRef) return;
				dirtyCheckRef.current = () => !!(fileView && fileView.dirty);
				return () => { if (dirtyCheckRef) dirtyCheckRef.current = () => false; };
			}, [fileView, dirtyCheckRef]);

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
				setLoadingTree(true);
				get("/tree", { workspace })
					.then((b) => {
						setTree(b.files || []);
						dismissError("tree");
					})
					.catch((err) => pushError("tree", String((err && err.message) || err)))
					.finally(() => setLoadingTree(false));
			}, [workspace, pushError, dismissError]);

			useEffect(() => {
				setBookStatus(null);
				setTree(null);
				setFileView(null);
				setSearchQuery("");
				setExpanded(new Set());
				autoOpenedFor.current = null;
				if (workspace) { refreshStatus(); refreshTree(); }
			}, [workspace]); // eslint-disable-line react-hooks/exhaustive-deps

			const openFile = useCallback((rel) => {
				if (!workspace || !rel) return;
				get("/artifact", { workspace, path: rel })
					.then((b) => {
						const c = b && b.exists ? b.content : "";
						const mode = defaultViewMode(rel);
						setFileView({ path: rel, content: c, mode, editText: c, dirty: false });
						dismissError("artifact-read");
						if (workspace) saveLastFile(workspace, rel);
					})
					.catch((err) => pushError("artifact-read", String((err && err.message) || err)));
			}, [workspace, pushError, dismissError]);
			const saveFile = useCallback(() => {
				if (!fileView) return;
				const view = fileView;
				post("/write-artifact", { workspace, path: view.path, content: view.editText })
					.then((b) => {
						if (b && b.error) { toast({ kind: "error", text: b.error }); return; }
						setFileView({ path: view.path, content: view.editText, mode: view.mode, editText: view.editText, dirty: false });
						toast({ kind: "ok", text: "已保存: " + view.path });
						refreshStatus();
						refreshTree();
					})
					.catch((err) => toast({ kind: "error", text: String((err && err.message) || err) }));
			}, [fileView, workspace, toast, refreshStatus, refreshTree]);

			// 切换工作区/抽屉时，自动恢复最后打开的文件（仅对该 workspace 做一次）
			useEffect(() => {
				if (!workspace || !tree) return;
				if (autoOpenedFor.current === workspace) return;
				autoOpenedFor.current = workspace;
				const last = loadLastFile(workspace);
				if (last && tree.indexOf(last) >= 0 && !fileView) {
					openFile(last);
				} else if (last && tree.indexOf(last) < 0) {
					// 文件已不存在，清掉记忆
					clearLastFile(workspace);
				}
			}, [workspace, tree, openFile, fileView]);

			// 受保护的打开/关闭：dirty 时弹窗确认
			const requestOpen = useCallback((rel) => {
				if (fileView && fileView.dirty) {
					if (!window.confirm("「" + fileView.path + "」有未保存修改，确定丢弃并打开新文件？")) return;
				}
				openFile(rel);
			}, [fileView, openFile]);
			const requestClose = useCallback(() => {
				if (fileView && fileView.dirty) {
					if (!window.confirm("「" + fileView.path + "」有未保存修改，确定丢弃并关闭？")) return;
				}
				if (workspace) clearLastFile(workspace);
				setFileView(null);
			}, [fileView, workspace]);

			const onToggleDir = useCallback((dirPath) => {
				setExpanded((prev) => {
					const next = new Set(prev);
					if (next.has(dirPath)) next.delete(dirPath);
					else next.add(dirPath);
					return next;
				});
			}, []);

			const summary = bookStatus ? nextPendingStage(bookStatus.files) : null;
			const fileMaps = bookStatus ? (() => {
				const m = {};
				for (const f of (bookStatus.files || [])) m[f.path] = !!f.exists;
				return m;
			})() : {};

			// 树：按目录分组 + 默认展开 meta/outline/story 第一层
			const treeRoot = tree ? buildTree(tree) : null;
			// 在 tree 第一次就绪时，根据 AUTO_EXPAND_DIRS 设置默认展开
			useEffect(() => {
				if (!treeRoot || !tree) return;
				setExpanded((prev) => {
					if (prev.size > 0) return prev; // 用户已经手动展开/收起过
					const next = new Set();
					const walk = (node, isFirst) => {
						if (!node || node.kind !== "dir") return;
						if (isFirst && AUTO_EXPAND_DIRS.has(node.name)) next.add(node.path);
						// 子目录若是 story/ 下第一层（章节目录），默认收起，等用户按需展开
						if (Array.isArray(node.children)) for (const c of node.children) if (c.kind === "dir") walk(c, false);
					};
					for (const c of (treeRoot.children || [])) walk(c, true);
					return next;
				});
			}, [treeRoot, tree]);

			// 搜索过滤：路径子串（不区分大小写），并把匹配项祖先目录全展开
			const filter = (searchQuery || "").trim().toLowerCase();
			const matched = new Set();
			if (filter && Array.isArray(tree)) {
				for (const f of tree) {
					if (String(f).toLowerCase().indexOf(filter) >= 0) matched.add(f);
				}
			}
			// 搜索时把包含匹配项的所有目录加入展开集合（useEffect 形式避免 render 期 setState）
			useEffect(() => {
				if (!filter || matched.size === 0) return;
				setExpanded((prev) => {
					const next = new Set(prev);
					for (const m of matched) {
						const segs = m.split("/");
						for (let i = 1; i < segs.length; i++) {
							next.add(segs.slice(0, i).join("/"));
						}
					}
					return next;
				});
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, [searchQuery, tree]);
			// 渲染树时把「不匹配」的文件淡化
			const totalFiles = tree ? tree.length : 0;
			const matchedCount = filter ? matched.size : totalFiles;

			// 常用 chips：当前 workspace 中确实存在的关键文件
			const commonChips = (tree && bookStatus) ? collectCommonChips(tree, fileMaps) : [];

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

				h(SectionCard, { icon: h("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M3 2.5h10v11H3z" }), h("path", { d: "M5.5 6h5M5.5 8.5h5" })), title: "产物浏览", sub: "树形浏览 · 预览 / 源码 / 编辑" },
					!workspace ? h("div", { className: "dsh-bishu-empty" }, "请先填写书籍工作区") :
					h("div", null,
						h("div", { style: { display: "flex", gap: 6, marginBottom: 8, alignItems: "center" } },
							h("button", { className: "dsh-bishu-btn dsh-bishu-btn-ghost dsh-bishu-btn-small", onClick: refreshTree, disabled: loadingTree }, loadingTree ? "加载中…" : "刷新"),
							h("span", { className: "dsh-bishu-spacer" }),
							tree ? h("span", { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary,#888)" } },
								filter ? (matchedCount + " / " + totalFiles + " 匹配") : (totalFiles + " 个文件")
							) : null,
						),
						// 搜索框
						h("div", { className: "dsh-bishu-search" },
							h("span", { className: "si" },
								h("svg", { viewBox: "0 0 16 16", width: "13", height: "13", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" },
									h("circle", { cx: "7", cy: "7", r: "4.5" }),
									h("path", { d: "M10.5 10.5l3 3" })),
							),
							h("input", {
								type: "text",
								placeholder: "搜索文件 / 路径（不区分大小写）",
								value: searchQuery,
								onChange: (ev) => setSearchQuery(ev.target.value),
							}),
							searchQuery ? h("button", { className: "x", title: "清空", onClick: () => setSearchQuery("") }, "\u2715") : null,
						),
						// 常用 chips
						commonChips.length > 0 ? h("div", { className: "dsh-bishu-commonchips" },
							commonChips.map((c) => h("button", {
								key: c.path,
								className: "dsh-bishu-commonchip",
								title: c.path,
								onClick: () => requestOpen(c.path),
							},
								h("span", { className: "ic" }, fileIconText(c.path)),
								h("span", { className: "lbl" }, c.label),
							)),
						) : null,
						// 树
						tree && tree.length > 0 ? h("div", { className: "dsh-bishu-tree" },
							(treerootChildren(treeRoot)).map((c) => h(ArtifactTree, {
								key: c.path || "_", node: c, depth: 0, currentPath: fileView ? fileView.path : null,
								expanded, onToggle: onToggleDir, onOpen: requestOpen, filter, matched,
							})),
						) : (tree ? h("div", { className: "dsh-bishu-tree-empty" }, "工作区还没有文件") : null),
						// 文件视图：sticky 工具条 + 三态主体
						fileView ? renderFileView({
							view: fileView, setView: setFileView, onSave: saveFile, onClose: requestClose, workspace,
						}) : null,
					),
				),
			);
		}

		// BookTab 的小工具：根节点 children 列表
		function treerootChildren(root) {
			return (root && Array.isArray(root.children)) ? root.children : [];
		}

		// BookTab 的小工具：渲染三态文件视图
		function renderFileView({ view, setView, onSave, onClose, workspace }) {
			const isMd = getExt(view.path) === "md";
			const stats = countStats(view.content);
			const showCjk = isMd;
			const segs = view.path.split("/");
			const breadcrumb = segs.map((s, i) => h("span", { key: i, className: "seg" + (i === segs.length - 1 ? " last" : "") },
				s, i < segs.length - 1 ? h("span", { style: { color: "var(--dsw-alias-label-secondary,#555)", margin: "0 4px" } }, "/") : null
			));
			const setMode = (m) => setView({ ...view, mode: m });
			return h("div", { className: "dsh-bishu-fileview-shell" },
				h("div", { className: "dsh-bishu-fileview-bar" },
					h("span", { className: "dsh-bishu-fileview-bc", title: view.path }, breadcrumb),
					h("span", { className: "dsh-bishu-fileview-info" },
						showCjk
							? h("span", null, "中文 ", h("span", { className: "num" }, stats.cjk), " · 行 ", h("span", { className: "num" }, stats.lines))
							: h("span", null, "行 ", h("span", { className: "num" }, stats.lines), " · 字符 ", h("span", { className: "num" }, stats.chars))
					),
					view.dirty ? h("span", { className: "dsh-bishu-tag warn" }, "未保存") : null,
					h("div", { className: "dsh-bishu-viewtoggle" },
						h("button", { className: view.mode === "preview" ? "active" : "", onClick: () => setMode("preview"), title: "Markdown 预览" }, "预览"),
						h("button", { className: view.mode === "source" ? "active" : "", onClick: () => setMode("source"), title: "源码（只读）" }, "源码"),
						h("button", { className: view.mode === "edit" ? "active" : "", onClick: () => setMode("edit"), title: "编辑" }, "编辑"),
					),
					h("button", {
						className: "dsh-bishu-btn dsh-bishu-btn-primary dsh-bishu-btn-small",
						onClick: onSave, disabled: !view.dirty, title: "保存（Ctrl/Cmd+S）",
					}, "保存"),
					h("button", { className: "dsh-bishu-btn dsh-bishu-btn-ghost dsh-bishu-btn-small", onClick: onClose }, "关闭"),
				),
				view.mode === "preview"
					? h("div", { className: "dsh-bishu-fileview-body md" },
						isMd
							? h(MdView, { text: view.content, fallback: "（空文件）" })
							: h("pre", { className: "dsh-bishu-fileview-body src", style: { margin: 0, padding: 0 } }, view.content || "（空文件）"),
					)
					: view.mode === "source"
					? h("pre", { className: "dsh-bishu-fileview-body src" }, view.content || "（空文件）")
					: h("div", { className: "dsh-bishu-fileview-body edit" },
						h("textarea", {
							value: view.editText,
							spellCheck: false,
							placeholder: "在此编辑…（Ctrl/Cmd+S 保存）",
							onChange: (ev) => setView({ ...view, editText: ev.target.value, dirty: ev.target.value !== view.content }),
							onKeyDown: (ev) => {
								if ((ev.ctrlKey || ev.metaKey) && (ev.key === "s" || ev.key === "S")) {
									ev.preventDefault();
									if (view.dirty) onSave();
								}
							},
						}),
					),
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