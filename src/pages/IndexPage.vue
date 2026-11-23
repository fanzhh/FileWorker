<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();

const cards = [
  {
    to: "/file",
    titleKey: "index.file_channel_title",
    descKey: "index.file_channel_desc",
    icon: "i-mdi-cloud-upload-outline",
    accent: "bg-sky-50 text-sky-600 border-sky-200",
  },
  {
    to: "/clip",
    titleKey: "index.clip_channel_title",
    descKey: "index.clip_channel_desc",
    icon: "i-mdi-clipboard-text-outline",
    accent: "bg-rose-50 text-rose-600 border-rose-200",
  },
  {
    to: "/filemanage",
    titleKey: "index.manage_channel_title",
    descKey: "index.manage_channel_desc",
    icon: "i-mdi-folder-outline",
    accent: "bg-emerald-50 text-emerald-600 border-emerald-200",
  },
];
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-10">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div
        v-for="card in cards"
        :key="card.to"
        class="group bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition cursor-pointer flex flex-col gap-4"
        @click="router.push(card.to)"
      >
        <div class="w-12 h-12 rounded-xl border flex items-center justify-center" :class="card.accent">
          <span :class="card.icon" class="w-6 h-6"></span>
        </div>
        <div>
          <h2 class="text-lg font-semibold text-slate-900 group-hover:text-emerald-600 transition">
            {{ $t(card.titleKey) }}
          </h2>
          <p class="text-sm text-slate-500 mt-1.5 leading-relaxed">
            {{ $t(card.descKey) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
