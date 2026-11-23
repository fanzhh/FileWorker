<script setup lang="ts">
import { ref } from 'vue';
import Cookies from 'js-cookie';
import { toast } from '@/utils/toast';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { VerifyAuth } from '@/api';

const router = useRouter();
const { t: $t } = useI18n();

const password = ref('');
const loading = ref(false);

const onSubmitBtnClick = async () => {
    if (!password.value || loading.value) {
        return;
    }
    loading.value = true;
    const cookieOpts: Cookies.CookieAttributes = {
        sameSite: 'Lax',
        secure: window.location.protocol === 'https:',
        path: '/',
    };
    Cookies.set('PASSWORD', password.value, cookieOpts);
    try {
        await VerifyAuth();
        toast($t("login.setting_success"), 'success');
        setTimeout(() => {
            if (window.history.state.back) {
                router.back();
            } else {
                router.replace({ path: '/' });
            }
        }, 300);
    } catch {
        Cookies.remove('PASSWORD', { path: '/' });
        toast($t("login.invalid_password"), 'error');
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="min-h-screen flex items-center justify-center px-4">
        <div class="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-sm p-8 flex flex-col items-center">
            <div class="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3">
                <span class="i-mdi-cloud-outline w-6 h-6 text-emerald-600"></span>
            </div>
            <h1 class="text-lg font-semibold text-slate-900">{{ $t("login.login_title") }}</h1>
            <input
                class="mt-6 mb-4 px-3.5 py-2 w-full border border-slate-300 rounded-lg text-sm outline-none focus:border-emerald-500"
                type="password"
                v-model="password"
                :placeholder="$t('login.password_placeholder')"
                @keyup.enter="onSubmitBtnClick"
            />
            <button
                id="submit-button"
                class="w-full rounded-lg cursor-pointer outline-none bg-emerald-600 text-white text-sm font-medium py-2.5 transition hover:bg-emerald-700 disabled:opacity-50"
                :disabled="loading"
                @click="onSubmitBtnClick"
            >
                {{ loading ? $t("common.loading") : $t("login.login_button") }}
            </button>
        </div>
    </div>
</template>
