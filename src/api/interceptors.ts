import axios, { AxiosError } from 'axios';
import router from '@/router';
import { toast } from '@/utils/toast';

const initInterceptors = () => {
    axios.interceptors.response.use(
        async (response) => {
            return response;
        },
        async (error: AxiosError) => {
            const status = error.response?.status;
            if (status === 401) {
                if (router.currentRoute.value.path !== '/login') {
                    toast("Unauthorized", "error");
                    await router.push('/login');
                }
            } else {
                toast(error.message || "Error", "error");
            }
            return Promise.reject(error);
        });
}

export { initInterceptors };
