const axios = require('axios');

// TMDB v3 API 根地址（注意：必须以 /3 结尾，否则会 404）
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// 缓存配置
const CACHE_DURATION = 10 * 60 * 1000; // 10 分钟
const MAX_CACHE_SIZE = 1000;

// 进程级缓存（Vercel 单实例内有效）
const cache = new Map();

function cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (now > value.expiry) cache.delete(key);
    }
}

function trimCacheIfNeeded() {
    if (cache.size <= MAX_CACHE_SIZE) return;
    const entries = [...cache.entries()].sort((a, b) => a[1].expiry - b[1].expiry);
    const removeCount = cache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < removeCount; i++) cache.delete(entries[i][0]);
}

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 预检请求
    if (req.method === 'OPTIONS') return res.status(200).end();

    // 健康检查
    if (req.url === '/' || req.url.startsWith('/?')) {
        return res.status(200).json({ status: 'ok', service: 'tmdb-proxy' });
    }

    try {
        // req.url 形如: "/tmdb/movie/popular?language=zh-CN&page=1"
        // Vercel 在 rewrite 时可能会把 :path* 的值追加为 ?path=...，这里忽略它，直接从 pathname 取
        const u = new URL(req.url, 'http://placeholder.local');
        let pathname = u.pathname;

        // 去掉用户访问时使用的 "/tmdb" 前缀，还原出 TMDB 真实路径
        if (pathname.startsWith('/tmdb')) {
            pathname = pathname.slice(5) || '/';
        }

        const search = u.search; // 已经包含 "?" 前缀或为空字符串
        const tmdbUrl = `${TMDB_BASE_URL}${pathname}${search}`;

        // 缓存键：方法 + 完整 URL（含 query）
        const cacheKey = `${req.method} ${tmdbUrl}`;

        // 命中缓存
        cleanExpiredCache();
        const cached = cache.get(cacheKey);
        if (cached && Date.now() < cached.expiry) {
            res.setHeader('X-Cache', 'HIT');
            return res.status(200).json(cached.data);
        }

        // 构造请求配置
        const config = { timeout: 15000 };
        const authHeader = req.headers.authorization;
        if (authHeader) config.headers = { Authorization: authHeader };

        const response = await axios.get(tmdbUrl, config);

        // 仅缓存成功响应
        if (response.status === 200) {
            trimCacheIfNeeded();
            cache.set(cacheKey, {
                data: response.data,
                expiry: Date.now() + CACHE_DURATION
            });
        }

        res.setHeader('X-Cache', 'MISS');
        return res.status(response.status).json(response.data);
    } catch (error) {
        console.error('TMDB API error:', error.message, 'URL:', error.config?.url);
        return res.status(error.response?.status || 500).json({
            error: error.message,
            details: error.response?.data
        });
    }
};
