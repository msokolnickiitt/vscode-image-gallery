declare module 'custom_typings' {
    import * as vscode from 'vscode';

    export type TImage = {
        id: string, // hash256(mediaUri.path), e.g. hash256("/c:/Users/image.jpg")
        uri: vscode.Uri,
        ext: string, // file extension in upper case, e.g. "JPG", "MP4"
        size: number,
        mtime: number,
        ctime: number,
        status: "" | "refresh",
        type: "image" | "video", // media type
    };

    export type TFolder = {
        id: string, // hash256(folderUri.path), e.g. hash256("/c:/Users")
        path: string, // folderUri.path, e.g. "/c:/Users"
        images: {
            [imageId: string]: TImage, // Note: "images" stores both images and videos for backwards compatibility
        },
    };

    // AI Generator Types

    export type GenerationMode =
        | "text-to-image"
        | "edit-image"
        | "edit-multi-images"
        | "remove-background"
        | "image-upscaling"
        | "text-to-video"
        | "image-to-video"
        | "start-end-frame"
        | "video-upscaling"
        | "reference-to-video";

    export type GenerationStatus =
        | "idle"
        | "uploading"
        | "queued"
        | "processing"
        | "completed"
        | "failed";

    export type MediaType = "image" | "video";

    export type AspectRatio =
        | "default"
        | "square"
        | "square_hd"
        | "portrait_4_3"
        | "portrait_16_9"
        | "landscape_4_3"
        | "landscape_16_9";

    export type FalModel = {
        endpoint_id: string;
        metadata: {
            display_name: string;
            category: string;
            description: string;
            status: "active" | "deprecated";
            tags: string[];
            updated_at: string;
            is_favorited: boolean;
            thumbnail_url?: string;
            model_url?: string;
        };
        pricing?: {
            unit_price: number;
            unit: string;
            currency: string;
        };
    };

    export type ModelSet = {
        id: string;
        name: string;
        description: string;
        models: string[]; // endpoint_ids
    };

    export type GenerationInput = {
        prompt?: string;
        negative_prompt?: string;
        image_url?: string;
        start_frame_url?: string;
        end_frame_url?: string;
        num_images?: number;
        image_size?: AspectRatio | { width: number; height: number };
        num_inference_steps?: number;
        guidance_scale?: number;
        seed?: number;
        duration?: "5" | "10";
        cfg_scale?: number;
        output_format?: "jpeg" | "png";
        [key: string]: any; // Allow model-specific parameters
    };

    export type GenerationRequest = {
        id: string;
        mode: GenerationMode;
        models: string[]; // Multiple models can be selected
        input: GenerationInput;
        status: GenerationStatus;
        queuePosition?: number;
        progress?: string;
        results: GenerationResult[];
        errors: { model: string; error: string }[];
        createdAt: Date;
        completedAt?: Date;
        estimatedCost?: number;
    };

    export type GenerationResult = {
        id: string;
        model: string;
        type: MediaType;
        url: string;
        width?: number;
        height?: number;
        duration?: number;
        seed?: number;
        timings?: any;
        thumbnail?: string;
    };

    export type QueueUpdate = {
        requestId: string;
        model: string;
        status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
        queue_position?: number;
        logs?: Array<{
            message: string;
            level: string;
            timestamp: string;
        }>;
        metrics?: {
            inference_time: number | null;
        };
    };
}