<script setup lang="ts">
import { minimalSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightSpecialChars, drawSelection, dropCursor } from "@codemirror/view";

import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import useClipStore from "@/store/clip";

import { PutFile, GetFileText, encodeKeyPath } from "@/api";
import { copyToClipboard, getRandomFilename } from "@/utils/utils";
import { toast } from "@/utils/toast";

const route = useRoute();
const router = useRouter();
const { t: $t } = useI18n();
const clipStore = useClipStore();

const code = ref("");
const modified = ref(false);
const saving = ref(false);
const saved = ref(false);
const loadingDoc = ref(false);
const editorElement = ref();
let editor: EditorView | null = null;

const queryKey = computed(() => (typeof route.query.key === 'string' && route.query.key ? route.query.key : ''));
const filename = ref(queryKey.value || getRandomFilename());

const startState = EditorState.create({
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
});

const setEditorDoc = (text: string) => {
  if (!editor) return;
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: text },
  });
};

const loadByKey = async (key: string) => {
  if (!key) {
    filename.value = getRandomFilename();
    setEditorDoc("");
    modified.value = false;
    saved.value = false;
    return;
  }
  filename.value = key;
  loadingDoc.value = true;
  try {
    const res = await GetFileText(key);
    setEditorDoc(res.content);
    clipStore.setVisibility(res.visibility);
    modified.value = false;
    saved.value = true;
  } catch (err) {
    console.error(err);
  } finally {
    loadingDoc.value = false;
  }
};

onMounted(async () => {
  editor = new EditorView({
    state: startState,
    parent: editorElement.value,
  });
  editor.requestMeasure({
    read: () => {
      editor?.focus();
    }
  });
  if (queryKey.value) {
    await loadByKey(queryKey.value);
  }
});

watch(queryKey, async (newKey) => {
  await loadByKey(newKey);
});

const refreshRandomFileName = () => {
  filename.value = getRandomFilename();
  saved.value = false;
};

const onNewClip = () => {
  if (queryKey.value) {
    router.push('/clip');
  } else {
    void loadByKey('');
  }
};

const onSaveBtnClick = async () => {
  const targetName = filename.value.trim();
  if (!targetName || saving.value) {
    return;
  }
  saving.value = true;
  try {
    await PutFile(targetName, code.value, clipStore.visibility, "text");
    modified.value = false;
    saved.value = true;
    toast($t('common.save_success'), 'success');
  } catch (err) {
    console.error(err);
  } finally {
    saving.value = false;
  }
};

const onCopyLink = async () => {
  const url = `${window.location.origin}/${encodeKeyPath(filename.value.trim())}`;
  if (await copyToClipboard(url)) {
    toast($t('common.copied'), 'success');
  }
};

const saveContentKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey && e.key === "s") || (e.metaKey && e.key === "s")) {
    e.preventDefault();
    void onSaveBtnClick();
  }
};

const onPasteFile = async (e: ClipboardEvent) => {
  if (!editor || !e.clipboardData?.files.length) {
    return;
  }
  const file = e.clipboardData.files[0];
  const text = await file.text();
  const cursor = editor.state.selection.main.head;
  editor.dispatch({
    changes: { from: cursor, insert: text },
  });
};

onMounted(() => {
  window.addEventListener("keydown", saveContentKeydown);
  document.addEventListener("paste", onPasteFile);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", saveContentKeydown);
  document.removeEventListener("paste", onPasteFile);
  editor?.destroy();
});
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-6">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
      <div class="flex items-center gap-2">
        <button
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          @click="router.push('/')"
        >
          <span class="i-mdi-arrow-left w-4 h-4"></span>
          <span>{{ $t('common.back_home') }}</span>
        </button>
        <button
          v-if="queryKey"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          @click="router.push('/filemanage')"
        >
          <span class="i-mdi-folder-outline w-4 h-4"></span>
          <span>{{ $t('common.back_manage') }}</span>
        </button>
      </div>
      <button
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        @click="onNewClip"
      >
        <span class="i-mdi-plus w-4 h-4"></span>
        <span>{{ $t('common.new_clip') }}</span>
      </button>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2">
        <input
          class="monospace border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-sm w-60 max-w-full outline-none focus:border-emerald-500"
          type="text"
          v-model="filename"
          :placeholder="$t('common.filename')"
        />
        <button
          class="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          title="Random filename"
          @click="refreshRandomFileName"
        >
          <span class="i-mdi-refresh w-4 h-4 block"></span>
        </button>
        <span
          class="ml-auto text-xs px-2.5 py-1 rounded-full font-medium"
          :class="loadingDoc
            ? 'bg-slate-100 text-slate-500'
            : modified
              ? 'bg-amber-50 text-amber-700'
              : 'bg-emerald-50 text-emerald-700'"
        >
          {{ loadingDoc ? $t('common.loading') : modified ? $t('common.unsaved') : $t('common.saved') }}
        </span>
      </div>

      <div ref="editorElement"></div>

      <div class="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-2">
        <select
          class="border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
          v-model="clipStore.visibility"
        >
          <option value="private">{{ $t('common.private') }}</option>
          <option value="public">{{ $t('common.public') }}</option>
        </select>

        <button
          v-if="saved"
          class="inline-flex items-center gap-1 border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          @click="onCopyLink"
        >
          <span class="i-mdi-content-copy w-4 h-4"></span>
          <span>{{ $t('common.copy_link') }}</span>
        </button>

        <a
          v-if="saved"
          :href="`/${encodeKeyPath(filename.trim())}`"
          target="_blank"
          class="inline-flex items-center gap-1 border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 transition"
        >
          <span class="i-mdi-open-in-new w-4 h-4"></span>
          <span>{{ $t('common.open_raw') }}</span>
        </a>

        <button
          class="ml-auto inline-flex items-center gap-1.5 rounded-lg px-5 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
          :disabled="saving"
          @click="onSaveBtnClick"
        >
          <span class="i-mdi-content-save-outline w-4 h-4"></span>
          <span>{{ saving ? $t('common.saving') : $t('common.save') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style>
.cm-editor {
  height: 460px;
}

.cm-editor.cm-focused {
  outline: none;
}

.cm-gutter.cm-lineNumbers {
  background-color: #ffffff;
  color: #94a3b8;
}

.cm-gutters {
  border-right: 1px solid #f1f5f9 !important;
}

.cm-selectionBackground {
  background-color: #54aeff66 !important;
}
</style>
