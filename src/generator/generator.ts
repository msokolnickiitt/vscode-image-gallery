import * as vscode from 'vscode';
import * as path from 'path';
import { FalClient } from './fal_client';
import { MODEL_SETS, getDefaultModels, getModelDisplayName, getCategoryForMode, getModelSetsForMode } from './models';
import { reporter } from '../telemetry';
import * as utils from '../utils';
import type {
    GenerationMode,
    GenerationRequest,
    GenerationResult,
    QueueUpdate,
    ModelSet,
    FalModel
} from 'custom_typings';

// Use globalThis.fetch (available in Node.js 18+)
const fetchFn = (globalThis as any).fetch;

export let disposable: vscode.Disposable;

export function activate(context: vscode.ExtensionContext) {
    const generator = new AIGeneratorWebview(context);

    disposable = vscode.commands.registerCommand(
        'gryc.openAIGenerator',
        async (folder?: vscode.Uri) => {
            try {
                const panel = await generator.createPanel(folder);

                panel.webview.onDidReceiveMessage(
                    message => generator.messageListener(message, panel.webview),
                    undefined,
                    context.subscriptions
                );

                reporter.sendTelemetryEvent('generator.activate');
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to open AI Generator: ${(error as Error).message}`
                );
            }
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {
    if (!disposable) {
        return;
    }
    disposable.dispose();
    reporter.sendTelemetryEvent('generator.deactivate');
}

class AIGeneratorWebview {
    private falClient: FalClient;
    private activeRequests: Map<string, GenerationRequest> = new Map();
    private contextFolder?: vscode.Uri;
    private generationHistory: GenerationRequest[] = [];

    constructor(private readonly context: vscode.ExtensionContext) {
        const apiKey = this.getApiKey();
        this.falClient = new FalClient(apiKey);
    }

    private getApiKey(): string {
        // Use FAL_KEY from environment variable
        return process.env.FAL_KEY || '';
    }

    private async loadEnvFile() {
        try {
            // Try to find .env file in workspace
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                console.log('[AI Generator] No workspace folders found');
                return;
            }

            const envPath = vscode.Uri.joinPath(workspaceFolders[0].uri, '.env');
            console.log(`[AI Generator] Looking for .env file at: ${envPath.fsPath}`);

            try {
                const envContent = await vscode.workspace.fs.readFile(envPath);
                const envText = Buffer.from(envContent).toString('utf8');

                console.log(`[AI Generator] .env file loaded, size: ${envText.length} bytes`);

                let loadedKeys = 0;
                // Parse .env file
                envText.split('\n').forEach((line, index) => {
                    line = line.trim();
                    // Skip comments and empty lines
                    if (!line || line.startsWith('#')) {
                        return;
                    }

                    // Parse KEY=VALUE (using indexOf to preserve colons in value)
                    const equalsIndex = line.indexOf('=');
                    if (equalsIndex > 0) {
                        const key = line.substring(0, equalsIndex).trim();
                        let value = line.substring(equalsIndex + 1).trim();

                        // Remove surrounding quotes if present
                        if ((value.startsWith('"') && value.endsWith('"')) ||
                            (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.slice(1, -1);
                        }

                        console.log(`[AI Generator] Line ${index + 1}: Found key "${key}", value length: ${value.length}`);
                        console.log(`[AI Generator] Line ${index + 1}: Full value: "${value}"`);

                        // Always set/override from .env file
                        process.env[key] = value;
                        loadedKeys++;

                        if (key === 'FAL_KEY') {
                            console.log(`[AI Generator] FAL_KEY full value loaded: ${value}`);
                        }
                    }
                });

                console.log(`[AI Generator] Successfully loaded ${loadedKeys} keys from .env file`);
                console.log(`[AI Generator] FAL_KEY after load: ${process.env.FAL_KEY ? 'SET' : 'NOT SET'}`);
            } catch (error) {
                console.log(`[AI Generator] .env file not found at ${envPath.fsPath}`);
            }
        } catch (error) {
            console.error('[AI Generator] Error loading .env file:', error);
        }
    }

    public async createPanel(folder?: vscode.Uri): Promise<vscode.WebviewPanel> {
        this.contextFolder = folder;

        // Load .env file if exists
        await this.loadEnvFile();

        // Reload API key after loading .env
        const apiKey = this.getApiKey();
        console.log(`[AI Generator] API Key status: ${apiKey ? `SET (${apiKey.substring(0, 10)}...)` : 'NOT SET'}`);
        this.falClient = new FalClient(apiKey);

        vscode.commands.executeCommand('setContext', 'ext.viewType', 'gryc.generator');

        const panel = vscode.window.createWebviewPanel(
            'gryc.generator',
            'AI Media Generator',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'src', 'generator')
                ]
            }
        );

        panel.iconPath = vscode.Uri.joinPath(
            this.context.extensionUri,
            'docs',
            'logo-128.png'
        );

        panel.webview.html = this.getHtmlForWebview(panel.webview);

        // Validate API key and send status
        console.log(`[AI Generator] Validating API key...`);
        const isValid = await this.falClient.validateApiKey();
        console.log(`[AI Generator] API key validation result: ${isValid}`);

        panel.webview.postMessage({
            command: 'POST.generator.apiKeyStatus',
            isValid
        });

        return panel;
    }

    public async messageListener(message: any, webview: vscode.Webview) {
        switch (message.command) {
            case 'POST.generator.ready':
                await this.handleReady(webview);
                break;

            case 'POST.generator.generate':
                await this.handleGenerate(message, webview);
                break;

            case 'POST.generator.uploadImage':
                await this.handleUploadImage(message, webview);
                break;

            case 'POST.generator.searchModels':
                await this.handleSearchModels(message, webview);
                break;

            case 'POST.generator.getModelSet':
                await this.handleGetModelSet(message, webview);
                break;

            case 'POST.generator.getModelSetsForMode':
                await this.handleGetModelSetsForMode(message, webview);
                break;

            case 'POST.generator.saveResult':
                await this.handleSaveResult(message, webview);
                break;

            case 'POST.generator.cancelGeneration':
                await this.handleCancelGeneration(message, webview);
                break;

            case 'POST.generator.estimateCost':
                // Cost estimation disabled - requires admin API key
                webview.postMessage({
                    command: 'POST.generator.costEstimate',
                    cost: 0
                });
                break;

            case 'POST.generator.readDroppedFile':
                await this.handleReadDroppedFile(message, webview);
                break;
        }
    }

    private async handleReady(webview: vscode.Webview) {
        // Send initial data
        webview.postMessage({
            command: 'POST.generator.initialData',
            modelSets: MODEL_SETS,
            history: this.generationHistory
        });
    }

    private async handleGenerate(message: any, webview: vscode.Webview) {
        const { mode, models, input, requestId } = message;

        if (!models || models.length === 0) {
            webview.postMessage({
                command: 'POST.generator.error',
                requestId,
                error: 'No models selected'
            });
            return;
        }

        // Check API key
        const apiKey = this.getApiKey();
        console.log(`[AI Generator] Generate request - API Key check: ${apiKey ? 'PRESENT' : 'MISSING'}`);
        console.log(`[AI Generator] process.env.FAL_KEY: ${process.env.FAL_KEY ? 'SET' : 'NOT SET'}`);

        if (!apiKey) {
            webview.postMessage({
                command: 'POST.generator.error',
                requestId,
                error: 'FAL_KEY environment variable not set. Please configure your API key.'
            });
            return;
        }

        // Create generation request
        const request: GenerationRequest = {
            id: requestId,
            mode,
            models,
            input,
            status: 'queued',
            results: [],
            errors: [],
            createdAt: new Date()
        };

        this.activeRequests.set(requestId, request);
        this.generationHistory.unshift(request);

        reporter.sendTelemetryEvent('generator.generate', {
            mode,
            modelCount: models.length.toString()
        });

        // Generate for each model
        for (const model of models) {
            try {
                // Update status
                webview.postMessage({
                    command: 'POST.generator.statusUpdate',
                    requestId,
                    model,
                    status: 'queued'
                });

                // Prepare input based on mode
                const preparedInput = await this.prepareInput(mode, input, webview, requestId, model);

                // Generate
                const result = await this.falClient.generate(
                    model,
                    preparedInput,
                    {
                        onEnqueue: (falRequestId) => {
                            webview.postMessage({
                                command: 'POST.generator.enqueued',
                                requestId,
                                model,
                                falRequestId
                            });
                        },
                        onQueueUpdate: (update: QueueUpdate) => {
                            request.status = 'processing';
                            request.queuePosition = update.queue_position;

                            webview.postMessage({
                                command: 'POST.generator.queueUpdate',
                                requestId,
                                model,
                                update
                            });
                        },
                        onComplete: (data) => {
                            const results = this.falClient.parseResult(model, data, mode);
                            request.results.push(...results);
                            request.status = 'completed';
                            request.completedAt = new Date();

                            webview.postMessage({
                                command: 'POST.generator.resultReady',
                                requestId,
                                model,
                                results
                            });

                            reporter.sendTelemetryEvent('generator.success', {
                                mode,
                                model
                            });
                        },
                        onError: (error) => {
                            request.errors.push({
                                model,
                                error: error.message
                            });

                            webview.postMessage({
                                command: 'POST.generator.error',
                                requestId,
                                model,
                                error: error.message
                            });

                            reporter.sendTelemetryEvent('generator.error', {
                                mode,
                                model,
                                error: error.message
                            });
                        }
                    }
                );
            } catch (error) {
                request.errors.push({
                    model,
                    error: (error as Error).message
                });

                webview.postMessage({
                    command: 'POST.generator.error',
                    requestId,
                    model,
                    error: (error as Error).message
                });
            }
        }

        // Mark as completed if all models finished
        if (request.results.length + request.errors.length === models.length) {
            request.status = 'completed';
            request.completedAt = new Date();

            webview.postMessage({
                command: 'POST.generator.allCompleted',
                requestId,
                request
            });
        }
    }

    private async prepareInput(
        mode: GenerationMode,
        input: any,
        webview: vscode.Webview,
        requestId: string,
        model?: string
    ): Promise<any> {
        const prepared = { ...input };

        // Handle image uploads for various modes
        if (mode === 'image-to-video' || mode === 'edit-image' || mode === 'image-upscaling' ||
            mode === 'remove-background') {
            if (input.image_data) {
                webview.postMessage({
                    command: 'POST.generator.statusUpdate',
                    requestId,
                    status: 'uploading'
                });

                // Convert base64 to blob and upload
                const imageBlob = this.base64ToBlob(input.image_data);
                const imageUrl = await this.falClient.uploadFile(imageBlob);

                // Determine which parameter format to use based on model
                // Models that expect image_urls (array): nano-banana, gemini-25-flash-image
                const useArrayFormat = model && (
                    model.includes('nano-banana') ||
                    model.includes('gemini-25-flash-image') ||
                    model.includes('/edit')  // Most /edit endpoints use array format
                );

                if (useArrayFormat) {
                    prepared.image_urls = [imageUrl];
                } else {
                    prepared.image_url = imageUrl;
                }

                delete prepared.image_data;
            }
        }

        // Handle reference images upload (1-3 images for reference-to-video)
        if (mode === 'reference-to-video' && input.reference_images) {
            webview.postMessage({
                command: 'POST.generator.statusUpdate',
                requestId,
                status: 'uploading'
            });

            const uploadPromises = input.reference_images.map((data: string) => {
                const blob = this.base64ToBlob(data);
                return this.falClient.uploadFile(blob);
            });

            prepared.reference_image_urls = await Promise.all(uploadPromises);
            delete prepared.reference_images;
        }

        // Handle dual frame upload
        if (mode === 'start-end-frame') {
            if (input.start_frame_data) {
                webview.postMessage({
                    command: 'POST.generator.statusUpdate',
                    requestId,
                    status: 'uploading'
                });

                const startBlob = this.base64ToBlob(input.start_frame_data);
                const startUrl = await this.falClient.uploadFile(startBlob);
                prepared.start_image_url = startUrl;
                delete prepared.start_frame_data;
            }

            if (input.end_frame_data) {
                const endBlob = this.base64ToBlob(input.end_frame_data);
                const endUrl = await this.falClient.uploadFile(endBlob);
                prepared.end_image_url = endUrl;
                delete prepared.end_frame_data;
            }
        }

        // Handle video upload
        if (mode === 'video-upscaling' && input.video_data) {
            webview.postMessage({
                command: 'POST.generator.statusUpdate',
                requestId,
                status: 'uploading'
            });

            const videoBlob = this.base64ToBlob(input.video_data);
            const videoUrl = await this.falClient.uploadFile(videoBlob);
            prepared.video_url = videoUrl;
            delete prepared.video_data;
        }

        // Handle multi-image edits
        if (mode === 'edit-multi-images' && input.images_data) {
            const uploadPromises = input.images_data.map((data: string) => {
                const blob = this.base64ToBlob(data);
                return this.falClient.uploadFile(blob);
            });

            // Most models expect image_urls (not images_urls)
            prepared.image_urls = await Promise.all(uploadPromises);
            delete prepared.images_data;
        }

        return prepared;
    }

    private base64ToBlob(base64: string): any {
        // Extract MIME type from data URL
        const mimeMatch = base64.match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

        // Remove data URL prefix if present (supports both image and video)
        const base64Data = base64.replace(/^data:(image|video)\/\w+;base64,/, '');
        const binary = Buffer.from(base64Data, 'base64').toString('binary');
        const array = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }

        // Determine file extension from MIME type
        const extMap: { [key: string]: string } = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/webp': 'webp',
            'image/gif': 'gif',
            'image/avif': 'avif',
            'video/mp4': 'mp4',
            'video/webm': 'webm',
            'video/quicktime': 'mov'
        };
        const ext = extMap[mimeType] || 'bin';
        const filename = `upload_${Date.now()}.${ext}`;

        // Create a proper File object with MIME type
        // This ensures fal.ai receives the correct content-type
        const file = new (globalThis as any).File([array.buffer], filename, { type: mimeType });
        return file;
    }

    private async handleUploadImage(message: any, webview: vscode.Webview) {
        try {
            const { imageData, requestId } = message;
            const blob = this.base64ToBlob(imageData);
            const url = await this.falClient.uploadFile(blob);

            webview.postMessage({
                command: 'POST.generator.imageUploaded',
                requestId,
                url
            });
        } catch (error) {
            webview.postMessage({
                command: 'POST.generator.uploadError',
                error: (error as Error).message
            });
        }
    }

    private async handleSearchModels(message: any, webview: vscode.Webview) {
        try {
            const { query, mode } = message;

            // Map mode to API category
            const category = getCategoryForMode(mode as GenerationMode);

            console.log(`[AI Generator] handleSearchModels: query="${query}", mode="${mode}", category="${category}"`);

            const models = await this.falClient.searchModels({
                query,
                category,
                status: 'active',
                limit: 50
            });

            console.log(`[AI Generator] handleSearchModels: Retrieved ${models.length} models`);
            if (models.length > 0) {
                console.log(`[AI Generator] handleSearchModels: First model:`, models[0].endpoint_id);
            }

            console.log(`[AI Generator] handleSearchModels: Sending ${models.length} models to webview`);

            webview.postMessage({
                command: 'POST.generator.modelsSearchResult',
                models: models
            });
        } catch (error) {
            console.error('[AI Generator] handleSearchModels: Error:', error);
            webview.postMessage({
                command: 'POST.generator.searchError',
                error: (error as Error).message
            });
        }
    }

    private async handleGetModelSet(message: any, webview: vscode.Webview) {
        const { setId } = message;
        const modelSet = MODEL_SETS.find(s => s.id === setId);

        if (modelSet) {
            webview.postMessage({
                command: 'POST.generator.modelSetResult',
                modelSet
            });
        }
    }

    private async handleGetModelSetsForMode(message: any, webview: vscode.Webview) {
        const { mode } = message;
        console.log('[Backend] Getting model sets for mode:', mode);
        const modelSets = getModelSetsForMode(mode);
        console.log('[Backend] Found model sets:', modelSets.length, 'sets');
        console.log('[Backend] Model sets:', modelSets.map(s => s.id));

        webview.postMessage({
            command: 'POST.generator.modelSetsForMode',
            modelSets
        });
    }

    private async handleSaveResult(message: any, webview: vscode.Webview) {
        try {
            const { url, type, filename } = message;

            // Fetch the file
            const response = await fetchFn(url);
            const buffer = await response.arrayBuffer();

            // Determine save location
            let saveUri: vscode.Uri | undefined;

            if (this.contextFolder) {
                // Save to context folder
                saveUri = vscode.Uri.joinPath(this.contextFolder, filename);
            } else {
                // Show save dialog
                saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(filename),
                    filters: type === 'image'
                        ? { 'Images': ['jpg', 'png', 'jpeg'] }
                        : { 'Videos': ['mp4', 'webm'] }
                });
            }

            if (saveUri) {
                await vscode.workspace.fs.writeFile(saveUri, new Uint8Array(buffer));

                vscode.window.showInformationMessage(
                    `Saved to ${saveUri.fsPath}`
                );

                webview.postMessage({
                    command: 'POST.generator.saveSuccess',
                    path: saveUri.fsPath
                });

                reporter.sendTelemetryEvent('generator.save', { type });
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to save file: ${(error as Error).message}`
            );

            webview.postMessage({
                command: 'POST.generator.saveError',
                error: (error as Error).message
            });
        }
    }

    private async handleCancelGeneration(message: any, webview: vscode.Webview) {
        const { requestId } = message;
        const request = this.activeRequests.get(requestId);

        if (request) {
            request.status = 'failed';
            this.activeRequests.delete(requestId);

            webview.postMessage({
                command: 'POST.generator.cancelled',
                requestId
            });

            reporter.sendTelemetryEvent('generator.cancel');
        }
    }

    private async handleReadDroppedFile(message: any, webview: vscode.Webview) {
        try {
            const { uri, fileType } = message;
            console.log(`[AI Generator] Reading dropped file: ${uri}, type: ${fileType}`);

            // Parse URI - VSCode sends it in various formats
            let fileUri: vscode.Uri;
            try {
                fileUri = vscode.Uri.parse(uri);
            } catch (e) {
                console.error('[AI Generator] Failed to parse URI:', uri, e);
                return;
            }

            // Check if file exists
            try {
                await vscode.workspace.fs.stat(fileUri);
            } catch (e) {
                console.error('[AI Generator] File does not exist:', fileUri.fsPath);
                vscode.window.showWarningMessage(`File not found: ${fileUri.fsPath}`);
                return;
            }

            // Get file extension to verify type
            const ext = path.extname(fileUri.fsPath).toLowerCase();
            const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.avif'];
            const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];

            // Validate file type
            if (fileType === 'image' && !imageExts.includes(ext)) {
                vscode.window.showWarningMessage(`Not an image file: ${fileUri.fsPath}`);
                return;
            }
            if (fileType === 'video' && !videoExts.includes(ext)) {
                vscode.window.showWarningMessage(`Not a video file: ${fileUri.fsPath}`);
                return;
            }

            // Read file
            const fileData = await vscode.workspace.fs.readFile(fileUri);

            // Convert to base64 data URL
            const base64 = Buffer.from(fileData).toString('base64');
            const mimeType = this.getMimeType(ext);
            const dataUrl = `data:${mimeType};base64,${base64}`;

            // Send back to webview
            webview.postMessage({
                command: 'POST.generator.droppedFileData',
                data: dataUrl,
                fileType: fileType
            });

            console.log(`[AI Generator] File read successfully: ${fileUri.fsPath} (${fileData.length} bytes)`);
        } catch (error) {
            console.error('[AI Generator] Error reading dropped file:', error);
            vscode.window.showErrorMessage(
                `Failed to read file: ${(error as Error).message}`
            );
        }
    }

    private getMimeType(ext: string): string {
        const mimeTypes: { [key: string]: string } = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp',
            '.avif': 'image/avif',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.ogg': 'video/ogg',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.mkv': 'video/x-matroska'
        };
        return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'src', 'generator', 'script.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'src', 'generator', 'style.css')
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        style-src ${webview.cspSource} 'unsafe-inline';
        script-src 'nonce-${utils.nonce}';
        img-src ${webview.cspSource} https: data: blob:;
        media-src ${webview.cspSource} https: blob:;
        connect-src https://api.fal.ai https://queue.fal.run https://fal.media;
    ">
    <title>AI Media Generator</title>
    <link href="${styleUri}" rel="stylesheet">
</head>
<body>
    <div id="app">
        <!-- Top Header Bar -->
        <div class="header">
            <h1>AI Media Generator</h1>
            <div id="api-key-status"></div>
        </div>

        <!-- Left Sidebar - Controls -->
        <div class="sidebar">
            <div class="tab-switcher">
                <button class="tab-btn active" data-tab="image">Image</button>
                <button class="tab-btn" data-tab="video">Video</button>
            </div>

            <div class="form-section">
                <label>Type</label>
                <select id="generation-mode" class="mode-select">
                    <option value="text-to-image" data-tab="image">Text To Image</option>
                    <option value="edit-image" data-tab="image">Edit Image</option>
                    <option value="edit-multi-images" data-tab="image">Edit Multi Images</option>
                    <option value="remove-background" data-tab="image">Remove Background</option>
                    <option value="image-upscaling" data-tab="image">Image Upscaling</option>

                    <option value="text-to-video" data-tab="video">Text To Video</option>
                    <option value="image-to-video" data-tab="video">Image To Video</option>
                    <option value="start-end-frame" data-tab="video">Start End Frame</option>
                    <option value="reference-to-video" data-tab="video">Reference To Video</option>
                    <option value="video-upscaling" data-tab="video">Video Upscaling</option>
                </select>
            </div>

            <div class="form-section">
                <div class="model-section-header">
                    <label>Model Selection</label>
                    <div class="model-header-actions">
                        <span id="model-count" class="model-count">0 models selected</span>
                        <button id="clear-models-btn" class="link-btn" style="display:none;">Clear</button>
                    </div>
                </div>
                <div class="model-selection">
                    <div class="selected-models-list" id="selected-models-list"></div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button id="add-model-btn" class="add-model-btn">
                            <span>+</span> Add another model
                        </button>
                        <button id="explore-sets-btn" class="secondary-btn">Select Recommended</button>
                    </div>
                    <div class="model-actions" id="model-actions" style="display:none;">
                        <input type="text" id="model-search" placeholder="Search models..." class="search-input">
                    </div>
                    <div id="model-search-results" class="model-list" style="display:none;"></div>
                </div>
            </div>

            <div id="prompt-section" class="form-section">
                <label>Prompt <span class="required">*</span></label>
                <textarea id="prompt" placeholder="Describe what you want to generate..." rows="3"></textarea>
            </div>

            <!-- Single Image Upload -->
            <div id="single-image-upload" class="form-section" style="display:none;">
                <label>Image</label>
                <div class="image-upload-area" id="single-image-area">
                    <div class="upload-placeholder">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <p>Click to upload image</p>
                    </div>
                </div>
                <input type="file" id="single-image-input" accept="image/*" style="display:none;">
            </div>

            <!-- Single Video Upload -->
            <div id="single-video-upload" class="form-section" style="display:none;">
                <label>Video</label>
                <div class="video-upload-area" id="single-video-area">
                    <div class="upload-placeholder">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        <p>Click to upload video</p>
                    </div>
                </div>
                <input type="file" id="single-video-input" accept="video/*" style="display:none;">
            </div>

            <!-- Multi Image Upload -->
            <div id="multi-image-upload" class="form-section" style="display:none;">
                <label>Images (Multiple)</label>
                <div class="multi-image-upload-area" id="multi-image-area">
                    <div class="upload-placeholder">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <p>Click to upload multiple images</p>
                    </div>
                </div>
                <div id="multi-image-preview" class="multi-image-preview" style="display:none;"></div>
                <input type="file" id="multi-image-input" accept="image/*" multiple style="display:none;">
            </div>

            <!-- Dual Image Upload (Start/End Frame) -->
            <div id="dual-image-upload" class="form-section" style="display:none;">
                <label>Frames</label>
                <div class="dual-upload-container">
                    <div class="dual-upload-item">
                        <label class="dual-label">Start Frame</label>
                        <div class="image-upload-area" id="start-frame-area">
                            <div class="upload-placeholder">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                    <polyline points="21 15 16 10 5 21"/>
                                </svg>
                                <p>Start</p>
                            </div>
                        </div>
                    </div>
                    <div class="dual-upload-item">
                        <label class="dual-label">End Frame</label>
                        <div class="image-upload-area" id="end-frame-area">
                            <div class="upload-placeholder">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                    <polyline points="21 15 16 10 5 21"/>
                                </svg>
                                <p>End</p>
                            </div>
                        </div>
                    </div>
                </div>
                <input type="file" id="start-frame-input" accept="image/*" style="display:none;">
                <input type="file" id="end-frame-input" accept="image/*" style="display:none;">
            </div>

            <div id="reference-images-upload" class="form-section" style="display:none;">
                <label>Reference Images (1-3)</label>
                <div id="reference-images-container"></div>
            </div>

            <div id="video-duration-section" class="form-section" style="display:none;">
                <label>Duration</label>
                <div class="button-group">
                    <button class="duration-btn active" data-duration="5">5s</button>
                    <button class="duration-btn" data-duration="10">10s</button>
                </div>
            </div>

            <div id="aspect-ratio-section" class="form-section">
                <label>Aspect Ratio</label>
                <div class="aspect-ratio-grid">
                    <button class="ratio-btn active" data-ratio="default">Auto</button>
                    <button class="ratio-btn" data-ratio="square">1:1</button>
                    <button class="ratio-btn" data-ratio="landscape_4_3">4:3</button>
                    <button class="ratio-btn" data-ratio="portrait_4_3">3:4</button>
                    <button class="ratio-btn" data-ratio="landscape_16_9">16:9</button>
                    <button class="ratio-btn" data-ratio="portrait_16_9">9:16</button>
                </div>
            </div>
        </div>

        <!-- Main Content Area - Results & History -->
        <div class="content">
            <div id="results-section" class="results-section">
                <h3>Results</h3>
                <div id="results-grid" class="results-grid"></div>
            </div>

            <div id="history-section" class="history-section">
                <h3>History</h3>
                <div id="history-list" class="history-list"></div>
            </div>
        </div>

        <!-- Bottom Action Bar -->
        <div class="action-bar">
            <button id="run-btn" class="run-btn">
                Generate <kbd>Ctrl+↵</kbd>
            </button>
        </div>
    </div>

    <!-- Model Set Modal -->
    <div id="model-set-modal" class="modal" style="display:none;">
        <div class="modal-content">
            <h2>Model Sets</h2>
            <div id="model-sets-list"></div>
            <div class="modal-actions">
                <button id="cancel-set-btn" class="secondary-btn">Cancel</button>
                <button id="select-set-btn" class="primary-btn">Select</button>
            </div>
        </div>
    </div>

    <script nonce="${utils.nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
