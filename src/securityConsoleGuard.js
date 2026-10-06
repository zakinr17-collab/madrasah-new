// Prevent sensitive authentication material from being exposed in browser developer logs.
// This module must be imported before the rest of the application modules.
(() => {
    const sensitiveKey = /^(token|accessToken|refreshToken|authToken|jwt|password|adminPass|authorization|x-auth-token|privateKey|licensePrivateKey|LICENSE_PRIVATE_KEY|secret)$/i;
    const jwtPattern = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
    const bearerPattern = /Bearer\s+[A-Za-z0-9._~-]+/gi;
    const privateKeyPattern = /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA )?PRIVATE KEY-----/g;

    function redactString(value) {
        return String(value)
            .replace(privateKeyPattern, '[REDACTED PRIVATE KEY]')
            .replace(jwtPattern, '[REDACTED JWT]')
            .replace(bearerPattern, 'Bearer [REDACTED]');
    }

    function sanitize(value, seen = new WeakSet(), depth = 0) {
        if (typeof value === 'string') return redactString(value);
        if (value === null || typeof value !== 'object') return value;
        if (depth > 6) return '[REDACTED DEPTH]';
        if (seen.has(value)) return '[Circular]';

        if (value instanceof Error) {
            return {
                name: value.name,
                message: redactString(value.message || ''),
                stack: redactString(value.stack || '')
            };
        }

        const isArray = Array.isArray(value);
        const proto = Object.getPrototypeOf(value);
        const isPlainObject = proto === Object.prototype || proto === null;
        if (!isArray && !isPlainObject) return value;

        seen.add(value);
        if (isArray) {
            const output = value.map(item => sanitize(item, seen, depth + 1));
            seen.delete(value);
            return output;
        }

        const output = {};
        for (const [key, item] of Object.entries(value)) {
            output[key] = sensitiveKey.test(key) ? '[REDACTED]' : sanitize(item, seen, depth + 1);
        }
        seen.delete(value);
        return output;
    }

    for (const method of ['log', 'info', 'debug', 'warn', 'error']) {
        const original = console[method];
        if (typeof original !== 'function') continue;

        console[method] = function (...args) {
            // Legacy login debug printed the complete JWT response. Suppress it completely.
            if (args[0] === 'Login response:') return;
            return original.apply(console, args.map(arg => sanitize(arg)));
        };
    }
})();
