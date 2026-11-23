import { createRouter, createWebHashHistory } from "vue-router";
import Cookies from 'js-cookie'
import i18n from "./i18n";

const $t = i18n.global.t;

const routes = [
    {
        path: "/",
        name: "index",
        meta: {
            title: $t("page_title.index"),
        },
        component: () => import("./pages/IndexPage.vue"),
    },
    {
        path: "/clip",
        name: "clip",
        meta: {
            title: $t("page_title.clip"),
        },
        component: () => import("./pages/ClipPage.vue"),
    },
    {
        path: "/file",
        name: "file",
        meta: {
            title: $t("page_title.file"),
        },
        component: () => import("./pages/FilePage.vue"),
    },
    {
        path: "/filemanage",
        name: "filemanage",
        meta: {
            title: $t("page_title.filemanage"),
        },
        component: () => import("./pages/FileManagePage.vue"),
    },
    {
        path: "/login",
        name: "login",
        meta: {
            title: $t("page_title.login"),
        },
        component: () => import("./pages/LoginPage.vue"),
    },
];

const router = createRouter({
    history: createWebHashHistory(),
    routes,
});

router.beforeEach((to, from, next) => {
    if (to.meta.title) {
        document.title = to.meta.title as string;
    }
    const PASSWORD = Cookies.get('PASSWORD');
    if (!PASSWORD && to.path !== '/login') {
        next({
            path: '/login',
        })
    } else {
        next()
    }
})

export default router;
export { routes };
