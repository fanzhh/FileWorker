import Env from "../utils/Env";

export const onRequestGet: PagesFunction<Env> = async () => {
    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
            "content-type": "application/json;charset=utf-8",
            "cache-control": "no-store",
        },
    });
};
