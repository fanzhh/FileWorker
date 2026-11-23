<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Cookies from 'js-cookie';
import useI18nStore from '@/store/i18n';

const route = useRoute();
const router = useRouter();
const { locale } = useI18n();
const i18nStore = useI18nStore();

onMounted(() => {
  if (i18nStore.locale) {
    locale.value = i18nStore.locale;
  }
});

const showNavbar = computed(() => route.path !== '/login');

const navItems = [
  { path: '/', labelKey: 'page_title.index', icon: 'i-mdi-home-outline' },
  { path: '/file', labelKey: 'page_title.file', icon: 'i-mdi-cloud-upload-outline' },
  { path: '/clip', labelKey: 'page_title.clip', icon: 'i-mdi-clipboard-text-outline' },
  { path: '/filemanage', labelKey: 'page_title.filemanage', icon: 'i-mdi-folder-outline' },
];

const isActive = (path: string) => {
  if (path === '/') return route.path === '/';
  return route.path.startsWith(path);
};

const toggleLocale = () => {
  const next = locale.value === 'zh' ? 'en' : 'zh';
  locale.value = next;
  i18nStore.setLocale(next);
};

const onLogout = () => {
  Cookies.remove('PASSWORD', { path: '/' });
  router.replace('/login');
};
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50 text-slate-800">
    <header v-if="showNavbar" class="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
      <div class="max-w-4xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <router-link to="/" class="flex items-center gap-2 font-semibold text-slate-900 hover:text-emerald-600 transition">
          <span class="i-mdi-cloud-outline w-6 h-6 text-emerald-600"></span>
          <span class="text-base tracking-tight">FileWorker</span>
        </router-link>

        <nav class="flex items-center gap-1 flex-wrap">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition"
            :class="isActive(item.path)
              ? 'bg-emerald-50 text-emerald-700'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
          >
            <span :class="item.icon" class="w-4 h-4"></span>
            <span>{{ $t(item.labelKey) }}</span>
          </router-link>
        </nav>

        <div class="flex items-center gap-2">
          <button
            class="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            @click="toggleLocale"
          >
            {{ locale === 'zh' ? 'EN' : '中文' }}
          </button>
          <button
            class="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
            :title="$t('common.logout')"
            @click="onLogout"
          >
            <span class="i-mdi-logout w-4 h-4"></span>
            <span class="hidden sm:inline">{{ $t('common.logout') }}</span>
          </button>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>
  </div>
</template>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  min-height: 100%;
  background-color: #f8fafc;
}
</style>
