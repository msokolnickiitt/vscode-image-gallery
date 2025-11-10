import * as vscode from 'vscode';
import * as utils from '../utils';
import { reporter } from '../telemetry';

export let disposable: vscode.Disposable;

export function activate(context: vscode.ExtensionContext) {
	reporter.sendTelemetryEvent('editor.activate');

	const editor = new ImageEditorProvider(context);
	disposable = vscode.window.registerCustomEditorProvider(
		ImageEditorProvider.viewType,
		editor,
		{
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
	reporter.sendTelemetryEvent('editor.deactivate');
}

class ImageEditorProvider implements vscode.CustomEditorProvider<ImageDocument> {
	public static readonly viewType = 'gryc.editor';

	private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<ImageDocument>>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

	constructor(private readonly context: vscode.ExtensionContext) { }

	public async openCustomDocument(
		uri: vscode.Uri,
		openContext: vscode.CustomDocumentOpenContext,
		token: vscode.CancellationToken
	): Promise<ImageDocument> {
		return new ImageDocument(uri);
	}

	public async resolveCustomEditor(
		document: ImageDocument,
		webviewPanel: vscode.WebviewPanel,
		token: vscode.CancellationToken
	): Promise<void> {
		// Allow webview to access:
		// - Extension's node_modules (for Pintura)
		// - Extension's src folder
		// - User's workspace (for images they're editing)
		const workspaceFolders = vscode.workspace.workspaceFolders || [];
		const localResourceRoots = [
			vscode.Uri.joinPath(this.context.extensionUri, 'node_modules'),
			vscode.Uri.joinPath(this.context.extensionUri, 'src'),
			...workspaceFolders.map(folder => folder.uri)
		];

		webviewPanel.webview.options = {
			enableScripts: true,
			localResourceRoots: localResourceRoots
		};

		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document.uri);

		// Handle messages from webview
		webviewPanel.webview.onDidReceiveMessage(
			async message => {
				const telemetryPrefix = "editor.messageListener";
				switch (message.command) {
					case 'POST.editor.saveImage':
						await this.saveEditedImage(document.uri, message.imageData, message.mimeType);
						this._onDidChangeCustomDocument.fire({
							document: document,
							undo: async () => { },
							redo: async () => { }
						});
						reporter.sendTelemetryEvent(`${telemetryPrefix}.saveImage`, {
							'mimeType': message.mimeType
						});
						break;

					case 'POST.editor.imageModified':
						document.isDirty = message.isDirty;
						reporter.sendTelemetryEvent(`${telemetryPrefix}.imageModified`, {
							'isDirty': message.isDirty.toString()
						});
						break;

					case 'POST.editor.error':
						vscode.window.showErrorMessage(`Editor Error: ${message.message}`);
						reporter.sendTelemetryEvent(`${telemetryPrefix}.error`, {
							'message': message.message
						});
						break;
				}
			},
			undefined,
			this.context.subscriptions
		);

		reporter.sendTelemetryEvent('editor.resolveCustomEditor');
	}

	public async saveCustomDocument(
		document: ImageDocument,
		cancellation: vscode.CancellationToken
	): Promise<void> {
		// Save is handled through message passing from webview
		reporter.sendTelemetryEvent('editor.saveCustomDocument');
	}

	public async saveCustomDocumentAs(
		document: ImageDocument,
		destination: vscode.Uri,
		cancellation: vscode.CancellationToken
	): Promise<void> {
		vscode.window.showInformationMessage('Save As not yet implemented');
		reporter.sendTelemetryEvent('editor.saveCustomDocumentAs');
	}

	public async revertCustomDocument(
		document: ImageDocument,
		cancellation: vscode.CancellationToken
	): Promise<void> {
		vscode.window.showInformationMessage('Revert not yet implemented');
		reporter.sendTelemetryEvent('editor.revertCustomDocument');
	}

	public async backupCustomDocument(
		document: ImageDocument,
		context: vscode.CustomDocumentBackupContext,
		cancellation: vscode.CancellationToken
	): Promise<vscode.CustomDocumentBackup> {
		reporter.sendTelemetryEvent('editor.backupCustomDocument');
		return {
			id: context.destination.toString(),
			delete: async () => { }
		};
	}

	private getHtmlForWebview(webview: vscode.Webview, imageUri: vscode.Uri): string {
		const nonce = utils.nonce;

		// Determine the base URI for Pintura assets
		let baseUri: vscode.Uri;

		if (this.context.extensionMode === vscode.ExtensionMode.Development) {
			// Development mode: Find workspace that contains this extension's source
			// Look for workspace folder containing package.json with our extension name
			const devWorkspace = vscode.workspace.workspaceFolders?.find(folder => {
				try {
					const packageJsonPath = vscode.Uri.joinPath(folder.uri, 'package.json');
					// We can't read files here, but we can check if the workspace name matches
					// Our development workspace is "vscode-image-gallery"
					return folder.name === 'vscode-image-gallery' ||
					       folder.uri.path.includes('vscode-image-gallery');
				} catch {
					return false;
				}
			});

			baseUri = devWorkspace?.uri || this.context.extensionUri;
			console.log('🔧 Development mode detected');
			console.log('  Dev workspace:', devWorkspace?.uri.toString());
		} else {
			// Production mode: Use installed extension directory
			baseUri = this.context.extensionUri;
		}

		// Get Pintura resources
		const pinturaJS = webview.asWebviewUri(
			vscode.Uri.joinPath(baseUri, 'node_modules/@pqina/pintura/pintura.js')
		);

		const pinturaCSS = webview.asWebviewUri(
			vscode.Uri.joinPath(baseUri, 'node_modules/@pqina/pintura/pintura.css')
		);

		const imageDataUri = webview.asWebviewUri(imageUri);

		// Log URIs for debugging
		console.log('🔍 Editor URI configuration:');
		console.log('  extensionMode:', vscode.ExtensionMode[this.context.extensionMode]);
		console.log('  extensionUri:', this.context.extensionUri.toString());
		console.log('  baseUri:', baseUri.toString());
		console.log('  pinturaJS:', pinturaJS.toString());
		console.log('  pinturaCSS:', pinturaCSS.toString());
		console.log('  imageDataUri:', imageDataUri.toString());

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none';
				script-src 'nonce-${nonce}' ${webview.cspSource};
				style-src 'nonce-${nonce}' 'unsafe-inline' ${webview.cspSource};
				img-src ${webview.cspSource} https: data: blob:;
				font-src ${webview.cspSource};
				connect-src ${webview.cspSource} https: data: blob:;
				worker-src blob:;">

	<link href="${pinturaCSS}" rel="stylesheet" nonce="${nonce}">

	<title>Image Editor - ${utils.getFilename(imageUri.path)}</title>

	<style nonce="${nonce}">
		html, body {
			margin: 0;
			padding: 0;
			width: 100%;
			height: 100%;
			overflow: hidden;
		}

		#editor-container {
			width: 100%;
			height: 100%;
		}

		/* Dark theme support */
		@media (prefers-color-scheme: dark) {
			.pintura-editor {
				--color-background: 10, 10, 10;
				--color-foreground: 255, 255, 255;
			}
		}
	</style>
</head>
<body>
	<div id="editor-container"></div>
	<div id="loading" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
		<h2>🖼️ Loading Image Editor...</h2>
		<p>Initializing Pintura editor</p>
		<div style="margin-top: 20px; color: #666; font-size: 12px;">If this takes more than 5 seconds, check Developer Tools (Ctrl+Shift+P → "Developer: Open Webview Developer Tools")</div>
	</div>

	<script nonce="${nonce}">
		console.log('🟢 Page loaded, DOM ready');
	</script>

	<script type="module" nonce="${nonce}">
		console.log('🔵 Webview script started');
		console.log('📦 Pintura JS URL:', '${pinturaJS}');
		console.log('🖼️ Image URL:', '${imageDataUri}');

		const vscode = acquireVsCodeApi();
		console.log('✅ VSCode API acquired');

		try {
			console.log('📥 Importing Pintura...');
			const pinturaModule = await import('${pinturaJS}');
			console.log('✅ Pintura imported:', pinturaModule);

			const { openDefaultEditor } = pinturaModule;
			console.log('✅ openDefaultEditor function:', openDefaultEditor);

			// Initialize Pintura editor
			console.log('🎨 Initializing Pintura editor...');
			const editor = openDefaultEditor({
			src: '${imageDataUri}',

			// CSP support
			csp: {
				nonce: '${nonce}'
			},

			// Available tools - all utilities
			utils: [
				'crop',      // Crop and rotate
				'filter',    // Color filters
				'finetune',  // Brightness, contrast, saturation
				'annotate',  // Draw, text, shapes
				'resize',    // Resize dimensions
				'redact',    // Blur/pixelate areas
				'decorate'   // Frames and overlays
			],

			// Start with crop tool
			util: 'crop',

			// Crop presets and shape options
			cropSelectPresetOptions: [
				[undefined, 'Custom'],
				[[1, 1], 'Square'],
				[[16, 9], '16:9'],
				[[4, 3], '4:3'],
				[[3, 4], '3:4 (Portrait)'],
				[[2, 3], '2:3 (Portrait)'],
				[[3, 2], '3:2 (Landscape)'],
				[[9, 16], '9:16 (Portrait)']
			],

			// Enable crop features
			cropEnableImageSelection: true,
			cropEnableZoomInput: true,
			cropEnableRotationInput: true,
			cropEnableZoomAutoHide: false,
			cropEnableRotateMatchImageAspectRatio: true,

			// Output configuration
			imageWriter: {
				quality: 0.92,
				mimeType: 'image/jpeg',
				targetSize: {
					width: 4096,
					height: 4096,
					fit: 'contain',
					upscale: false
				}
			},

			// Labels
			locale: {
				labelButtonExport: 'Save Changes',
				labelButtonRevert: 'Reset',
				labelButtonClose: 'Cancel'
			},

			// Enable features
			enableButtonClose: true,
			enableButtonExport: true,
			enableButtonRevert: true,
			enableDropImage: false,
			enablePasteImage: false,
			enableBrowseImage: false
		});

		// Track modifications
		editor.on('update', (imageState) => {
			vscode.postMessage({
				command: 'POST.editor.imageModified',
				isDirty: true
			});
		});

		// Handle successful edit and export
		editor.on('process', async (result) => {
			try {
				// Convert Blob to base64 for message passing
				const reader = new FileReader();
				reader.onload = () => {
					vscode.postMessage({
						command: 'POST.editor.saveImage',
						imageData: reader.result,
						imageState: result.imageState,
						mimeType: result.dest.type
					});
				};
				reader.onerror = () => {
					vscode.postMessage({
						command: 'POST.editor.error',
						message: 'Failed to read edited image'
					});
				};
				reader.readAsDataURL(result.dest);
			} catch (error) {
				vscode.postMessage({
					command: 'POST.editor.error',
					message: error.message || 'Unknown error during image processing'
				});
			}
		});

		// Handle load errors
		editor.on('loaderror', (error) => {
			vscode.postMessage({
				command: 'POST.editor.error',
				message: 'Failed to load image: ' + (error.message || 'Unknown error')
			});
		});

		// Handle process errors
		editor.on('processerror', (error) => {
			vscode.postMessage({
				command: 'POST.editor.error',
				message: 'Failed to process image: ' + (error.message || 'Unknown error')
			});
		});

		// Handle editor close
		editor.on('close', () => {
			console.log('🔴 Editor closing...');
			editor.destroy();
		});

		console.log('✅ Pintura editor initialized successfully!');
		console.log('📊 Editor instance:', editor);

		// Hide loading indicator
		const loadingDiv = document.getElementById('loading');
		if (loadingDiv) {
			loadingDiv.style.display = 'none';
		}

		} catch (error) {
			console.error('❌ Fatal error initializing Pintura:', error);
			console.error('Stack:', error.stack);
			document.body.innerHTML = '<div style="color: red; padding: 20px; font-family: monospace;">' +
				'<h2>Error loading Image Editor</h2>' +
				'<p><strong>Error:</strong> ' + error.message + '</p>' +
				'<p><strong>Check console for details</strong></p>' +
				'<p>Open Developer Tools: Ctrl+Shift+P → "Developer: Open Webview Developer Tools"</p>' +
				'</div>';

			vscode.postMessage({
				command: 'POST.editor.error',
				message: 'Failed to initialize editor: ' + error.message
			});
		}
	</script>
</body>
</html>`;
	}

	private async saveEditedImage(
		originalUri: vscode.Uri,
		base64Data: string,
		mimeType: string
	): Promise<void> {
		try {
			// Convert base64 to buffer
			const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
			if (!matches || matches.length !== 3) {
				throw new Error('Invalid base64 data format');
			}

			const buffer = Buffer.from(matches[2], 'base64');

			// Write to file system
			await vscode.workspace.fs.writeFile(originalUri, buffer);

			vscode.window.showInformationMessage(`Image saved successfully!`);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			vscode.window.showErrorMessage(`Failed to save image: ${message}`);
			reporter.sendTelemetryEvent('editor.saveEditedImage.error', {
				'error': message
			});
		}
	}
}

class ImageDocument implements vscode.CustomDocument {
	public isDirty: boolean = false;

	constructor(public readonly uri: vscode.Uri) { }

	dispose(): void {
		// Cleanup if needed
	}
}
