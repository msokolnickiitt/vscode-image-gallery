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
}