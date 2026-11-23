import {
    GetObjectCommand,
    HeadObjectCommand,
    CopyObjectCommand,
    DeleteObjectCommand,
    GetObjectCommandOutput,
    HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mime from 'mime/lite';

import Env from './utils/Env';
import { createS3Client, auth } from './utils/utils';

function buildObjectHeaders(
    filename: string,
    metadata: Record<string, string> | undefined,
    contentType: string | undefined,
    contentLength: number | undefined,
    lastModified: Date | undefined,
    eTag: string | undefined,
): Headers {
    const headers = new Headers();
    const meta = metadata ?? {};
    for (const [key, value] of Object.entries(meta)) {
        if (key.startsWith('x-store-')) {
            headers.set(key, value);
        }
    }
    if (contentType && contentType !== "application/octet-stream") {
        headers.set('content-type', contentType);
    } else {
        headers.set('content-type', mime.getType(filename) || "application/octet-stream");
    }
    if (meta['x-store-type'] === "text") {
        headers.set('content-type', 'text/plain;charset=utf-8');
    }
    if (contentLength !== undefined) {
        headers.set('content-length', contentLength.toString());
    }
    if (lastModified) {
        headers.set('last-modified', lastModified.toUTCString());
    }
    if (eTag) {
        headers.set('etag', eTag);
    }
    headers.set('accept-ranges', 'bytes');
    headers.set('x-content-type-options', 'nosniff');
    return headers;
}

export const onRequestHead: PagesFunction<Env> = async (context) => {
    const { params, env, request } = context;
    const filename = params.filename as string;
    const { BUCKET } = env;
    const s3 = createS3Client(env);
    let response: HeadObjectCommandOutput;
    try {
        response = await s3.send(new HeadObjectCommand({
            Bucket: BUCKET!,
            Key: filename,
        }));
    } catch {
        return new Response(null, { status: 404 });
    }
    const headers = buildObjectHeaders(
        filename,
        response.Metadata,
        response.ContentType,
        response.ContentLength,
        response.LastModified,
        response.ETag,
    );
    if (headers.get("x-store-visibility") !== "public" && !(await auth(env, request))) {
        return new Response(null, { status: 404 });
    }
    return new Response(null, { status: 200, headers });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { params, env, request } = context;
    const filename = params.filename as string;
    const { BUCKET } = env;
    const s3 = createS3Client(env);
    const range = request.headers.get("Range") ?? undefined;
    const command = new GetObjectCommand({
        Bucket: BUCKET!,
        Key: filename,
        Range: range,
    });
    let response: GetObjectCommandOutput;
    try {
        response = await s3.send(command);
    } catch {
        return new Response("Not found", { status: 404 });
    }
    const headers = buildObjectHeaders(
        filename,
        response.Metadata,
        response.ContentType,
        response.ContentLength,
        response.LastModified,
        response.ETag,
    );
    if (headers.get("x-store-visibility") !== "public" && !(await auth(env, request))) {
        return new Response("Not found", { status: 404 });
    }
    if (response.ContentRange) {
        headers.set('content-range', response.ContentRange);
    }
    return new Response(
        response.Body?.transformToWebStream() ?? null,
        {
            status: response.ContentRange ? 206 : 200,
            headers,
        }
    );
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
    const { params, env, request } = context;
    if (!(await auth(env, request))) {
        return new Response("Unauthorized", { status: 401 });
    }
    const filename = params.filename as string;
    const { BUCKET } = env;
    const s3 = createS3Client(env);
    const headers = new Headers(request.headers);
    const x_store_headers: [string, string][] = [];
    for (const [key, value] of headers.entries()) {
        if (key.startsWith('x-store-')) {
            x_store_headers.push([key, value]);
        }
    }
    const metadata = Object.fromEntries(x_store_headers);
    if (!metadata['x-store-visibility']) {
        metadata['x-store-visibility'] = 'private';
    }
    const parallelUploads3 = new Upload({
        client: s3,
        params: {
            Bucket: BUCKET,
            Key: filename,
            Body: request.body ?? "",
            Metadata: metadata,
        },
        queueSize: 4,
        partSize: 1024 * 1024 * 5,
        leavePartsOnError: false,
    });
    await parallelUploads3.done();
    return new Response("OK", { status: 200 });
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
    const { params, env, request } = context;
    if (!(await auth(env, request))) {
        return new Response("Unauthorized", { status: 401 });
    }
    const filename = params.filename as string;
    const { BUCKET } = env;
    const s3 = createS3Client(env);

    // Preserve existing x-store-* metadata before replacing
    let existingMeta: Record<string, string> = {};
    try {
        const head = await s3.send(new HeadObjectCommand({
            Bucket: BUCKET!,
            Key: filename,
        }));
        existingMeta = head.Metadata ?? {};
    } catch {
        return new Response("Not found", { status: 404 });
    }

    const headers = new Headers(request.headers);
    const mergedMeta: Record<string, string> = { ...existingMeta };
    for (const [key, value] of headers.entries()) {
        if (key.startsWith('x-store-')) {
            mergedMeta[key] = value;
        }
    }
    const command = new CopyObjectCommand({
        Bucket: BUCKET!,
        CopySource: `${BUCKET}/${encodeURIComponent(filename)}`,
        Key: filename,
        MetadataDirective: "REPLACE",
        Metadata: mergedMeta,
    });
    await s3.send(command);
    return new Response("OK", { status: 200 });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    const { params, env, request } = context;
    if (!(await auth(env, request))) {
        return new Response("Unauthorized", { status: 401 });
    }
    const filename = params.filename as string;
    const { BUCKET } = env;
    const s3 = createS3Client(env);
    const command = new DeleteObjectCommand({
        Bucket: BUCKET!,
        Key: filename,
    });
    const url = await getSignedUrl(
        s3,
        command,
        { expiresIn: 3600 }
    );
    const res = await fetch(url, {
        method: 'DELETE',
    });
    if (!res.ok) {
        return new Response("Delete failed", { status: res.status });
    }
    return new Response("OK", { status: 200 });
};

export const onRequest: PagesFunction<Env> = async () => {
    return new Response("Method not allowed", { status: 405 });
};
