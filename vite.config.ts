import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 3004, // You can change this to your preferred port
        open: true, // Automatically open browser on server start
        strictPort: false, // Set to true if you want to fail if port is already in use
    },
});