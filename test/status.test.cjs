const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('file info handles custom editor files, hover, selection and stale responses', async () => {
  const callbacks = {};
  let item, displayed, resolveSlow;
  const uri = (name) => ({ scheme: 'file', path: '/' + name, fsPath: '/' + name, toString() { return this.path; } });
  const tabs = { activeTabGroup: { activeTab: { input: { uri: uri('sheet.xlsx') } } }, onDidChangeTabs(fn) { callbacks.tabs = fn; return {}; }, onDidChangeTabGroups() { return {}; } };
  const vscode = {
    FileType: { File: 1 }, StatusBarAlignment: { Left: 1, Right: 2 },
    MarkdownString: class { constructor() { this.value = ''; } appendMarkdown(v) { this.value += v; } appendText(v) { this.value += v; } },
    window: { tabGroups: tabs, createStatusBarItem() { return item = { show() { this.visible = true; }, hide() { this.visible = false; }, dispose() {} }; }, onDidChangeActiveTextEditor() { return {}; }, showInformationMessage(title, options) { displayed = { title, options }; } },
    workspace: { fs: { stat(u) { if (u.path === '/slow.pptx') return new Promise(resolve => { resolveSlow = resolve; }); return Promise.resolve({ type: 1, size: 1024, ctime: 1700000000000, mtime: 1700000000000 }); } }, getConfiguration() { return { get(key) { return key === 'showCreatedInStatusBar'; } }; }, onDidSaveTextDocument() { return {}; }, onDidChangeConfiguration() { return {}; } },
    commands: { registerCommand(name, fn) { callbacks.command = fn; return {}; } }
  };
  const original = Module._load;
  try {
    Module._load = function(request, ...args) { return request === 'vscode' ? vscode : original.call(this, request, ...args); };
    const extension = require('../extension'); extension.activate({ subscriptions: [] });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(item.visible, true); assert.match(item.tooltip.value, /sheet.xlsx/); assert.match(item.tooltip.value, /Created/);
    await callbacks.command(); assert.equal(displayed.title, 'File Info'); assert.equal(displayed.options.modal, true); assert.match(displayed.options.detail, /sheet.xlsx/);
    await callbacks.command(uri('presentation.pptx')); assert.match(displayed.options.detail, /presentation.pptx/);
    tabs.activeTabGroup.activeTab.input.uri = uri('slow.pptx'); const slow = callbacks.tabs();
    tabs.activeTabGroup.activeTab.input.uri = uri('notes.md'); await callbacks.tabs();
    resolveSlow({ type: 1, size: 10, ctime: 1, mtime: 1 }); await slow;
    assert.match(item.tooltip.value, /notes.md/); assert.doesNotMatch(item.tooltip.value, /slow.pptx/);
    extension.deactivate();
  } finally { Module._load = original; }
});
