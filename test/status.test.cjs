const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const manifest = require('../package.json');

test('File Lens handles custom editor files, hover, selection and stale responses', async () => {
  const callbacks = {}, requestedSettings = new Set();
  let item, displayed, resolveSlow;
  const uri = (name) => ({ scheme: 'file', path: '/' + name, fsPath: '/' + name, toString() { return this.path; } });
  const tabs = { activeTabGroup: { activeTab: { input: { uri: uri('sheet.xlsx') } } }, onDidChangeTabs(fn) { callbacks.tabs = fn; return {}; }, onDidChangeTabGroups() { return {}; } };
  const vscode = {
    ViewColumn: { Active: -1 }, FileType: { File: 1 }, StatusBarAlignment: { Left: 1, Right: 2 },
    MarkdownString: class { constructor() { this.value = ''; } appendMarkdown(v) { this.value += v; } appendText(v) { this.value += v; } },
    window: { tabGroups: tabs, createStatusBarItem() { return item = { show() { this.visible = true; }, hide() { this.visible = false; }, dispose() {} }; }, onDidChangeActiveTextEditor() { return {}; }, showInformationMessage() {}, createWebviewPanel(viewType) { assert.equal(viewType, 'fileLens.details'); displayed = { webview: {} }; return displayed; } },
    workspace: { fs: { stat(u) { if (u.path === '/slow.pptx') return new Promise(resolve => { resolveSlow = resolve; }); return Promise.resolve({ type: 1, size: 1024, ctime: 1700000000000, mtime: 1700000000000 }); } }, getConfiguration(namespace) { assert.equal(namespace, 'fileLens'); return { get(key) { requestedSettings.add(key); return key === 'showCreatedInStatusBar'; } }; }, onDidSaveTextDocument() { return {}; }, onDidChangeConfiguration() { return {}; } },
    commands: { registerCommand(name, fn) { assert.equal(name, 'fileLens.showDetails'); callbacks.command = fn; return {}; } }
  };
  const original = Module._load;
  try {
    Module._load = function(request, ...args) { return request === 'vscode' ? vscode : original.call(this, request, ...args); };
    const extension = require('../extension'); extension.activate({ subscriptions: [] });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual([...requestedSettings].sort(), Object.keys(manifest.contributes.configuration.properties).map(key => key.replace(/^fileLens\./, '')).sort());
    assert.equal(item.visible, true); assert.match(item.tooltip.value, /sheet.xlsx/); assert.match(item.tooltip.value, /Created/);
    await callbacks.command(); assert.match(displayed.webview.html, /sheet.xlsx/); assert.equal(item.command, 'workbench.action.showHover');
    await callbacks.command(uri('presentation.pptx')); assert.match(displayed.webview.html, /presentation.pptx/);
    tabs.activeTabGroup.activeTab.input.uri = uri('slow.pptx'); const slow = callbacks.tabs();
    tabs.activeTabGroup.activeTab.input.uri = uri('notes.md'); await callbacks.tabs();
    resolveSlow({ type: 1, size: 10, ctime: 1, mtime: 1 }); await slow;
    assert.match(item.tooltip.value, /notes.md/); assert.doesNotMatch(item.tooltip.value, /slow.pptx/);
    extension.deactivate();
  } finally { Module._load = original; }
});

test('manifest exposes only File Lens settings and command IDs', () => {
  const configuration = manifest.contributes.configuration;
  assert.equal(configuration.title, 'File Lens');
  assert.equal(Object.keys(configuration.properties).length, 9);
  for (const key of Object.keys(configuration.properties)) assert.match(key, /^fileLens\./);
  assert.deepEqual(manifest.contributes.commands.map(command => command.command), ['fileLens.showDetails']);
  assert.deepEqual(manifest.contributes.menus['explorer/context'].map(command => command.command), ['fileLens.showDetails']);
});
