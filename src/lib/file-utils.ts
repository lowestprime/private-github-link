import type { FileContent } from "@/lib/types/github";

// File type classification
export type FileType =
	| "text"
	| "markdown"
	| "image"
	| "pdf"
	| "video"
	| "audio"
	| "binary";

export interface ResolvedMarkdownLink {
	hash: string;
	path: string;
}

// Extension arrays for file type detection
export const MARKDOWN_EXTENSIONS = ["md", "markdown", "mdx"];

export const IMAGE_EXTENSIONS = [
	"png",
	"jpg",
	"jpeg",
	"gif",
	"svg",
	"webp",
	"bmp",
	"ico",
];

export const VIDEO_EXTENSIONS = ["mp4", "webm", "ogg", "mov", "avi"];

export const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "flac", "aac", "m4a"];

export const BINARY_EXTENSIONS = [
	"zip",
	"tar",
	"gz",
	"rar",
	"7z",
	"exe",
	"dll",
	"so",
	"dylib",
	"bin",
	"dmg",
	"iso",
	"jar",
	"war",
	"woff",
	"woff2",
	"ttf",
	"otf",
	"eot",
];

function isAbsoluteUrl(src: string): boolean {
	return /^[a-z][a-z\d+.-]*:/i.test(src) || src.startsWith("//");
}

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function getFileDirectory(filePath: string): string[] {
	if (!filePath.includes("/")) {
		return [];
	}

	return filePath.split("/").slice(0, -1);
}

function resolveRepoRelativePath(src: string, filePath: string): string {
	const segments = src.startsWith("/")
		? src.slice(1).split("/")
		: [...getFileDirectory(filePath), ...src.split("/")];
	const resolvedSegments: string[] = [];

	for (const segment of segments) {
		if (!segment || segment === ".") {
			continue;
		}

		if (segment === "..") {
			resolvedSegments.pop();
			continue;
		}

		resolvedSegments.push(segment);
	}

	return resolvedSegments.join("/");
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
	const parts = filename.split(".");
	return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/**
 * Determine the file type based on filename extension
 */
export function getFileType(filename: string): FileType {
	const ext = getFileExtension(filename);

	if (ext === "pdf") return "pdf";
	if (MARKDOWN_EXTENSIONS.includes(ext)) return "markdown";
	if (IMAGE_EXTENSIONS.includes(ext)) return "image";
	if (VIDEO_EXTENSIONS.includes(ext)) return "video";
	if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
	if (BINARY_EXTENSIONS.includes(ext)) return "binary";

	return "text";
}

/**
 * Get MIME type for a file
 */
export function getMimeType(filename: string): string {
	const ext = getFileExtension(filename);

	const mimeTypes: Record<string, string> = {
		// Images
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		svg: "image/svg+xml",
		webp: "image/webp",
		bmp: "image/bmp",
		ico: "image/x-icon",
		// Videos
		mp4: "video/mp4",
		webm: "video/webm",
		ogg: "video/ogg",
		mov: "video/quicktime",
		avi: "video/x-msvideo",
		// Audio
		mp3: "audio/mpeg",
		wav: "audio/wav",
		flac: "audio/flac",
		aac: "audio/aac",
		m4a: "audio/mp4",
		// Documents
		pdf: "application/pdf",
	};

	return mimeTypes[ext] || "application/octet-stream";
}

function decodeBase64ToBytes(content: string): Uint8Array {
	const normalized = content.replace(/\s+/g, "");
	const binaryString = atob(normalized);
	const bytes = new Uint8Array(binaryString.length);

	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}

	return bytes;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return Uint8Array.from(bytes).buffer;
}

/**
 * Decode base64 content from GitHub API
 */
export function decodeContent(content: string, encoding: string): string {
	if (encoding !== "base64") {
		return content;
	}

	try {
		return new TextDecoder("utf-8").decode(decodeBase64ToBytes(content));
	} catch {
		try {
			return atob(content.replace(/\s+/g, ""));
		} catch {
			return content;
		}
	}
}

/**
 * Count lines in a string
 */
export function countLines(content: string): number {
	return content.split("\n").length;
}

/**
 * Download file by creating a blob from the content
 */
export function downloadFile(file: FileContent): void {
	let blob: Blob;

	if (file.encoding === "base64") {
		blob = new Blob([bytesToArrayBuffer(decodeBase64ToBytes(file.content))]);
	} else {
		// Plain text content
		blob = new Blob([file.content], { type: "text/plain" });
	}

	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = file.name;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Resolve relative URLs to raw GitHub URLs for markdown content
 */
export function resolveRelativeUrl(
	src: string,
	filePath: string,
	owner: string,
	repo: string,
	branch: string,
): string {
	if (isAbsoluteUrl(src)) {
		return src;
	}

	const resolvedPath = resolveRepoRelativePath(src, filePath);
	return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${resolvedPath}`;
}

export function resolveMarkdownLink(
	href: string,
	filePath: string,
): ResolvedMarkdownLink | null {
	if (!href || isAbsoluteUrl(href) || href.startsWith("data:")) {
		return null;
	}

	const [pathAndQuery = "", hash = ""] = href.split("#", 2);
	const [pathWithoutQuery = ""] = pathAndQuery.split("?", 2);
	const resolvedPath = pathWithoutQuery
		? resolveRepoRelativePath(pathWithoutQuery, filePath)
		: filePath;

	return {
		hash: safeDecodeURIComponent(hash),
		path: resolvedPath,
	};
}
