<script setup lang="ts">
import { onMounted, onUnmounted, ref, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import useFileStore from '@/store/file';
import { copyToClipboard, formatBytes } from '@/utils/utils';
import { toast } from '@/utils/toast';
import { PutFile, encodeKeyPath } from '@/api';

const { t: $t } = useI18n();
const fileStore = useFileStore();

let fileUploadInput = ref<HTMLInputElement>();

let requestUploadFile = () => {
  fileUploadInput.value?.click();
}

interface UploadedFile {
  name: string;
  size: number;
  visibility: string;
  progress: number;
  done: boolean;
  failed: boolean;
}

let uploadedFiles: Ref<UploadedFile[]> = ref([]);

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
}

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
    uploadedFiles.value.push(item);
    void uploadSingle(uploadedFiles.value[uploadedFiles.value.length - 1], file);
  }
}

const onInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  enqueueFiles(target.files);
  target.value = '';
}

const onCopyLink = async (name: string) => {
  const url = `${window.location.origin}/${encodeKeyPath(name)}`;
  if (await copyToClipboard(url)) {
    toast($t('common.copied'), 'success');
  }
}

let fileUploadArea = ref<HTMLElement>();

const onDragEvent = (event: DragEvent) => {
  event.preventDefault();
  event.stopPropagation();
  if (fileUploadArea.value) {
    fileUploadArea.value.style.border = event.type === 'dragover' ? '2px dashed #000' : '2px dashed #e5e7eb';
  }
  if (event.type === 'drop') {
    enqueueFiles(event.dataTransfer?.files);
  }
}

onMounted(() => {
  fileUploadArea.value?.addEventListener('dragenter', onDragEvent);
  fileUploadArea.value?.addEventListener('dragover', onDragEvent);
  fileUploadArea.value?.addEventListener('dragleave', onDragEvent);
  fileUploadArea.value?.addEventListener('drop', onDragEvent);
});
onUnmounted(() => {
  fileUploadArea.value?.removeEventListener('dragenter', onDragEvent);
  fileUploadArea.value?.removeEventListener('dragover', onDragEvent);
  fileUploadArea.value?.removeEventListener('dragleave', onDragEvent);
  fileUploadArea.value?.removeEventListener('drop', onDragEvent);
});
</script>

<template>
  <div class="flex flex-col items-center">
    <nav class="max-w-screen-md w-4/5 flex flex-row gap-4 mt-4 text-sm text-gray-600">
      <router-link to="/" class="hover:underline">{{ $t('page_title.index') }}</router-link>
      <router-link to="/clip" class="hover:underline">{{ $t('page_title.clip') }}</router-link>
      <router-link to="/filemanage" class="hover:underline">{{ $t('page_title.filemanage') }}</router-link>
    </nav>
    <div class="file-area flex flex-col mt-3">
      <div class="files" @click="requestUploadFile" ref="fileUploadArea">
        <input ref="fileUploadInput" type="file" class="hidden" multiple @change="onInputChange" />
      </div>
      <div class="footer p-2">
        <select class="public-select" v-model="fileStore.visibility">
          <option value="private">{{ $t('common.private') }}</option>
          <option value="public">{{ $t('common.public') }}</option>
        </select>
      </div>
    </div>
    <div class="px-4 py-4 max-w-screen-md w-4/5">
      <div v-for="(file, idx) in uploadedFiles" :key="`${file.name}-${idx}`"
        class="w-full flex flex-row items-center mt-4 rounded border-1 border-gray-300 bg-white px-3 py-2 gap-3">
        <div class="w-8 h-8 shrink-0 i-mdi-file-document-outline"></div>
        <div class="flex flex-col min-w-0 flex-1">
          <a class="text-base font-semibold truncate hover:underline" :href="`/${encodeKeyPath(file.name)}`" target="_blank">
            {{ file.name }}
          </a>
          <div class="text-sm text-gray">
            {{ formatBytes(file.size) }} · {{ file.visibility === 'public' ? $t('common.public') : $t('common.private') }}
            <span v-if="!file.done && !file.failed"> · {{ file.progress }}%</span>
            <span v-if="file.failed" class="text-red-500"> · {{ $t('common.upload_failed') }}</span>
          </div>
        </div>
        <button v-if="file.done" class="text-xs px-2 py-1 rounded border-1 border-gray-300 hover:bg-gray-100"
          @click="onCopyLink(file.name)">
          {{ $t('common.copy_link') }}
        </button>
        <div class="w-6 h-6 shrink-0" :class="file.failed ? 'i-mdi-alert-circle text-red-500' : file.done ? 'i-mdi-check text-green-600' : 'uploading'"></div>
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

.file-area {
  --uno: rounded max-w-screen-md w-4/5 border-1 border-gray-300;
  background-color: white;
}

.file-area .footer {
  --uno: flex flex-row;
  background-color: #f5f5f5;
}

.file-area .footer .public-select {
  --uno: border-1 rounded px-6 py-1.5 text-sm;
  border-color: #d1d1d1;
  outline-color: #0969da;
}

.files {
  --uno: h-50 border-dashed border-2 cursor-pointer;
  background: url(../assets/upload.svg) center center no-repeat;
  background-color: white;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.uploading {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #555;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: inline-block;
  animation: spin 1s linear infinite;
}
</style>
