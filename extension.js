const vscode = require('vscode');
const calculator = require('filesize-calculator');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip);
const brotli = promisify(zlib.brotliCompress);
const MAX_COMPRESSION_BYTES = 16 * 1024 * 1024;

let statusBarItem, config, currentInfo, requestId = 0;

function dateText(value) {
  if (!value || !Number.isFinite(value)) return 'Unavailable';
  return new Date(value).toLocaleString(undefined, { hour12: !config.use24HourFormat });
}

function rows(info) {
  const result = [
    ['File', info.name],
    ['Size', info.prettySize],
    ['Created', dateText(info.ctime)],
    ['Modified', dateText(info.mtime)],
    ['Path', info.uri.fsPath || info.uri.toString()]
  ];
  if (config.showRawInBytes) result.splice(2, 0, ['Size in bytes', String(info.size)]);
  if (info.mimeType) result.splice(2, 0, ['Type', info.mimeType]);
  if (info.gzipSize) result.splice(2, 0, ['Gzipped', info.gzipSize]);
  if (info.brotliSize) result.splice(2, 0, ['Brotli', info.brotliSize]);
  return result;
}

async function addCompression(info, useGzip, useBrotli) {
  if ((!useGzip && !useBrotli) || info.size > MAX_COMPRESSION_BYTES) return;
  try {
    const bytes = await vscode.workspace.fs.readFile(info.uri);
    if (useGzip) info.gzipSize = calculator.addPrettySize({ size: (await gzip(bytes)).length }, config).prettySize;
    if (useBrotli) info.brotliSize = calculator.addPrettySize({ size: (await brotli(bytes)).length }, config).prettySize;
  } catch (_) { /* File metadata remains available if reading or compression fails. */ }
}

function updateTooltip(info) {
  const tooltip = new vscode.MarkdownString();
  tooltip.appendMarkdown('**File Info**\n\n');
  for (const [label, value] of rows(info)) {
    tooltip.appendMarkdown(`**${label}**  \n`);
    tooltip.appendText(value);
    tooltip.appendMarkdown('\n\n');
  }
  statusBarItem.tooltip = tooltip;
}

function activeUri() {
  const tabs = vscode.window.tabGroups;
  const input = tabs && tabs.activeTabGroup.activeTab && tabs.activeTabGroup.activeTab.input;
  // Text, custom, notebook, and diff inputs expose their source URI.
  if (input) return input.uri || input.modified;
  const editor = vscode.window.activeTextEditor;
  return editor && editor.document.uri;
}

async function loadInfo(uri) {
  if (!uri || uri.scheme === 'untitled' || uri.scheme === 'output') return undefined;
  const stat = await vscode.workspace.fs.stat(uri);
  if (!(stat.type & vscode.FileType.File)) return undefined;
  const name = path.posix.basename(uri.path);
  const info = calculator.addPrettySize({ uri, name, size: stat.size, ctime: stat.ctime, mtime: stat.mtime, absolutePath: uri.path }, config);
  try { calculator.addMimeTypeInfo(info); } catch (_) { /* MIME type is optional. */ }
  return info;
}

async function updateStatusBarItem() {
  const id = ++requestId;
  const uri = activeUri();
  try {
    const info = await loadInfo(uri);
    if (info) await addCompression(info, config.showGzipInStatusBar, config.showBrotliInStatusBar);
    if (id !== requestId) return;
    currentInfo = info;
    if (!info) { statusBarItem.hide(); return; }
    statusBarItem.text = info.prettySize;
    if (info.gzipSize) statusBarItem.text += ` | Gz: ${info.gzipSize}`;
    if (info.brotliSize) statusBarItem.text += ` | Br: ${info.brotliSize}`;
    if (config.showCreatedInStatusBar && info.ctime > 0) statusBarItem.text += ` | Created: ${new Date(info.ctime).toLocaleDateString()}`;
    updateTooltip(info);
    statusBarItem.show();
  } catch (_) {
    if (id === requestId) { currentInfo = undefined; statusBarItem.hide(); }
  }
}

function updateConfig() {
  const settings = vscode.workspace.getConfiguration('fileinfo');
  config = {
    useDecimal: settings.get('useDecimal'),
    use24HourFormat: settings.get('use24HourFormat'),
    showRawInBytes: settings.get('showRawInBytes'),
    showGzip: settings.get('showGzip'),
    showBrotli: settings.get('showBrotli'),
    showGzipInStatusBar: settings.get('showGzipInStatusBar'),
    showBrotliInStatusBar: settings.get('showBrotliInStatusBar'),
    showCreatedInStatusBar: settings.get('showCreatedInStatusBar'),
    right: settings.get('displayInfoOnTheRightSideOfStatusBar')
  };
  if (statusBarItem) statusBarItem.dispose();
  statusBarItem = vscode.window.createStatusBarItem(config.right ? vscode.StatusBarAlignment.Right : vscode.StatusBarAlignment.Left, 1);
  statusBarItem.name = 'File Info';
  statusBarItem.command = 'workbench.action.showHover';
  updateStatusBarItem();
}

async function showDetails(uri) {
  let info;
  try { info = uri ? await loadInfo(uri) : currentInfo; } catch (_) { info = undefined; }
  if (!info) { vscode.window.showInformationMessage('File Info: No file information available.'); return; }
  info = { ...info };
  await addCompression(info, config.showGzip, config.showBrotli);
  const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const panel = vscode.window.createWebviewPanel('fileinfo.details', 'File Info', vscode.ViewColumn.Active, { enableScripts: false });
  panel.webview.html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{color:var(--vscode-foreground);font-family:var(--vscode-font-family);padding:24px}main{max-width:600px;margin:auto;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-editorWidget-border);border-radius:8px;padding:20px}h1{font-size:1.2em;margin:0 0 18px}dl{margin:0}div{border-top:1px solid var(--vscode-panel-border);padding:10px 0}dt{font-weight:600;margin-bottom:4px}dd{margin:0;overflow-wrap:anywhere;user-select:text}</style></head><body><main><h1>File Info</h1><dl>${rows(info).map(([label,value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></main></body></html>`;
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('fileinfo.showDetails', showDetails),
    vscode.workspace.onDidSaveTextDocument(updateStatusBarItem),
    vscode.workspace.onDidChangeConfiguration(updateConfig),
    vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem),
    vscode.window.tabGroups.onDidChangeTabs(updateStatusBarItem),
    vscode.window.tabGroups.onDidChangeTabGroups(updateStatusBarItem)
  );
  updateConfig();
}
function deactivate() { ++requestId; if (statusBarItem) statusBarItem.dispose(); }
module.exports = { activate, deactivate };
