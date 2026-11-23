<script setup lang="ts">
import { minimalSetup } from "codemirror"
import { EditorState } from "@codemirror/state"
import { EditorView, lineNumbers, highlightSpecialChars, drawSelection, dropCursor } from "@codemirror/view"

import { onMounted, onBeforeUnmount, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import useClipStore from "@/store/clip";

import { PutFile, GetFileText, encodeKeyPath } from "@/api";
import { copyToClipboard, getRandomFilename } from "@/utils/utils";
import { toast } from "@/utils/toast";

const route = useRoute();
const { t: $t } = useI18n();

const code = ref("");
const modified = ref(false);
const saving = ref(false);
const saved = ref(false);
const editorElement = ref();
let editor: EditorView;

const initialKey = typeof route.query.key === 'string' && route.query.key ? route.query.key : '';
let filename = ref(initialKey || getRandomFilename());

let startState = EditorState.create({
  doc: "",
  extensions: [
    minimalSetup,
    lineNumbers(),
    highlightSpecialChars(),
    drawSelection(),
    dropCursor(),
    EditorView.updateListener.of((update) => {
      code.value = update.state.doc.toString();
      if (update.docChanged) {
        modified.value = true;
      }
    }),
  ]
})

const clipStore = useClipStore();

onMounted(async () => {
  editor = new EditorView({
    state: startState,
    parent: editorElement.value,
  })
  editor.requestMeasure({
    read: () => {
      editor.focus();
    }
  })

  if (initialKey) {
    try {
      const res = await GetFileText(initialKey);
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: res.content },
      });
      clipStore.setVisibility(res.visibility);
      modified.value = false;
      saved.value = true;
    } catch (err) {
      console.error(err);
    }
  }
})

let refreshRandomFileName = () => {
  filename.value = getRandomFilename();
  saved.value = false;
}

let onSaveBtnClick = async () => {
  if (!filename.value.trim() || saving.value) {
    return;
  }
  saving.value = true;
  try {
    await PutFile(filename.value.trim(), code.value, clipStore.visibility, "text");
    modified.value = false;
    saved.value = true;
    toast($t('common.save_success'), 'success');
  } catch (err) {
    console.error(err);
  } finally {
    saving.value = false;
  }
}

let onCopyLink = async () => {
  const url = `${window.location.origin}/${encodeKeyPath(filename.value.trim())}`;
  if (await copyToClipboard(url)) {
    toast($t('common.copied'), 'success');
  }
}

let saveContentKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey && e.key === "s") || (e.metaKey && e.key === "s")) {
    e.preventDefault();
    onSaveBtnClick();
  }
}

let onPasteFile = async (e: ClipboardEvent) => {
  if (!e.clipboardData?.files.length) {
    return;
  }
  const file = e.clipboardData.files[0];
  const text = await file.text();
  const cursor = editor.state.selection.main.head;
  editor.dispatch({
    changes: { from: cursor, insert: text },
  });
}

onMounted(() => {
  window.addEventListener("keydown", saveContentKeydown);
  document.addEventListener("paste", onPasteFile);
})

onBeforeUnmount(() => {
  window.removeEventListener("keydown", saveContentKeydown);
  document.removeEventListener("paste", onPasteFile);
})
</script>

<template>
  <div class="flex flex-col items-center">
    <nav class="max-w-screen-md w-4/5 flex flex-row gap-4 mt-4 text-sm text-gray-600">
      <router-link to="/" class="hover:underline">{{ $t('page_title.index') }}</router-link>
      <router-link to="/file" class="hover:underline">{{ $t('page_title.file') }}</router-link>
      <router-link to="/filemanage" class="hover:underline">{{ $t('page_title.filemanage') }}</router-link>
    </nav>
    <div class="text-area flex flex-col mt-3">
      <div class="header p-2 flex flex-row items-center">
        <input class="filename-input monospace" type="text" v-model="filename" :placeholder="$t('common.filename')" />
        <button @click="refreshRandomFileName" class="i-mdi-refresh ml-1 w-5 h-5" title="Random filename"></button>
        <div :class="modified ? 'unsave-attention' : 'save-attention'"></div>
      </div>
      <div ref="editorElement"></div>
      <div class="footer p-2 items-center gap-2">
        <select class="public-select" v-model="clipStore.visibility">
          <option value="private">{{ $t('common.private') }}</option>
          <option value="public">{{ $t('common.public') }}</option>
        </select>
        <button v-if="saved" class="copy-btn" @click="onCopyLink">{{ $t('common.copy_link') }}</button>
        <button class="save-btn" :disabled="saving" @click="onSaveBtnClick">
          {{ saving ? $t('common.saving') : $t('common.save') }}
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

.text-area {
  --uno: rounded max-w-screen-md w-4/5 border-1 border-gray-300;
  background-color: white;
}

.text-area .header {
  background-color: #f5f5f5;
}

.text-area .footer {
  --uno: flex flex-row;
  background-color: #f5f5f5;
}

.text-area .footer .public-select {
  --uno: border-1 rounded px-6 py-1.5 text-sm;
  border-color: #d1d1d1;
  outline-color: #0969da;
}

.text-area .footer .copy-btn {
  --uno: border-1 rounded px-4 py-1.5 text-sm bg-white hover:bg-gray-100;
  border-color: #d1d1d1;
}

.text-area .footer .save-btn {
  --uno: rounded px-6 py-1.5 text-sm ml-auto text-white disabled:opacity-50;
  background-color: #1f883d;
}

.text-area .footer .save-btn:hover {
  background-color: #1a7f37;
}

.text-area .header .filename-input {
  --uno: border-1 rounded px-3 py-2 text-sm w-60;
  border-color: #d1d1d1;
  outline-color: #0969da;
}

.cm-editor {
  height: 400px;
  border-top: 1px solid #ddd;
  border-bottom: 1px solid #ddd;
}

.cm-editor.cm-focused {
  outline: none;
}

.cm-gutter.cm-lineNumbers {
  background-color: white;
}

.cm-gutters {
  border: none !important;
}

.cm-selectionBackground {
  background-color: #54aeff66 !important;
}

.unsave-attention {
  --uno: i-mdi-circle-small w-8 h-8 ml-auto;
  color: #9a6700 !important;
}

.save-attention {
  --uno: i-mdi-circle-small w-8 h-8 ml-auto;
  color: #1f883d !important;
}
</style>
