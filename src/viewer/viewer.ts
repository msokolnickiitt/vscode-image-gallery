import * as vscode from 'vscode';
import * as utils from '../utils';
import { reporter } from '../telemetry';

export let disposable: vscode.Disposable;

export function activate(context: vscode.ExtensionContext) {
	reporter.sendTelemetryEvent('viewer.activate');

	const viewer = new ViewerWebview(context);
	disposable = vscode.window.registerCustomEditorProvider(
		ViewerWebview.viewType,
		viewer,
		{
			supportsMultipleEditorsPerDocument: true,
			webviewOptions: {
				retainContextWhenHidden: true,
			}
		},
	);
	context.subscriptions.push(disposable);
}

export function deactivate() {
	if (!disposable) { return; }
	disposable.dispose();
	reporter.sendTelemetryEvent('viewer.deactivate');
}

export class ViewerWebview implements vscode.CustomReadonlyEditorProvider {
	public static readonly viewType = 'gryc.viewer';

	constructor(private readonly context: vscode.ExtensionContext) { }

	public async openCustomDocument(uri: vscode.Uri) {
		return { uri, dispose: () => { } };
	}

	public async resolveCustomEditor(
		document: vscode.CustomDocument,
		webviewPanel: vscode.WebviewPanel,
	): Promise<void> {
		let documentPath = webviewPanel.webview.asWebviewUri(document.uri).toString();
		const fileExtension = document.uri.path.split('.').pop()?.toLowerCase() || '';
		const mediaType = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v', 'flv', 'wmv'].includes(fileExtension) ? 'video' : 'image';

		webviewPanel.webview.options = {
			enableScripts: true,
			enableForms: false
		};
		webviewPanel.webview.html = getWebviewContent(this.context, webviewPanel.webview, documentPath, mediaType);
	}
}

export function getWebviewContent(
	context: vscode.ExtensionContext,
	webview: vscode.Webview,
	mediaSrc: string,
	mediaType: 'image' | 'video' = 'image',
) {
	const styleHref = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "src", 'viewer', 'style.css'));
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "src", 'viewer', 'script.js'));

	const mediaElement = mediaType === 'video' ? `
		<video id="media" src="${mediaSrc}" controls autoplay loop></video>
	` : `
		<img id="image" src="${mediaSrc}">
	`;

	return (
		`<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<meta http-equiv="Content-Security-Policy" content="img-src ${webview.cspSource} https:; media-src ${webview.cspSource}; script-src 'nonce-${utils.nonce}'; style-src ${webview.cspSource};">
			<link href="${styleHref}" rel="stylesheet" />
			<script nonce="${utils.nonce}" src='https://unpkg.com/panzoom@9.4.0/dist/panzoom.min.js'></script>

			<title>Image & Video Gallery: Viewer</title>
			</head>
		<body>
			<div id="container">
				${mediaElement}
			</div>

			<script nonce="${utils.nonce}" src="${scriptUri}"></script>
		</body>
		</html>`
	);
}