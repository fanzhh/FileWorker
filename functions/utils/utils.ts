import { S3Client } from "@aws-sdk/client-s3";
import Env from './Env';
import { parse } from "cookie";

function createS3Client(env: Env) {
    const { REGION, ENDPOINT, ACCESS_KEY_ID, SECRET_ACCESS_KEY } = env;
    return new S3Client({
        region: REGION ?? "auto",
        endpoint: ENDPOINT,
        credentials: {
            accessKeyId: ACCESS_KEY_ID,
            secretAccessKey: SECRET_ACCESS_KEY,
        },
    });
}

const hmacEncode = async (data: string, key: string) => {
    const encoder = new TextEncoder();
    const encodedKey = encoder.encode(key);
    const key_encoded = await crypto.subtle.importKey(
        "raw",
        encodedKey,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const encodedData = encoder.encode(data);
    const signature = await crypto.subtle.sign("HMAC", key_encoded, encodedData);
    const base64Mac = btoa(String.fromCharCode(...new Uint8Array(signature)));
    return base64Mac;
}

const hmacVerify = async (data: string, key: string, sign: string): Promise<boolean> => {
    if (!key || !sign) {
        return false;
    }
    try {
        const encoder = new TextEncoder();
        const encodedKey = encoder.encode(key);
        const key_encoded = await crypto.subtle.importKey(
            "raw",
            encodedKey,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["verify"]
        );
        const encodedData = encoder.encode(data);
        const signature = new Uint8Array(Array.from(atob(sign), c => c.charCodeAt(0)));
        return await crypto.subtle.verify("HMAC", key_encoded, signature, encodedData);
    } catch {
        return false;
    }
}

const isEqual = (a: string, b: string) => {
    const encoder = new TextEncoder();
    const encodedA = encoder.encode(a);
    const encodedB = encoder.encode(b);
    if (encodedA.byteLength !== encodedB.byteLength) {
        return false;
    }
    return crypto.subtle.timingSafeEqual(encodedA, encodedB);
}

const auth = async (env: Env, request: Request): Promise<boolean> => {
    const { PASSWORD } = env;
    if (!PASSWORD) {
        return false;
    }
    // cookie PASSWORD
    const cookie = parse(request.headers.get('Cookie') ?? '');
    if (cookie['PASSWORD'] && isEqual(cookie['PASSWORD'], PASSWORD)) {
        return true;
    }
    // query HMAC
    const url = new URL(request.url);
    const path = url.pathname + url.search;
    const path_without_sign = path.replace(/([?&])sign=[^&]*(&?)/, (_, p1, p2) => (p1 === '?' && p2 ? '?' : p2 ? p1 : ''));
    const sign = url.searchParams.get('sign');
    if (sign === null) return false;
    const expire = url.searchParams.get('expire');
    if (expire === null) return false;
    const expireTs = Number(expire);
    if (!Number.isFinite(expireTs) || Date.now() >= expireTs) {
        return false;
    }
    return await hmacVerify(path_without_sign, PASSWORD, sign);
};

const sign = async (path: string, key: string) => {
    return await hmacEncode(path, key);
}

export { createS3Client, auth, sign };
