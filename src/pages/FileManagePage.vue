<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { copyToClipboard, formatBytes } from '@/utils/utils';
import { toast } from '@/utils/toast';
import { DeleteFile, HeadFile, ListFiles, PatchFile, encodeKeyPath } from '@/api';
import type { _Object } from '@aws-sdk/client-s3';

const router = useRouter();
const { t: $t } = useI18n();

const uploadedFiles: Ref<_Object[]> = ref([]);
const searchQuery = ref('');
const loading = ref(false);
const nextToken = ref<string | undefined>(undefined);
const isTruncated = ref(false);
const visibilityMap = reactive<Record<string, string>>({});
const togglingMap = reactive<Record<string, boolean>>({});

function decodeKey(key: string) {
    try {
        return decodeURIComponent(key);
    } catch {
        return key;
    }
}

const filteredFiles = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return uploadedFiles.value;
    return uploadedFiles.value.filter((f) => decodeKey(f.Key ?? '').toLowerCase().includes(q));
});

const fetchVisibilityBatch = async (keys: string[]) => {
    const concurrency = 6;
    let cursor = 0;
    const worker = async () => {
        while (cursor < keys.length) {
            const key = keys[cursor++];
            if (visibilityMap[key]) continue;
            try {
                const meta = await HeadFile(key);
                visibilityMap[key] = meta.visibility;
            } catch {
                visibilityMap[key] = 'unknown';
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, keys.length) }, worker));
};

const refreshFiles = async (append: boolean = false) => {
    if (loading.value) return;
    loading.value = true;
    try {
        const res = await ListFiles('100', undefined, append ? nextToken.value : undefined);
        const items = res.Contents ?? [];
        if (append) {
            uploadedFiles.value = [...uploadedFiles.value, ...items];
        } else {
            uploadedFiles.value = items;
        }
        isTruncated.value = Boolean(res.IsTruncated && res.NextContinuationToken);
        nextToken.value = res.NextContinuationToken;
        const keys = items.map((i) => i.Key).filter((k): k is string => Boolean(k));
        void fetchVisibilityBatch(keys);
    } catch (err) {
        console.error(err);
    } finally {
        loading.value = false;
    }
};

onBeforeMount(async () => {
    await refreshFiles(false);
});

const onToggleVisibility = async (key?: string) => {
    if (!key || togglingMap[key]) return;
    const current = visibilityMap[key] === 'public' ? 'public' : 'private';
    const next = current === 'public' ? 'private' : 'public';
    togglingMap[key] = true;
    try {
        await PatchFile(key, next);
        visibilityMap[key] = next;
        toast($t('common.visibility_updated', {
            visibility: next === 'public' ? $t('common.public') : $t('common.private'),
        }), 'success');
    } catch (err) {
        console.error(err);
    } finally {
        togglingMap[key] = false;
    }
};

const onCopyLink = async (key?: string) => {
    if (!key) return;
    const url = `${window.location.origin}/${encodeKeyPath(key)}`;
    if (await copyToClipboard(url)) {
        toast($t('common.copied'), 'success');
    }
};

const onEditClick = (key?: string) => {
    if (!key) return;
    router.push({ path: '/clip', query: { key } });
};

const onDeleteFileClick = async (key?: string) => {
    if (!key) {
        return;
    }
    const confirmed = window.confirm($t('common.delete_confirm', { name: decodeKey(key) }));
    if (!confirmed) {
        return;
    }
    try {
        await DeleteFile(key);
        uploadedFiles.value = uploadedFiles.value.filter((f) => f.Key !== key);
        delete visibilityMap[key];
        toast($t('common.delete_success'), 'success');
    } catch (err) {
        console.error(err);
    }
};
</script>

<template>
    <div class="flex flex-col items-center mt-4 mb-10">
        <nav class="max-w-screen-md w-4/5 flex flex-row gap-4 text-sm text-gray-600 mb-3">
            <router-link to="/" class="hover:underline">{{ $t('page_title.index') }}</router-link>
            <router-link to="/file" class="hover:underline">{{ $t('page_title.file') }}</router-link>
            <router-link to="/clip" class="hover:underline">{{ $t('page_title.clip') }}</router-link>
        </nav>
        <h1 class="text-xl font-semibold">{{ $t("page_title.filemanage") }}</h1>
        <div class="max-w-screen-md w-4/5 mt-4 flex flex-row gap-2">
            <input
                v-model="searchQuery"
                type="search"
                class="flex-1 rounded border-1 border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                :placeholder="$t('common.search_placeholder')"
            />
        </div>
        <div class="py-2 max-w-screen-md w-4/5">
            <div v-if="!loading && filteredFiles.length === 0" class="text-center text-gray-400 py-10">
                {{ $t('common.empty') }}
            </div>
            <div v-for="file in filteredFiles" :key="file.Key"
                class="w-full flex flex-row items-center mt-3 rounded border-1 border-gray-300 bg-white px-3 py-2 gap-3">
                <div class="w-8 h-8 shrink-0 i-mdi-file-document-outline text-gray-500"></div>
                <div class="flex flex-col title flex-1 min-w-0">
                    <a class="text-base font-semibold truncate hover:underline" :title="decodeKey(file.Key!)"
                        :href="`/${encodeKeyPath(file.Key!)}`" target="_blank">{{ decodeKey(file.Key!) }}</a>
                    <div class="text-xs text-gray-500 flex flex-row items-center gap-2">
                        <span>{{ formatBytes(file.Size ?? 0) }}</span>
                        <span v-if="file.LastModified">· {{ new Date(file.LastModified).toLocaleString() }}</span>
                    </div>
                </div>
                <button
                    class="text-xs px-2 py-1 rounded border-1 shrink-0 transition"
                    :class="visibilityMap[file.Key!] === 'public'
                        ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'"
                    :disabled="togglingMap[file.Key!]"
                    @click="onToggleVisibility(file.Key)"
                >
                    {{ visibilityMap[file.Key!] === 'public'
                        ? $t('common.public')
                        : visibilityMap[file.Key!] === 'private'
                            ? $t('common.private')
                            : '...' }}
                </button>
                <button class="w-5 h-5 shrink-0 i-mdi-content-copy text-gray-600 hover:text-black cursor-pointer"
                    :title="$t('common.copy_link')" @click="onCopyLink(file.Key)"></button>
                <button class="w-5 h-5 shrink-0 i-mdi-pencil-outline text-gray-600 hover:text-black cursor-pointer"
                    :title="$t('common.edit')" @click="onEditClick(file.Key)"></button>
                <button class="w-5 h-5 shrink-0 i-mdi-trash-can-outline text-gray-600 hover:text-red-600 cursor-pointer"
                    :title="$t('common.delete')" @click="onDeleteFileClick(file.Key)"></button>
            </div>
            <div v-if="isTruncated" class="flex justify-center mt-5">
                <button class="px-4 py-1.5 rounded border-1 border-gray-300 bg-white text-sm hover:bg-gray-100"
                    :disabled="loading" @click="refreshFiles(true)">
                    {{ loading ? $t('common.loading') : $t('common.load_more') }}
                </button>
            </div>
        </div>
    </div>
</template>

<style>
html,
body,
#app {
    margin: 0;
    padding: 0;
    background-color: #f8f9fa;
}
.title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
