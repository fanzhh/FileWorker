import axios, { type AxiosProgressEvent } from 'axios';

const encodeKeyPath = (filename: string) => {
    return filename.split('/').map(encodeURIComponent).join('/');
};

const PutFile = async (
    filename: string,
    file: File | string,
    visibility: string,
    type: string = "file",
    onUploadProgress?: (progressEvent: AxiosProgressEvent) => void,
) => {
    const url = `/${encodeKeyPath(filename)}`;
    const headers = {
        'x-store-visibility': visibility,
        'x-store-type': type,
    };
    const response = await axios.put(url, file, { headers, onUploadProgress });
    return response.data;
}

const HeadFile = async (filename: string) => {
    const url = `/${encodeKeyPath(filename)}`;
    const response = await axios.head(url);
    return {
        visibility: (response.headers['x-store-visibility'] as string) || 'private',
        type: (response.headers['x-store-type'] as string) || 'file',
        contentType: (response.headers['content-type'] as string) || '',
    };
}

const GetFileText = async (filename: string) => {
    const url = `/${encodeKeyPath(filename)}`;
    const response = await axios.get(url, { responseType: 'text' });
    return {
        content: typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2),
        visibility: (response.headers['x-store-visibility'] as string) || 'private',
        type: (response.headers['x-store-type'] as string) || 'text',
    };
}

const PatchFile = async (filename: string, visibility?: string) => {
    const url = `/${encodeKeyPath(filename)}`;
    const headers: Record<string, string> = {};
    if (visibility) {
        headers['x-store-visibility'] = visibility;
    }
    const response = await axios.patch(url, {}, { headers });
    return response.data;
}

const DeleteFile = async (filename: string) => {
    const url = `/${encodeKeyPath(filename)}`;
    const response = await axios.delete(url);
    return response.data;
}

const VerifyAuth = async () => {
    const response = await axios.get('/api/auth');
    return response.data;
}

export { PutFile, HeadFile, GetFileText, PatchFile, DeleteFile, VerifyAuth, encodeKeyPath }
