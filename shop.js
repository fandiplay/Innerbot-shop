'use strict';

// Standalone shop: does not start WhatsApp or access auth_session.
const { startShopServer } = require('./src/shop/server');
try {
    require('./src/utils/env').loadEnv();
    const server = startShopServer();
    if (server) {
        server.on('error', () => { process.exitCode = 1; });
        const stop = () => {
            server.close(() => process.exit(0));
            server.closeIdleConnections?.();
            setTimeout(() => process.exit(0), 3000).unref();
        };
        process.once('SIGINT', stop);
        process.once('SIGTERM', stop);
    }
} catch (error) {
    console.error(`[SHOP] ${error.message}`);
    process.exitCode = 1;
}
