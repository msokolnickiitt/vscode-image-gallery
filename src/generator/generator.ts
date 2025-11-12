import * as vscode from 'vscode';
import * as path from 'path';
import { FalClient } from './fal_client';
import { MODEL_SETS, getDefaultModels, getModelDisplayName } from './models';
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
                const preparedInput = await this.prepareInput(mode, input, webview, requestId);

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
        requestId: string
    ): Promise<any> {
        const prepared = { ...input };

        // Handle image uploads for image-to-video and edit modes
        if (mode === 'image-to-video' || mode === 'start-end-frame' || mode === 'edit-image' || mode === 'upscaling' || mode === 'remove-background') {
            if (input.image_data) {
                webview.postMessage({
                    command: 'POST.generator.statusUpdate',
                    requestId,
                    status: 'uploading'
                });

                // Convert base64 to blob and upload
                const imageBlob = this.base64ToBlob(input.image_data);
                const imageUrl = await this.falClient.uploadFile(imageBlob);
                prepared.image_url = imageUrl;
                delete prepared.image_data;
            }

            if (mode === 'start-end-frame' && input.start_frame_data) {
                const startBlob = this.base64ToBlob(input.start_frame_data);
                const startUrl = await this.falClient.uploadFile(startBlob);
                prepared.start_frame_url = startUrl;
                delete prepared.start_frame_data;

                if (input.end_frame_data) {
                    const endBlob = this.base64ToBlob(input.end_frame_data);
                    const endUrl = await this.falClient.uploadFile(endBlob);
                    prepared.end_frame_url = endUrl;
                    delete prepared.end_frame_data;
                }
            }
        }

        // Handle multi-image edits
        if (mode === 'edit-multi-images' && input.images_data) {
            const uploadPromises = input.images_data.map((data: string) => {
                const blob = this.base64ToBlob(data);
                return this.falClient.uploadFile(blob);
            });

            prepared.images_urls = await Promise.all(uploadPromises);
            delete prepared.images_data;
        }

        return prepared;
    }

    private base64ToBlob(base64: string): any {
        // Remove data URL prefix if present
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
        const binary = Buffer.from(base64Data, 'base64').toString('binary');
        const array = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }

        // Return as Blob-like object for fal.ai upload
        return array.buffer;
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
            const { query, category } = message;
            console.log(`[AI Generator] handleSearchModels: query="${query}", category="${category}"`);

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
                    <optgroup label="Image">
                        <option value="text-to-image">Text To Image</option>
                        <option value="edit-image">Edit Image</option>
                        <option value="edit-multi-images">Edit Multi Images</option>
                        <option value="upscaling">Upscaling</option>
                        <option value="remove-background">Remove Background</option>
                    </optgroup>
                    <optgroup label="Video">
                        <option value="text-to-video">Text To Video</option>
                        <option value="image-to-video">Image To Video</option>
                        <option value="start-end-frame">Start End Frame</option>
                    </optgroup>
                </select>
            </div>

            <div class="form-section">
                <label>Models</label>
                <div class="model-selection">
                    <div class="selected-models" id="selected-models"></div>
                    <div class="model-actions">
                        <input type="text" id="model-search" placeholder="Search..." class="search-input">
                        <button id="explore-sets-btn" class="secondary-btn">Sets</button>
                    </div>
                    <div id="model-search-results" class="model-list" style="display:none;"></div>
                </div>
            </div>

            <div id="prompt-section" class="form-section">
                <label>Prompt <span class="required">*</span></label>
                <textarea id="prompt" placeholder="Describe what you want to generate..." rows="3"></textarea>
            </div>

            <div id="image-upload-section" class="form-section" style="display:none;">
                <label>Image</label>
                <div class="image-upload-area" id="image-upload">
                    <div class="upload-placeholder">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <p>Click to upload</p>
                    </div>
                </div>
                <input type="file" id="image-file-input" accept="image/*" style="display:none;">
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
