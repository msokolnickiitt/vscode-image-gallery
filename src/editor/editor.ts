import * as vscode from 'vscode';
import * as utils from '../utils';
import { reporter } from '../telemetry';

export let disposable: vscode.Disposable;

export function activate(context: vscode.ExtensionContext) {
	reporter.sendTelemetryEvent('editor.activate');

	const editor = new MediaEditorProvider(context);
	disposable = vscode.window.registerCustomEditorProvider(
		MediaEditorProvider.viewType,
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

class MediaEditorProvider implements vscode.CustomEditorProvider<MediaDocument> {
	public static readonly viewType = 'gryc.editor';

	private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<MediaDocument>>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

	constructor(private readonly context: vscode.ExtensionContext) { }

	public async openCustomDocument(
		uri: vscode.Uri,
		openContext: vscode.CustomDocumentOpenContext,
		token: vscode.CancellationToken
	): Promise<MediaDocument> {
		return new MediaDocument(uri);
	}

	public async resolveCustomEditor(
		document: MediaDocument,
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
		document: MediaDocument,
		cancellation: vscode.CancellationToken
	): Promise<void> {
		// Save is handled through message passing from webview
		reporter.sendTelemetryEvent('editor.saveCustomDocument');
	}

	public async saveCustomDocumentAs(
		document: MediaDocument,
		destination: vscode.Uri,
		cancellation: vscode.CancellationToken
	): Promise<void> {
		vscode.window.showInformationMessage('Save As not yet implemented');
		reporter.sendTelemetryEvent('editor.saveCustomDocumentAs');
	}

	public async revertCustomDocument(
		document: MediaDocument,
		cancellation: vscode.CancellationToken
	): Promise<void> {
		vscode.window.showInformationMessage('Revert not yet implemented');
		reporter.sendTelemetryEvent('editor.revertCustomDocument');
	}

	public async backupCustomDocument(
		document: MediaDocument,
		context: vscode.CustomDocumentBackupContext,
		cancellation: vscode.CancellationToken
	): Promise<vscode.CustomDocumentBackup> {
		reporter.sendTelemetryEvent('editor.backupCustomDocument');
		return {
			id: context.destination.toString(),
			delete: async () => { }
		};
	}

	private getHtmlForWebview(webview: vscode.Webview, mediaUri: vscode.Uri): string {
		const nonce = utils.nonce;

		// Detect media type (image or video)
		const ext = mediaUri.path.split('.').pop()?.toLowerCase() || '';
		const mediaType = utils.getMediaType(ext);
		const isVideo = mediaType === 'video';

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
		// Always load main Pintura module
		const pinturaJS = webview.asWebviewUri(
			vscode.Uri.joinPath(baseUri, 'node_modules/@pqina/pintura/pintura.js')
		);

		// For video: also load video extension module
		const pinturaVideoJS = isVideo ? webview.asWebviewUri(
			vscode.Uri.joinPath(baseUri, 'node_modules/@pqina/pintura-video/pinturavideo.js')
		) : null;

		// CSS: always include base Pintura styles, add video plugin styles when needed
		const pinturaCssUris = [
			webview.asWebviewUri(
				vscode.Uri.joinPath(baseUri, 'node_modules/@pqina/pintura/pintura.css')
			)
		];

		let pinturaVideoCSS: vscode.Uri | null = null;
		if (isVideo) {
			pinturaVideoCSS = webview.asWebviewUri(
				vscode.Uri.joinPath(baseUri, 'node_modules/@pqina/pintura-video/pinturavideo.css')
			);
			pinturaCssUris.push(pinturaVideoCSS);
		}

		const mediaDataUri = webview.asWebviewUri(mediaUri);

		// Log URIs for debugging
		console.log('🔍 Editor URI configuration:');
		console.log('  mediaType:', mediaType);
		console.log('  isVideo:', isVideo);
		console.log('  extensionMode:', vscode.ExtensionMode[this.context.extensionMode]);
		console.log('  extensionUri:', this.context.extensionUri.toString());
		console.log('  baseUri:', baseUri.toString());
		console.log('  pinturaJS:', pinturaJS.toString());
		console.log('  pinturaVideoJS:', pinturaVideoJS?.toString() || 'null');
		console.log('  pinturaCSS:', pinturaCssUris.map(uri => uri.toString()).join(', '));
		console.log('  mediaDataUri:', mediaDataUri.toString());

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
				media-src ${webview.cspSource} https: data: blob:;
				font-src ${webview.cspSource};
				connect-src ${webview.cspSource} https: data: blob:;
				worker-src blob: ${webview.cspSource};
				child-src blob:;
				frame-src blob:;
				object-src blob:;">

	${pinturaCssUris.map(cssUri => `<link href="${cssUri}" rel="stylesheet" nonce="${nonce}">`).join('\n\t')}

	<title>${isVideo ? 'Video' : 'Image'} Editor - ${utils.getFilename(mediaUri.path)}</title>

	<style nonce="${nonce}">
		html, body {
			margin: 0;
			padding: 0;
			width: 100%;
			height: 100%;
			overflow: hidden;
		}

		#editor-container {
			position: relative;
			width: 100%;
			height: 100%;
			min-height: 100vh;
		}

		/* Loading indicator - moved from inline styles to fix CSP */
		#loading {
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			text-align: center;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
			z-index: 10000;
			background: var(--vscode-editor-background, white);
			padding: 20px;
		}

		#loading.hidden {
			display: none;
		}

		#loading .subtitle {
			margin-top: 20px;
			color: #666;
			font-size: 12px;
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
	<div id="loading">
		<h2>${isVideo ? '🎬' : '🖼️'} Loading ${isVideo ? 'Video' : 'Image'} Editor...</h2>
		<p>Initializing Pintura editor</p>
		<div class="subtitle">If this takes more than 5 seconds, check Developer Tools (Ctrl+Shift+P → "Developer: Open Webview Developer Tools")</div>
	</div>

	<script nonce="${nonce}">
		console.log('🟢 Page loaded, DOM ready');
	</script>

	<script type="module" nonce="${nonce}">
		console.log('🔵 Webview script started');
		console.log('📦 Pintura JS URL:', '${pinturaJS}');
		console.log('📦 Pintura Video JS URL:', '${pinturaVideoJS?.toString() || 'null'}');
		console.log('🎬 Media URL:', '${mediaDataUri}');
		console.log('📺 Is Video:', ${isVideo});

		const vscode = acquireVsCodeApi();
		console.log('✅ VSCode API acquired');

		try {
			console.log('📥 Importing Pintura...');
			const pinturaModule = await import('${pinturaJS}');
			console.log('✅ Pintura imported:', pinturaModule);

			const isVideo = ${isVideo};
			let editor;

			if (isVideo) {
				// Video Editor - requires video extension plugin
				console.log('📥 Importing Pintura Video extension...');
				const videoModule = await import('${pinturaVideoJS}');
				console.log('✅ Pintura Video imported:', videoModule);

				const { openDefaultEditor, setPlugins } = pinturaModule;
				const { plugin_trim, plugin_trim_locale_en_gb } = videoModule;

				console.log('🔌 Registering video plugin...');
				setPlugins(plugin_trim);
				console.log('✅ Video plugin registered');

				// Fetch video and convert to File object for Pintura
				console.log('📥 Fetching video from vscode-webview:// URL...');
				const videoResponse = await fetch('${mediaDataUri}');
				if (!videoResponse.ok) {
					throw new Error('Failed to fetch video: ' + videoResponse.statusText);
				}
				console.log('✅ Video fetched, size:', videoResponse.headers.get('content-length'), 'bytes');

				const videoBlob = await videoResponse.blob();
				console.log('✅ Video converted to blob:', videoBlob.size, 'bytes, type:', videoBlob.type);

				// Extract filename from URL
				const videoUrl = '${mediaDataUri}';
				const videoFilename = videoUrl.split('/').pop() || 'video.mp4';
				console.log('📝 Video filename:', videoFilename);

				// Create File object with proper metadata
				const videoFile = new File([videoBlob], videoFilename, {
					type: videoBlob.type || 'video/mp4',
					lastModified: Date.now()
				});
				console.log('✅ File object created:', videoFile.name, videoFile.size, 'bytes, type:', videoFile.type);

				console.log('🎬 Initializing Pintura editor with video support...');
				const editorContainer = document.getElementById('editor-container');
				editor = openDefaultEditor({
					src: videoFile,

					// Mount to container
					appendTo: editorContainer,

					// CSP support
					csp: {
						nonce: '${nonce}'
					},

					// Video trim configuration (optional, can set initial trim range)
					imageTrim: undefined, // or [[startTime, endTime]] in seconds

					// Locale with video-specific strings
					locale: {
						...plugin_trim_locale_en_gb,
						labelButtonExport: 'Save Changes',
						labelButtonRevert: 'Reset',
						labelButtonClose: 'Cancel'
					},

					// Enable features
					enableButtonClose: true,
					enableButtonExport: true,
					enableButtonRevert: true,
					enableDropImage: false
				});
			} else {
				// Image Editor
				const { openDefaultEditor } = pinturaModule;
				console.log('✅ openDefaultEditor function:', openDefaultEditor);

				console.log('🖼️ Initializing Pintura image editor...');
				const editorContainer = document.getElementById('editor-container');
				editor = openDefaultEditor({
					src: '${mediaDataUri}',

					// Mount to container
					appendTo: editorContainer,

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
			}

		// Diagnostic logging for video support
		if (isVideo) {
			// Check video codec support
			const testVideo = document.createElement('video');
			const codecSupport = {
				h264: testVideo.canPlayType('video/mp4; codecs="avc1.42E01E"'),
				vp8: testVideo.canPlayType('video/webm; codecs="vp8"'),
				vp9: testVideo.canPlayType('video/webm; codecs="vp9"')
			};
			console.log('📹 Video codec support:', codecSupport);
			console.log('🎬 Video source:', '${mediaDataUri}');

			// Listen for blob URL errors
			window.addEventListener('error', (event) => {
				if (event.message && event.message.includes('blob:')) {
					console.error('🔴 Blob URL error detected:', event.message, event);
					vscode.postMessage({
						command: 'POST.editor.error',
						message: 'Blob URL loading failed: ' + event.message
					});
				}
			}, true);

			// Listen for video load success
			editor.on('loadstart', () => {
				console.log('🎬 Video loading started...');
			});

			editor.on('loadprogress', (progressEvent) => {
				const resolvedProgress = typeof progressEvent === 'number'
					? progressEvent
					: (typeof progressEvent?.progress === 'number' ? progressEvent.progress : NaN);
				const progressDisplay = Number.isFinite(resolvedProgress)
					? Math.round(resolvedProgress * 100) + '%'
					: 'unknown';
				console.log('📊 Video loading progress:', progressDisplay);
			});
		}

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
			loadingDiv.classList.add('hidden');
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

class MediaDocument implements vscode.CustomDocument {
	public isDirty: boolean = false;

	constructor(public readonly uri: vscode.Uri) { }

	dispose(): void {
		// Cleanup if needed
	}
}
