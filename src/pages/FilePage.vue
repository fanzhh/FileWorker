<script setup lang="ts">
import { onMounted, onUnmounted, ref, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import useFileStore from '@/store/file';
import { copyToClipboard, formatBytes } from '@/utils/utils';
import { toast } from '@/utils/toast';
import { PutFile, encodeKeyPath } from '@/api';

const router = useRouter();
const { t: $t } = useI18n();
const fileStore = useFileStore();

const fileUploadInput = ref<HTMLInputElement>();
const fileUploadArea = ref<HTMLElement>();
const dragging = ref(false);

const requestUploadFile = () => {
  fileUploadInput.value?.click();
};

interface UploadedFile {
  name: string;
  size: number;
  visibility: string;
  progress: number;
  done: boolean;
  failed: boolean;
}

const uploadedFiles: Ref<UploadedFile[]> = ref([]);

const uploadSingle = async (item: UploadedFile, file: File) => {
  try {
    await PutFile(file.name, file, item.visibility, "file", (evt) => {
      if (evt.total) {
        item.progress = Math.round((evt.loaded / evt.total) * 100);
      }
    });
    item.progress = 100;
    item.done = true;
  } catch (error) {
    console.error(error);
    item.failed = true;
    toast($t('common.upload_failed'), 'error');
  }
};

const enqueueFiles = (files: FileList | null | undefined) => {
  if (!files || files.length === 0) return;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const item: UploadedFile = {
      name: file.name,
      size: file.size,
      visibility: fileStore.visibility,
      progress: 0,
      done: false,
      failed: false,
    };
    uploadedFiles.value.unshift(item);
    void uploadSingle(uploadedFiles.value[0], file);
  }
};

const onInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  enqueueFiles(target.files);
  target.value = '';
};

const onCopyLink = async (name: string) => {
  const url = `${window.location.origin}/${encodeKeyPath(name)}`;
  if (await copyToClipboard(url)) {
    toast($t('common.copied'), 'success');
  }
};

const onDragEvent = (event: DragEvent) => {
  event.preventDefault();
  event.stopPropagation();
  dragging.value = event.type === 'dragover' || event.type === 'dragenter';
  if (event.type === 'drop') {
    dragging.value = false;
    enqueueFiles(event.dataTransfer?.files);
  }
};

const onPaste = (event: ClipboardEvent) => {
  if (event.clipboardData?.files?.length) {
    enqueueFiles(event.clipboardData.files);
  }
};

onMounted(() => {
  fileUploadArea.value?.addEventListener('dragenter', onDragEvent);
  fileUploadArea.value?.addEventListener('dragover', onDragEvent);
  fileUploadArea.value?.addEventListener('dragleave', onDragEvent);
  fileUploadArea.value?.addEventListener('drop', onDragEvent);
  document.addEventListener('paste', onPaste);
});

onUnmounted(() => {
  fileUploadArea.value?.removeEventListener('dragenter', onDragEvent);
  fileUploadArea.value?.removeEventListener('dragover', onDragEvent);
  fileUploadArea.value?.removeEventListener('dragleave', onDragEvent);
  fileUploadArea.value?.removeEventListener('drop', onDragEvent);
  document.removeEventListener('paste', onPaste);
});
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-6">
    <div class="flex items-center justify-between mb-4">
      <button
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        @click="router.push('/')"
      >
        <span class="i-mdi-arrow-left w-4 h-4"></span>
        <span>{{ $t('common.back_home') }}</span>
      </button>
      <div class="flex items-center gap-2">
        <select
          class="border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
          v-model="fileStore.visibility"
        >
          <option value="private">{{ $t('common.private') }}</option>
          <option value="public">{{ $t('common.public') }}</option>
        </select>
      </div>
    </div>

    <div
      ref="fileUploadArea"
      class="rounded-xl border-2 border-dashed bg-white p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition"
      :class="dragging ? 'border-emerald-500 bg-emerald-50/40' : 'border-slate-300 hover:border-slate-400'"
      @click="requestUploadFile"
    >
      <input ref="fileUploadInput" type="file" class="hidden" multiple @change="onInputChange" />
      <span class="i-mdi-cloud-upload-outline w-12 h-12 text-slate-400"></span>
      <p class="text-sm text-slate-600 text-center">{{ $t('common.drop_hint') }}</p>
    </div>

    <div v-if="uploadedFiles.length > 0" class="mt-6 flex flex-col gap-3">
      <div
        v-for="(file, idx) in uploadedFiles"
        :key="`${file.name}-${idx}`"
        class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
      >
        <div class="flex items-center gap-3">
          <span class="w-7 h-7 shrink-0 i-mdi-file-document-outline text-slate-500"></span>
          <div class="flex flex-col min-w-0 flex-1">
            <a
              class="text-sm font-semibold text-slate-900 truncate hover:text-emerald-600 hover:underline"
              :href="`/${encodeKeyPath(file.name)}`"
              target="_blank"
            >
              {{ file.name }}
            </a>
            <div class="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>{{ formatBytes(file.size) }}</span>
              <span>·</span>
              <span>{{ file.visibility === 'public' ? $t('common.public') : $t('common.private') }}</span>
              <span v-if="!file.done && !file.failed">· {{ file.progress }}%</span>
              <span v-if="file.failed" class="text-red-500">· {{ $t('common.upload_failed') }}</span>
            </div>
          </div>
          <button
            v-if="file.done"
            class="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
            @click="onCopyLink(file.name)"
          >
            <span class="i-mdi-content-copy w-3.5 h-3.5"></span>
            <span>{{ $t('common.copy_link') }}</span>
          </button>
          <span
            class="w-5 h-5 shrink-0"
            :class="file.failed ? 'i-mdi-alert-circle text-red-500' : file.done ? 'i-mdi-check-circle text-emerald-600' : 'i-mdi-loading animate-spin text-slate-400'"
          ></span>
        </div>
        <div v-if="!file.done && !file.failed" class="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div class="h-full bg-emerald-500 transition-all duration-150" :style="{ width: `${file.progress}%` }"></div>
        </div>
      </div>
    </div>
  </div>
</template>
