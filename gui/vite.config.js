import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Correctly import the plugin, handling potential default export issues
import VitePluginMonacoEditor from 'vite-plugin-monaco-editor';
const monacoEditorPlugin = (VitePluginMonacoEditor.default || VitePluginMonacoEditor);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    monacoEditorPlugin({}) // Use default options
  ],
})