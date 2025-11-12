import { fal } from "@fal-ai/client";
import type {
    GenerationRequest,
    GenerationResult,
    QueueUpdate,
    MediaType
} from 'custom_typings';

// Use globalThis.fetch (available in Node.js 18+)
const fetchFn = (globalThis as any).fetch;

export class FalClient {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        if (this.apiKey) {
            fal.config({ credentials: this.apiKey });
        }
    }

    /**
     * Generate media using fal.subscribe() - queue-based approach (RECOMMENDED)
     */
    async generate(
        model: string,
        input: Record<string, any>,
        callbacks: {
            onEnqueue?: (requestId: string) => void;
            onQueueUpdate?: (update: QueueUpdate) => void;
            onComplete?: (result: any) => void;
            onError?: (error: Error) => void;
        }
    ): Promise<any> {
        try {
            const result = await fal.subscribe(model, {
                input,
                onEnqueue: (requestId) => {
                    callbacks.onEnqueue?.(requestId);
                },
                onQueueUpdate: (status) => {
                    const update: QueueUpdate = {
                        requestId: status.request_id,
                        model,
                        status: status.status as any,
                        queue_position: (status as any).queue_position,
                        logs: (status as any).logs,
                        metrics: (status as any).metrics
                    };
                    callbacks.onQueueUpdate?.(update);
                },
                logs: true,
                timeout: 600000 // 10 minutes for video generation
            });

            callbacks.onComplete?.(result.data);
            return result.data;
        } catch (error) {
            callbacks.onError?.(error as Error);
            throw error;
        }
    }

    /**
     * Upload file to Fal.ai storage (required for image-to-video)
     */
    async uploadFile(file: any, expirationDays: number = 7): Promise<string> {
        const expirationSeconds = expirationDays * 24 * 60 * 60;

        try {
            const url = await fal.storage.upload(file, {
                lifecycle: {
                    expiration_duration_seconds: expirationSeconds
                }
            });
            return url;
        } catch (error) {
            console.error('File upload failed:', error);
            throw new Error(`Failed to upload file: ${(error as Error).message}`);
        }
    }

    /**
     * Upload file from URL (fetch and re-upload)
     */
    async uploadFromUrl(url: string, expirationDays: number = 7): Promise<string> {
        try {
            const response = await fetchFn(url);
            const blob = await response.blob();
            return await this.uploadFile(blob, expirationDays);
        } catch (error) {
            console.error('Upload from URL failed:', error);
            throw new Error(`Failed to upload from URL: ${(error as Error).message}`);
        }
    }

    /**
     * Search models using Platform API
     */
    async searchModels(params: {
        query?: string;
        category?: string;
        status?: "active" | "deprecated";
        limit?: number;
    }): Promise<any[]> {
        const searchParams = new URLSearchParams();
        if (params.query) {
            searchParams.append('q', params.query);
        }
        if (params.category) {
            searchParams.append('category', params.category);
        }
        if (params.status) {
            searchParams.append('status', params.status);
        }
        if (params.limit) {
            searchParams.append('limit', params.limit.toString());
        }

        const url = `https://api.fal.ai/v1/models?${searchParams}`;
        console.log(`[FalClient] searchModels: Fetching from ${url}`);

        // Prepare headers - NO authentication for Platform API (it's public)
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        // IMPORTANT: Do NOT add Authorization header for model search
        // The Platform API (/v1/models) is completely public and works better WITHOUT auth
        console.log(`[FalClient] searchModels: Using public API (no authentication)`);

        try {
            const response = await fetchFn(url, { headers });

            console.log(`[FalClient] searchModels: Response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unable to read error');
                console.log(`[FalClient] searchModels: Error response: ${errorText.substring(0, 300)}`);
                throw new Error(`Model search failed: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`[FalClient] searchModels: Found ${data.models?.length || 0} models`);
            return data.models || [];
        } catch (error) {
            console.error('[FalClient] searchModels failed:', error);
            throw error;
        }
    }

    /**
     * Get pricing for specific models
     * Note: Pricing API requires valid authentication. Returns empty if unavailable.
     */
    async getModelPricing(endpointIds: string[]): Promise<Record<string, any>> {
        // Pricing is optional - skip if no valid API key
        if (!this.apiKey || this.apiKey.length < 10) {
            console.log('[FalClient] getModelPricing: Skipping - no valid API key for pricing');
            return {};
        }

        const searchParams = new URLSearchParams();
        endpointIds.forEach(id => searchParams.append('endpoint_id', id));

        try {
            const response = await fetchFn(
                `https://api.fal.ai/v1/models/pricing?${searchParams}`,
                {
                    headers: {
                        'Authorization': `${this.apiKey}`
                    }
                }
            );

            if (!response.ok) {
                console.warn(`[FalClient] getModelPricing: Failed with ${response.status} - pricing unavailable`);
                return {};
            }

            const data = await response.json();
            const pricingMap: Record<string, any> = {};

            if (data.prices) {
                data.prices.forEach((price: any) => {
                    pricingMap[price.endpoint_id] = price;
                });
            }

            console.log(`[FalClient] getModelPricing: Retrieved pricing for ${Object.keys(pricingMap).length} models`);
            return pricingMap;
        } catch (error) {
            console.warn('[FalClient] getModelPricing: Failed to fetch pricing, continuing without it');
            return {};
        }
    }

    /**
     * Estimate cost for a generation request
     * Note: Cost estimation requires valid authentication. Returns 0 if unavailable.
     */
    async estimateCost(params: {
        endpoint: string;
        unitQuantity: number;
    }): Promise<number> {
        // Cost estimation is optional - skip if no valid API key
        if (!this.apiKey || this.apiKey.length < 10 || !this.apiKey.startsWith('fal-')) {
            console.log('[FalClient] estimateCost: Skipping - no valid API key');
            return 0;
        }

        try {
            const response = await fetchFn(
                'https://api.fal.ai/v1/models/pricing/estimate',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Key ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        estimate_type: 'unit_price',
                        endpoints: {
                            [params.endpoint]: {
                                unit_quantity: params.unitQuantity
                            }
                        }
                    })
                }
            );

            if (!response.ok) {
                console.warn('[FalClient] estimateCost: Cost estimation unavailable');
                return 0;
            }

            const data = await response.json();
            return data.total_cost || 0;
        } catch (error) {
            console.warn('[FalClient] estimateCost: Failed, continuing without cost estimate');
            return 0;
        }
    }

    /**
     * Parse result from Fal.ai to GenerationResult format
     */
    parseResult(model: string, data: any, mode: string): GenerationResult[] {
        const results: GenerationResult[] = [];
        const type: MediaType = mode.includes('video') ? 'video' : 'image';

        if (type === 'image' && data.images) {
            // Multiple images (text-to-image, edit, etc.)
            data.images.forEach((img: any, index: number) => {
                results.push({
                    id: `${model}-${Date.now()}-${index}`,
                    model,
                    type: 'image',
                    url: img.url,
                    width: img.width,
                    height: img.height,
                    seed: data.seed,
                    timings: data.timings
                });
            });
        } else if (type === 'image' && data.image) {
            // Single image (upscaling, background removal)
            results.push({
                id: `${model}-${Date.now()}`,
                model,
                type: 'image',
                url: data.image.url,
                width: data.image.width,
                height: data.image.height,
                timings: data.timings
            });
        } else if (type === 'video' && data.video) {
            // Video result
            results.push({
                id: `${model}-${Date.now()}`,
                model,
                type: 'video',
                url: data.video.url,
                duration: data.duration,
                timings: data.timings
            });
        }

        return results;
    }

    /**
     * Validate API key
     * Note: We can't validate via /v1/models as it's public API.
     * Real validation happens when user tries to generate (fal.subscribe).
     */
    async validateApiKey(): Promise<boolean> {
        if (!this.apiKey) {
            console.log('[FalClient] validateApiKey: No API key provided');
            return false;
        }

        console.log(`[FalClient] validateApiKey: API key is SET (length: ${this.apiKey.length})`);
        console.log(`[FalClient] validateApiKey: Key starts with: "${this.apiKey.substring(0, 10)}..."`);

        // Platform API (/v1/models) doesn't require auth, so we can't validate there
        // The key will be validated when user actually tries to generate (fal.subscribe)
        // For now, just check if key exists and has reasonable length

        if (this.apiKey.length < 10) {
            console.log('[FalClient] validateApiKey: Key too short - likely invalid');
            return false;
        }

        // Warn about non-standard key format
        if (!this.apiKey.startsWith('fal-')) {
            console.warn('[FalClient] validateApiKey: WARNING - Key does not start with "fal-". This may be an old or invalid key format.');
            console.warn('[FalClient] validateApiKey: Get a new key from: https://fal.ai/dashboard/keys');
            // Still return true to allow user to try - maybe it's an old format that works
        }

        console.log('[FalClient] validateApiKey: Basic validation passed - key will be verified during generation');
        return true;
    }
}
