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
const visibilityFilter = ref<'all' | 'public' | 'private'>('all');
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
    return uploadedFiles.value.filter((f) => {
        const key = f.Key ?? '';
        if (q && !decodeKey(key).toLowerCase().includes(q)) {
            return false;
        }
        if (visibilityFilter.value !== 'all') {
            return visibilityMap[key] === visibilityFilter.value;
        }
        return true;
    });
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
    if (!key) return;
    const confirmed = window.confirm($t('common.delete_confirm', { name: decodeKey(key) }));
    if (!confirmed) return;
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
    <div class="max-w-4xl mx-auto px-4 py-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div class="flex items-center gap-3">
                <button
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    @click="router.push('/')"
                >
                    <span class="i-mdi-arrow-left w-4 h-4"></span>
                    <span>{{ $t('common.back_home') }}</span>
                </button>
                <span class="text-sm text-slate-500">
                    {{ $t('common.file_count', { count: filteredFiles.length }) }}
                </span>
            </div>
            <button
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                :disabled="loading"
                @click="refreshFiles(false)"
            >
                <span class="i-mdi-refresh w-4 h-4" :class="loading ? 'animate-spin' : ''"></span>
                <span>{{ $t('common.refresh') }}</span>
            </button>
        </div>

        <div class="flex flex-wrap items-center gap-2 mb-4">
            <input
                v-model="searchQuery"
                type="search"
                class="flex-1 min-w-52 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                :placeholder="$t('common.search_placeholder')"
            />
            <div class="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                <button
                    v-for="tab in (['all', 'private', 'public'] as const)"
                    :key="tab"
                    class="px-3 py-1 rounded-md font-medium transition cursor-pointer"
                    :class="visibilityFilter === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'"
                    @click="visibilityFilter = tab"
                >
                    {{ $t(`common.${tab}`) }}
                </button>
            </div>
        </div>

        <div class="flex flex-col gap-2.5">
            <div v-if="!loading && filteredFiles.length === 0" class="text-center text-slate-400 py-14 bg-white rounded-xl border border-slate-200">
                {{ $t('common.empty') }}
            </div>
            <div
                v-for="file in filteredFiles"
                :key="file.Key"
                class="w-full flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 gap-3 shadow-sm hover:border-slate-300 transition"
            >
                <div class="w-7 h-7 shrink-0 i-mdi-file-document-outline text-slate-400"></div>
                <div class="flex flex-col title flex-1 min-w-0">
                    <a
                        class="text-sm font-semibold text-slate-900 truncate hover:text-emerald-600 hover:underline"
                        :title="decodeKey(file.Key!)"
                        :href="`/${encodeKeyPath(file.Key!)}`"
                        target="_blank"
                    >
                        {{ decodeKey(file.Key!) }}
                    </a>
                    <div class="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{{ formatBytes(file.Size ?? 0) }}</span>
                        <span v-if="file.LastModified">· {{ new Date(file.LastModified).toLocaleString() }}</span>
                    </div>
                </div>
                <button
                    class="text-xs px-2.5 py-1 rounded-full border font-medium shrink-0 transition cursor-pointer"
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
                <button
                    class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer shrink-0"
                    :title="$t('common.copy_link')"
                    @click="onCopyLink(file.Key)"
                >
                    <span class="w-4 h-4 block i-mdi-content-copy"></span>
                </button>
                <button
                    class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer shrink-0"
                    :title="$t('common.edit')"
                    @click="onEditClick(file.Key)"
                >
                    <span class="w-4 h-4 block i-mdi-pencil-outline"></span>
                </button>
                <button
                    class="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer shrink-0"
                    :title="$t('common.delete')"
                    @click="onDeleteFileClick(file.Key)"
                >
                    <span class="w-4 h-4 block i-mdi-trash-can-outline"></span>
                </button>
            </div>
            <div v-if="isTruncated" class="flex justify-center mt-4">
                <button
                    class="px-5 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    :disabled="loading"
                    @click="refreshFiles(true)"
                >
                    {{ loading ? $t('common.loading') : $t('common.load_more') }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
