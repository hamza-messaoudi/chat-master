/**
 * Build script for the chat widget
 * 
 * This file is used to build a bundled version of the chat widget
 * that can be included directly in partner websites.
 */

import { build } from 'esbuild';
import { resolve } from 'path';
import fs from 'fs';

async function bundleWidget() {
  try {
    const outdir = resolve('dist');
    
    // Create the dist directory if it doesn't exist
    if (!fs.existsSync(outdir)) {
      fs.mkdirSync(outdir, { recursive: true });
    }
    
    const result = await build({
      entryPoints: [resolve('client/src/widget/chatWidget.js')],
      bundle: true,
      minify: true,
      format: 'iife',
      globalName: 'ChatWidget',
      outfile: resolve('dist/chat-widget.min.js'),
      platform: 'browser',
      target: ['es2020', 'chrome58', 'firefox57', 'safari11'],
    });
    
    console.log('Chat widget bundled successfully!');
    console.log(`Output: ${resolve('dist/chat-widget.min.js')}`);
    
    // Generate the integration code example
    const integrationCode = `
<!-- Customer Support Chat Widget Integration -->
<script src="https://your-domain.com/chat-widget.min.js"></script>
<script>
  // Initialize the chat widget with your API key
  window.addEventListener('DOMContentLoaded', function() {
    ChatWidget.init({
      apiKey: 'YOUR_API_KEY',
      // Optional: Specify a custom URL if your API is hosted elsewhere
      // baseUrl: 'https://api.your-domain.com',
      // Optional: Provide a customer ID if you want to link chats to your customer records
      // customerId: 'customer-123456'
    });
  });
</script>
`;
    
    // Save the integration example
    fs.writeFileSync(resolve('dist/integration-example.html'), integrationCode.trim());
    console.log(`Integration example saved to: ${resolve('dist/integration-example.html')}`);
    
  } catch (error) {
    console.error('Failed to build chat widget:', error);
    process.exit(1);
  }
}

bundleWidget();