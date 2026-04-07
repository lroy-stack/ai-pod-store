#!/usr/bin/env node

/**
 * POD AI Setup Wizard
 * Zero-dependency Node.js setup tool for the POD Platform
 * Uses only Node.js built-in modules - no external dependencies required
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 4321;
const PROJECT_ROOT = path.resolve(__dirname, '..');

// In-memory state storage
let setupState = {
  prerequisites: {},
  essentialServices: {},
  aiServices: {},
  optionalServices: {},
  envFiles: null
};

// Utility to execute shell commands
function execCommand(command, args = []) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { shell: true });
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code
      });
    });

    proc.on('error', () => {
      resolve({
        success: false,
        stdout: '',
        stderr: 'Command not found',
        code: 127
      });
    });
  });
}

// Check if port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = http.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(true);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
}

// API: Prerequisites check
async function handlePrerequisitesCheck() {
  const checks = {};

  // Check Docker
  const docker = await execCommand('docker', ['info']);
  checks.docker = docker.success;

  // Check Docker Compose
  const compose = await execCommand('docker', ['compose', 'version']);
  checks.dockerCompose = compose.success;

  // Check Node.js version
  const node = await execCommand('node', ['--version']);
  if (node.success) {
    const version = node.stdout.replace('v', '');
    const major = parseInt(version.split('.')[0]);
    checks.nodejs = major >= 20;
    checks.nodejsVersion = version;
  } else {
    checks.nodejs = false;
  }

  // Check Git
  const git = await execCommand('git', ['--version']);
  checks.git = git.success;
  if (git.success) {
    checks.gitVersion = git.stdout.replace('git version ', '');
  }

  // Check ports
  const ports = [3000, 3001, 6379, 8090, 8000, 8080];
  checks.ports = {};
  for (const port of ports) {
    checks.ports[port] = await isPortAvailable(port);
  }

  setupState.prerequisites = checks;
  return checks;
}

// API: Generate .env files
async function handleGenerateEnv(services) {
  const frontendEnv = [];
  const adminEnv = [];

  // Essential Services
  if (services.essentialServices) {
    const { supabaseUrl, supabaseAnonKey, supabaseServiceKey, stripeSecretKey, stripePublishableKey, stripeWebhookSecret, printifyToken, printifyShopId } = services.essentialServices;

    // Frontend .env
    frontendEnv.push('# Supabase');
    frontendEnv.push(`NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl || ''}`);
    frontendEnv.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey || ''}`);
    frontendEnv.push(`SUPABASE_SERVICE_KEY=${supabaseServiceKey || ''}`);
    frontendEnv.push('');
    frontendEnv.push('# Stripe');
    frontendEnv.push(`STRIPE_SECRET_KEY=${stripeSecretKey || ''}`);
    frontendEnv.push(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${stripePublishableKey || ''}`);
    frontendEnv.push(`STRIPE_WEBHOOK_SECRET=${stripeWebhookSecret || ''}`);
    frontendEnv.push('');
    frontendEnv.push('# Printify');
    frontendEnv.push(`PRINTIFY_API_TOKEN=${printifyToken || ''}`);
    frontendEnv.push(`PRINTIFY_SHOP_ID=${printifyShopId || ''}`);
    frontendEnv.push('');

    // Admin .env
    adminEnv.push('# Supabase');
    adminEnv.push(`NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl || ''}`);
    adminEnv.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey || ''}`);
    adminEnv.push(`SUPABASE_SERVICE_KEY=${supabaseServiceKey || ''}`);
    adminEnv.push('');
    adminEnv.push('# Stripe');
    adminEnv.push(`STRIPE_SECRET_KEY=${stripeSecretKey || ''}`);
    adminEnv.push('');
  }

  // AI Services
  if (services.aiServices) {
    const { anthropicKey, falKey, geminiKey } = services.aiServices;

    frontendEnv.push('# AI Services');
    if (anthropicKey) frontendEnv.push(`ANTHROPIC_API_KEY=${anthropicKey}`);
    if (falKey) frontendEnv.push(`FAL_KEY=${falKey}`);
    if (geminiKey) frontendEnv.push(`GOOGLE_GEMINI_KEY=${geminiKey}`);
    frontendEnv.push('');
  }

  // Optional Services
  if (services.optionalServices) {
    const { resendKey, resendFrom, crawl4aiUrl, telegramToken, telegramSecret, whatsappPhoneId, whatsappToken, whatsappVerify } = services.optionalServices;

    frontendEnv.push('# Optional Services');
    if (resendKey) {
      frontendEnv.push(`RESEND_API_KEY=${resendKey}`);
      frontendEnv.push(`RESEND_FROM_EMAIL=${resendFrom || 'noreply@example.com'}`);
    }
    if (crawl4aiUrl) frontendEnv.push(`CRAWL4AI_URL=${crawl4aiUrl}`);
    if (telegramToken) {
      frontendEnv.push(`TELEGRAM_BOT_TOKEN=${telegramToken}`);
      frontendEnv.push(`TELEGRAM_WEBHOOK_SECRET=${telegramSecret || ''}`);
    }
    if (whatsappPhoneId) {
      frontendEnv.push(`WHATSAPP_PHONE_NUMBER_ID=${whatsappPhoneId}`);
      frontendEnv.push(`WHATSAPP_ACCESS_TOKEN=${whatsappToken || ''}`);
      frontendEnv.push(`WHATSAPP_VERIFY_TOKEN=${whatsappVerify || ''}`);
    }
    frontendEnv.push('');
  }

  // Add common variables
  frontendEnv.push('# App Configuration');
  frontendEnv.push('NEXT_PUBLIC_APP_URL=http://localhost:3000');
  frontendEnv.push('NODE_ENV=development');
  frontendEnv.push('');
  frontendEnv.push('# Redis (optional)');
  frontendEnv.push('REDIS_URL=redis://localhost:6379');

  adminEnv.push('# App Configuration');
  adminEnv.push('NEXT_PUBLIC_APP_URL=http://localhost:3001');
  adminEnv.push('NODE_ENV=development');

  const envContent = {
    frontend: frontendEnv.join('\n'),
    admin: adminEnv.join('\n')
  };

  setupState.envFiles = envContent;
  return envContent;
}

// API: Write .env files to disk
async function handleWriteEnvFiles() {
  if (!setupState.envFiles) {
    throw new Error('No env files generated yet');
  }

  const frontendPath = path.join(PROJECT_ROOT, 'frontend', '.env.local');
  const adminPath = path.join(PROJECT_ROOT, 'admin', '.env.local');

  // Write frontend .env
  fs.writeFileSync(frontendPath, setupState.envFiles.frontend, 'utf8');

  // Write admin .env
  fs.writeFileSync(adminPath, setupState.envFiles.admin, 'utf8');

  return {
    success: true,
    paths: {
      frontend: frontendPath,
      admin: adminPath
    }
  };
}

// API: Deploy with Docker Compose
async function handleDeploy() {
  const deployPath = path.join(PROJECT_ROOT, 'deploy');
  const composeFile = path.join(deployPath, 'docker-compose.yml');
  const composeLocal = path.join(deployPath, 'docker-compose.local.yml');

  const result = await execCommand('docker', [
    'compose',
    '-f', composeFile,
    '-f', composeLocal,
    'up', '-d', '--build'
  ]);

  return {
    success: result.success,
    output: result.stdout,
    error: result.stderr
  };
}

// API: Get deployment status
async function handleDeployStatus() {
  const result = await execCommand('docker', ['compose', 'ps', '--format', 'json']);

  if (!result.success) {
    return { services: [] };
  }

  try {
    const services = result.stdout.split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    return { services };
  } catch (e) {
    return { services: [] };
  }
}

// API: Stop a service
async function handleServiceStop(serviceName) {
  const result = await execCommand('docker', ['compose', 'stop', serviceName]);
  return {
    success: result.success,
    message: result.success ? `Service ${serviceName} stopped` : `Failed to stop ${serviceName}`,
    output: result.stdout || result.stderr
  };
}

// API: Restart a service
async function handleServiceRestart(serviceName) {
  const result = await execCommand('docker', ['compose', 'restart', serviceName]);
  return {
    success: result.success,
    message: result.success ? `Service ${serviceName} restarted` : `Failed to restart ${serviceName}`,
    output: result.stdout || result.stderr
  };
}

// API: Stream deployment logs via SSE
function handleDeployStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const deployPath = path.join(PROJECT_ROOT, 'deploy');
  const composeFile = path.join(deployPath, 'docker-compose.yml');
  const composeLocal = path.join(deployPath, 'docker-compose.local.yml');

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent({ type: 'start', message: 'Starting Docker Compose deployment...' });

  const proc = spawn('docker', [
    'compose',
    '-f', composeFile,
    '-f', composeLocal,
    'up', '-d', '--build'
  ], { cwd: deployPath });

  proc.stdout?.on('data', (data) => {
    const message = data.toString();
    sendEvent({ type: 'stdout', message });
  });

  proc.stderr?.on('data', (data) => {
    const message = data.toString();
    sendEvent({ type: 'stderr', message });
  });

  proc.on('close', (code) => {
    if (code === 0) {
      sendEvent({ type: 'complete', message: 'Deployment complete!', code });
    } else {
      sendEvent({ type: 'error', message: `Deployment failed with code ${code}`, code });
    }
    res.end();
  });

  proc.on('error', (err) => {
    sendEvent({ type: 'error', message: `Error: ${err.message}` });
    res.end();
  });

  req.on('close', () => {
    proc.kill();
  });
}

// HTML template
function getHTMLTemplate() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>POD AI Setup Wizard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    [x-cloak] { display: none !important; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div x-data="setupWizard()" x-init="init()" class="max-w-4xl mx-auto py-8 px-4">
    <!-- Header -->
    <div class="mb-8 text-center">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">POD AI Setup</h1>
      <p class="text-gray-600">Configure your Print-on-Demand AI store in 6 easy steps</p>
    </div>

    <!-- Progress Steps -->
    <div class="mb-8">
      <div class="flex justify-between items-center">
        <template x-for="(step, index) in steps" :key="index">
          <div class="flex flex-col items-center flex-1">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors"
              :class="currentStep > index ? 'bg-green-500 text-white' : currentStep === index ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'"
            >
              <span x-text="index + 1"></span>
            </div>
            <span class="text-xs mt-2 text-gray-600 hidden sm:block" x-text="step.name"></span>
          </div>
        </template>
      </div>
    </div>

    <!-- Step Content -->
    <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
      <!-- Step 1: Prerequisites -->
      <div x-show="currentStep === 0" x-cloak>
        <h2 class="text-2xl font-bold mb-4">Prerequisites Check</h2>
        <p class="text-gray-600 mb-6">Checking your system for required software...</p>

        <div class="space-y-4">
          <div class="flex items-center justify-between p-4 border rounded-lg">
            <div class="flex items-center space-x-3">
              <i data-lucide="box" class="w-5 h-5"></i>
              <span class="font-medium">Docker Desktop</span>
            </div>
            <span
              class="px-3 py-1 rounded-full text-sm"
              :class="prerequisites.docker ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
              x-text="prerequisites.docker ? '✓ Installed' : '✗ Not Found'"
            ></span>
          </div>

          <div class="flex items-center justify-between p-4 border rounded-lg">
            <div class="flex items-center space-x-3">
              <i data-lucide="layers" class="w-5 h-5"></i>
              <span class="font-medium">Docker Compose v2</span>
            </div>
            <span
              class="px-3 py-1 rounded-full text-sm"
              :class="prerequisites.dockerCompose ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
              x-text="prerequisites.dockerCompose ? '✓ Installed' : '✗ Not Found'"
            ></span>
          </div>

          <div class="flex items-center justify-between p-4 border rounded-lg">
            <div class="flex items-center space-x-3">
              <i data-lucide="cpu" class="w-5 h-5"></i>
              <span class="font-medium">Node.js >= 20</span>
            </div>
            <span
              class="px-3 py-1 rounded-full text-sm"
              :class="prerequisites.nodejs ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
              x-text="prerequisites.nodejs ? '✓ v' + prerequisites.nodejsVersion : '✗ Not Found'"
            ></span>
          </div>

          <div class="flex items-center justify-between p-4 border rounded-lg">
            <div class="flex items-center space-x-3">
              <i data-lucide="git-branch" class="w-5 h-5"></i>
              <span class="font-medium">Git</span>
            </div>
            <span
              class="px-3 py-1 rounded-full text-sm"
              :class="prerequisites.git ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
              x-text="prerequisites.git ? '✓ Installed' : '✗ Not Found'"
            ></span>
          </div>

          <div class="mt-6">
            <h3 class="font-medium mb-3">Required Ports Available</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <template x-for="port in [3000, 3001, 6379, 8090, 8000, 8080]" :key="port">
                <div class="p-3 border rounded-lg text-center">
                  <div class="text-sm font-medium" x-text="'Port ' + port"></div>
                  <div
                    class="text-xs mt-1"
                    :class="prerequisites.ports?.[port] ? 'text-green-600' : 'text-red-600'"
                    x-text="prerequisites.ports?.[port] ? 'Available' : 'In Use'"
                  ></div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <button
          @click="checkPrerequisites()"
          class="mt-6 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Re-check
        </button>
      </div>

      <!-- Step 2: Essential Services -->
      <div x-show="currentStep === 1" x-cloak>
        <h2 class="text-2xl font-bold mb-4">Essential Services</h2>
        <p class="text-gray-600 mb-6">Enter your API credentials for required services</p>

        <div class="space-y-6">
          <!-- Supabase -->
          <div>
            <h3 class="font-semibold text-lg mb-3 flex items-center">
              <i data-lucide="database" class="w-5 h-5 mr-2"></i>
              Supabase
            </h3>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium mb-1">Project URL</label>
                <input
                  type="url"
                  x-model="formData.essentialServices.supabaseUrl"
                  placeholder="https://xxxxx.supabase.co"
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Anon Key</label>
                <input
                  type="password"
                  x-model="formData.essentialServices.supabaseAnonKey"
                  placeholder="eyJ..."
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Service Role Key</label>
                <input
                  type="password"
                  x-model="formData.essentialServices.supabaseServiceKey"
                  placeholder="eyJ..."
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          <!-- Stripe -->
          <div>
            <h3 class="font-semibold text-lg mb-3 flex items-center">
              <i data-lucide="credit-card" class="w-5 h-5 mr-2"></i>
              Stripe
            </h3>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium mb-1">Secret Key</label>
                <input
                  type="password"
                  x-model="formData.essentialServices.stripeSecretKey"
                  placeholder="sk_test_..."
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Publishable Key</label>
                <input
                  type="text"
                  x-model="formData.essentialServices.stripePublishableKey"
                  placeholder="pk_test_..."
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Webhook Secret</label>
                <input
                  type="password"
                  x-model="formData.essentialServices.stripeWebhookSecret"
                  placeholder="whsec_..."
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          <!-- Printify -->
          <div>
            <h3 class="font-semibold text-lg mb-3 flex items-center">
              <i data-lucide="printer" class="w-5 h-5 mr-2"></i>
              Printify
            </h3>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium mb-1">API Token</label>
                <input
                  type="password"
                  x-model="formData.essentialServices.printifyToken"
                  placeholder="eyJ..."
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Shop ID</label>
                <input
                  type="text"
                  x-model="formData.essentialServices.printifyShopId"
                  placeholder="1234567"
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3: AI Services -->
      <div x-show="currentStep === 2" x-cloak>
        <h2 class="text-2xl font-bold mb-4">AI Services</h2>
        <p class="text-gray-600 mb-6">Optional AI integrations for enhanced features</p>

        <div class="space-y-6">
          <div>
            <label class="block text-sm font-medium mb-1">Anthropic API Key (for PodClaw agent) <span class="text-gray-400 text-xs">(optional)</span></label>
            <input
              type="password"
              x-model="formData.aiServices.anthropicKey"
              placeholder="sk-ant-api..."
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              :class="formData.aiServices.anthropicKey && !validateAnthropicKey(formData.aiServices.anthropicKey) ? 'border-yellow-500' : ''"
            />
            <p
              x-show="formData.aiServices.anthropicKey && !validateAnthropicKey(formData.aiServices.anthropicKey)"
              class="text-yellow-600 text-sm mt-1"
            >
              ⚠️ Key should start with 'sk-ant-api'
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">fal.ai Key (for design generation) <span class="text-gray-400 text-xs">(optional)</span></label>
            <input
              type="password"
              x-model="formData.aiServices.falKey"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              :class="formData.aiServices.falKey && !validateFalKey(formData.aiServices.falKey) ? 'border-yellow-500' : ''"
            />
            <p
              x-show="formData.aiServices.falKey && !validateFalKey(formData.aiServices.falKey)"
              class="text-yellow-600 text-sm mt-1"
            >
              ⚠️ Key should be in UUID format
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Google Gemini Key (for RAG embeddings) <span class="text-gray-400 text-xs">(optional)</span></label>
            <input
              type="password"
              x-model="formData.aiServices.geminiKey"
              placeholder="AIza..."
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              :class="formData.aiServices.geminiKey && !validateGeminiKey(formData.aiServices.geminiKey) ? 'border-yellow-500' : ''"
            />
            <p
              x-show="formData.aiServices.geminiKey && !validateGeminiKey(formData.aiServices.geminiKey)"
              class="text-yellow-600 text-sm mt-1"
            >
              ⚠️ Key should start with 'AIza'
            </p>
          </div>
        </div>
      </div>

      <!-- Step 4: Optional Services -->
      <div x-show="currentStep === 3" x-cloak>
        <h2 class="text-2xl font-bold mb-4">Optional Services</h2>
        <p class="text-gray-600 mb-6">Additional integrations you can enable</p>

        <div class="space-y-6">
          <!-- Resend -->
          <div class="border rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold">Resend (Email)</h3>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" x-model="formData.optionalServices.enableResend" class="sr-only peer">
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div x-show="formData.optionalServices.enableResend" class="space-y-3">
              <input
                type="password"
                x-model="formData.optionalServices.resendKey"
                placeholder="API Key (re_...)"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="email"
                x-model="formData.optionalServices.resendFrom"
                placeholder="From Email"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <!-- Crawl4AI -->
          <div class="border rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold">Crawl4AI (Web Crawler)</h3>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" x-model="formData.optionalServices.enableCrawl4ai" class="sr-only peer">
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div x-show="formData.optionalServices.enableCrawl4ai">
              <input
                type="text"
                x-model="formData.optionalServices.crawl4aiUrl"
                placeholder="Service URL (default: http://crawl4ai:11235)"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <!-- Telegram -->
          <div class="border rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold">Telegram Bot</h3>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" x-model="formData.optionalServices.enableTelegram" class="sr-only peer">
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div x-show="formData.optionalServices.enableTelegram" class="space-y-3">
              <input
                type="password"
                x-model="formData.optionalServices.telegramToken"
                placeholder="Bot Token"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="password"
                x-model="formData.optionalServices.telegramSecret"
                placeholder="Webhook Secret (optional)"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <!-- WhatsApp -->
          <div class="border rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold">WhatsApp Business</h3>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" x-model="formData.optionalServices.enableWhatsapp" class="sr-only peer">
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div x-show="formData.optionalServices.enableWhatsapp" class="space-y-3">
              <input
                type="text"
                x-model="formData.optionalServices.whatsappPhoneId"
                placeholder="Phone Number ID"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="password"
                x-model="formData.optionalServices.whatsappToken"
                placeholder="Access Token"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="password"
                x-model="formData.optionalServices.whatsappVerify"
                placeholder="Verify Token"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Step 5: Review & Generate -->
      <div x-show="currentStep === 4" x-cloak>
        <h2 class="text-2xl font-bold mb-4">Review & Generate</h2>
        <p class="text-gray-600 mb-6">Review your configuration and generate .env files</p>

        <div class="space-y-4 mb-6">
          <!-- Essential Services Review -->
          <div class="bg-gray-50 p-4 rounded-lg">
            <h3 class="font-semibold mb-3">Essential Services</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">Supabase URL:</span>
                <span class="font-mono text-xs" x-text="maskValue(formData.essentialServices.supabaseUrl)"></span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Supabase Anon Key:</span>
                <span class="font-mono text-xs" x-text="maskValue(formData.essentialServices.supabaseAnonKey)"></span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Supabase Service Key:</span>
                <span class="font-mono text-xs" x-text="maskValue(formData.essentialServices.supabaseServiceKey)"></span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Stripe Secret Key:</span>
                <span class="font-mono text-xs" x-text="maskValue(formData.essentialServices.stripeSecretKey)"></span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Stripe Publishable Key:</span>
                <span class="font-mono text-xs" x-text="maskValue(formData.essentialServices.stripePublishableKey)"></span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Stripe Webhook Secret:</span>
                <span class="font-mono text-xs" x-text="maskValue(formData.essentialServices.stripeWebhookSecret)"></span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Printify Token:</span>
                <span class="font-mono text-xs" x-text="maskValue(formData.essentialServices.printifyToken)"></span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Printify Shop ID:</span>
                <span class="font-mono text-xs" x-text="maskValue(formData.essentialServices.printifyShopId)"></span>
              </div>
            </div>
          </div>

          <!-- AI Services Review -->
          <div class="bg-gray-50 p-4 rounded-lg" x-show="formData.aiServices.anthropicKey || formData.aiServices.falKey || formData.aiServices.geminiKey">
            <h3 class="font-semibold mb-3">AI Services</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between" x-show="formData.aiServices.anthropicKey">
                <span class="text-gray-600">Anthropic API Key:</span>
                <span class="font-mono text-xs" x-text="maskValue(formData.aiServices.anthropicKey)"></span>
              </div>
              <div class="flex justify-between" x-show="formData.aiServices.falKey">
                <span class="text-gray-600">fal.ai Key:</span>
                <span class="font-mono text-xs" x-text="maskValue(formData.aiServices.falKey)"></span>
              </div>
              <div class="flex justify-between" x-show="formData.aiServices.geminiKey">
                <span class="text-gray-600">Google Gemini Key:</span>
                <span class="font-mono text-xs" x-text="maskValue(formData.aiServices.geminiKey)"></span>
              </div>
            </div>
          </div>

          <!-- Optional Services Review -->
          <div class="bg-gray-50 p-4 rounded-lg" x-show="formData.optionalServices.enableResend || formData.optionalServices.enableCrawl4ai || formData.optionalServices.enableTelegram || formData.optionalServices.enableWhatsapp">
            <h3 class="font-semibold mb-3">Optional Services</h3>
            <div class="space-y-2 text-sm">
              <!-- Resend -->
              <template x-if="formData.optionalServices.enableResend">
                <div class="space-y-2 border-l-2 border-blue-400 pl-3 mb-3">
                  <div class="font-medium text-gray-700">Resend</div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">API Key:</span>
                    <span class="font-mono text-xs" x-text="maskValue(formData.optionalServices.resendKey)"></span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">From Email:</span>
                    <span class="font-mono text-xs" x-text="formData.optionalServices.resendFrom || 'Not set'"></span>
                  </div>
                </div>
              </template>
              <!-- Crawl4AI -->
              <template x-if="formData.optionalServices.enableCrawl4ai">
                <div class="space-y-2 border-l-2 border-blue-400 pl-3 mb-3">
                  <div class="font-medium text-gray-700">Crawl4AI</div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Service URL:</span>
                    <span class="font-mono text-xs" x-text="formData.optionalServices.crawl4aiUrl || 'http://crawl4ai:11235'"></span>
                  </div>
                </div>
              </template>
              <!-- Telegram -->
              <template x-if="formData.optionalServices.enableTelegram">
                <div class="space-y-2 border-l-2 border-blue-400 pl-3 mb-3">
                  <div class="font-medium text-gray-700">Telegram</div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Bot Token:</span>
                    <span class="font-mono text-xs" x-text="maskValue(formData.optionalServices.telegramToken)"></span>
                  </div>
                  <div class="flex justify-between" x-show="formData.optionalServices.telegramSecret">
                    <span class="text-gray-600">Webhook Secret:</span>
                    <span class="font-mono text-xs" x-text="maskValue(formData.optionalServices.telegramSecret)"></span>
                  </div>
                </div>
              </template>
              <!-- WhatsApp -->
              <template x-if="formData.optionalServices.enableWhatsapp">
                <div class="space-y-2 border-l-2 border-blue-400 pl-3">
                  <div class="font-medium text-gray-700">WhatsApp</div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Phone Number ID:</span>
                    <span class="font-mono text-xs" x-text="maskValue(formData.optionalServices.whatsappPhoneId)"></span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Access Token:</span>
                    <span class="font-mono text-xs" x-text="maskValue(formData.optionalServices.whatsappToken)"></span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Verify Token:</span>
                    <span class="font-mono text-xs" x-text="maskValue(formData.optionalServices.whatsappVerify)"></span>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <div x-show="envPreview" class="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96">
            <div class="text-xs font-mono whitespace-pre" x-text="envPreview"></div>
          </div>
        </div>

        <div class="flex gap-3">
          <button
            @click="generateEnv()"
            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Generate .env Files
          </button>
          <button
            @click="writeEnvFiles()"
            x-show="envPreview"
            class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            Write to Disk
          </button>
        </div>
      </div>

      <!-- Step 6: Deploy -->
      <div x-show="currentStep === 5" x-cloak>
        <h2 class="text-2xl font-bold mb-4">Deploy</h2>
        <p class="text-gray-600 mb-6">Start your POD Platform with Docker Compose</p>

        <div class="space-y-4">
          <button
            @click="deploy()"
            :disabled="deploying"
            class="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span x-show="!deploying">🚀 Start Deployment</span>
            <span x-show="deploying">Deploying...</span>
          </button>

          <div x-show="deployOutput" class="bg-gray-900 text-white p-4 rounded-lg overflow-auto max-h-96">
            <pre class="text-xs font-mono" x-text="deployOutput"></pre>
          </div>

          <!-- Health Dashboard -->
          <div x-show="deployComplete" class="mt-6">
            <h3 class="font-semibold mb-4">Service Health</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <template x-for="service in healthServices" :key="service.name">
                <div class="border rounded-lg p-4">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-medium" x-text="service.label"></span>
                    <span
                      class="px-2 py-1 rounded text-xs"
                      :class="service.status === 'running' ? 'bg-green-100 text-green-800' : service.status === 'starting' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'"
                      x-text="service.status === 'running' ? '● Running' : service.status === 'starting' ? '○ Starting' : '○ Stopped'"
                    ></span>
                  </div>
                  <div class="text-xs text-gray-600" x-text="service.name"></div>
                  <div class="text-xs text-gray-500 mt-1" x-show="service.port">
                    Port: <span x-text="service.port"></span>
                  </div>
                  <div class="flex gap-2 mt-3">
                    <button
                      @click="stopService(service.name)"
                      :disabled="service.status === 'stopped'"
                      class="flex-1 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Stop
                    </button>
                    <button
                      @click="restartService(service.name)"
                      :disabled="service.status === 'stopped'"
                      class="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Restart
                    </button>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <div x-show="deployComplete" class="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 class="font-semibold text-green-800 mb-2">✓ Deployment Complete!</h3>
            <p class="text-green-700 mb-4">Your POD Platform is now running.</p>
            <a
              href="http://localhost:3000"
              target="_blank"
              class="inline-block px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Open Store →
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <div class="flex justify-between">
      <button
        @click="previousStep()"
        x-show="currentStep > 0"
        class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
      >
        ← Back
      </button>
      <button
        @click="nextStep()"
        x-show="currentStep < steps.length - 1"
        :disabled="!canProceed()"
        class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
      >
        Next →
      </button>
    </div>
  </div>

  <script>
    function setupWizard() {
      return {
        currentStep: 0,
        steps: [
          { name: 'Prerequisites' },
          { name: 'Essential' },
          { name: 'AI Services' },
          { name: 'Optional' },
          { name: 'Review' },
          { name: 'Deploy' }
        ],
        prerequisites: {
          docker: false,
          dockerCompose: false,
          nodejs: false,
          git: false,
          ports: {}
        },
        formData: {
          essentialServices: {
            supabaseUrl: '',
            supabaseAnonKey: '',
            supabaseServiceKey: '',
            stripeSecretKey: '',
            stripePublishableKey: '',
            stripeWebhookSecret: '',
            printifyToken: '',
            printifyShopId: ''
          },
          aiServices: {
            anthropicKey: '',
            falKey: '',
            geminiKey: ''
          },
          optionalServices: {
            enableResend: false,
            resendKey: '',
            resendFrom: '',
            enableCrawl4ai: false,
            crawl4aiUrl: 'http://crawl4ai:11235',
            enableTelegram: false,
            telegramToken: '',
            telegramSecret: '',
            enableWhatsapp: false,
            whatsappPhoneId: '',
            whatsappToken: '',
            whatsappVerify: ''
          }
        },
        envPreview: '',
        deploying: false,
        deployOutput: '',
        deployComplete: false,
        healthServices: [
          { name: 'frontend', label: 'Frontend', status: 'unknown', port: '3000' },
          { name: 'admin', label: 'Admin Panel', status: 'unknown', port: '3001' },
          { name: 'podclaw', label: 'PodClaw Agent', status: 'unknown', port: '8000' },
          { name: 'rembg', label: 'Background Removal', status: 'unknown', port: '8090' },
          { name: 'redis', label: 'Redis Cache', status: 'unknown', port: '6379' },
          { name: 'caddy', label: 'Caddy Proxy', status: 'unknown', port: '80' }
        ],

        async init() {
          // Load saved state from localStorage
          const saved = localStorage.getItem('podai-setup-state');
          if (saved) {
            try {
              const state = JSON.parse(saved);
              this.currentStep = state.currentStep || 0;
              this.formData = { ...this.formData, ...state.formData };
            } catch (e) {
              console.error('Failed to load saved state:', e);
            }
          }

          // Check prerequisites on load
          await this.checkPrerequisites();

          // Initialize Lucide icons
          setTimeout(() => lucide.createIcons(), 100);
        },

        async checkPrerequisites() {
          const res = await fetch('/api/check');
          this.prerequisites = await res.json();
          lucide.createIcons();
        },

        async generateEnv() {
          const res = await fetch('/api/generate-env', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.formData)
          });
          const data = await res.json();
          this.envPreview = data.frontend;
        },

        async writeEnvFiles() {
          const res = await fetch('/api/write-env', {
            method: 'POST'
          });
          const data = await res.json();
          if (data.success) {
            alert('✓ .env files written successfully!');
          }
        },

        async deploy() {
          this.deploying = true;
          this.deployOutput = '';
          this.deployComplete = false;

          const eventSource = new EventSource('/api/deploy/stream');

          eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'stdout' || data.type === 'stderr' || data.type === 'start') {
              this.deployOutput += data.message;
            } else if (data.type === 'complete') {
              this.deployOutput += '\\n✓ ' + data.message;
              this.deployComplete = true;
              this.deploying = false;
              eventSource.close();
              this.updateServiceHealth();
            } else if (data.type === 'error') {
              this.deployOutput += '\\n✗ ' + data.message;
              this.deploying = false;
              eventSource.close();
            }
          };

          eventSource.onerror = () => {
            this.deployOutput += '\\n✗ Connection error';
            this.deploying = false;
            eventSource.close();
          };
        },

        async updateServiceHealth() {
          const res = await fetch('/api/deploy/status');
          const data = await res.json();

          if (data.services && data.services.length > 0) {
            data.services.forEach(svc => {
              const serviceName = svc.Service || svc.Name || '';
              const status = svc.State || 'unknown';

              const healthService = this.healthServices.find(s =>
                serviceName.toLowerCase().includes(s.name.toLowerCase())
              );

              if (healthService) {
                healthService.status = status.toLowerCase().includes('running') ? 'running' : 'starting';
              }
            });
          }

          // Poll again after 5 seconds if deployment just completed
          if (this.deployComplete) {
            setTimeout(() => this.updateServiceHealth(), 5000);
          }
        },

        async stopService(serviceName) {
          const res = await fetch('/api/service/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service: serviceName })
          });
          const data = await res.json();

          if (data.success) {
            const service = this.healthServices.find(s => s.name === serviceName);
            if (service) {
              service.status = 'stopped';
            }
          }

          // Refresh status after a brief delay
          setTimeout(() => this.updateServiceHealth(), 1000);
        },

        async restartService(serviceName) {
          const res = await fetch('/api/service/restart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service: serviceName })
          });
          const data = await res.json();

          if (data.success) {
            const service = this.healthServices.find(s => s.name === serviceName);
            if (service) {
              service.status = 'starting';
            }
          }

          // Refresh status after a brief delay
          setTimeout(() => this.updateServiceHealth(), 2000);
        },

        nextStep() {
          if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.saveState();
            lucide.createIcons();
          }
        },

        previousStep() {
          if (this.currentStep > 0) {
            this.currentStep--;
            this.saveState();
            lucide.createIcons();
          }
        },

        validateSupabaseUrl(url) {
          return url && url.startsWith('https://') && url.includes('.supabase.co');
        },

        validateStripeSecret(key) {
          return key && (key.startsWith('sk_test_') || key.startsWith('sk_live_'));
        },

        validateStripePublishable(key) {
          return key && (key.startsWith('pk_test_') || key.startsWith('pk_live_'));
        },

        validateStripeWebhook(secret) {
          return secret && secret.startsWith('whsec_');
        },

        validatePrintifyToken(token) {
          return token && token.startsWith('eyJ');
        },

        validatePrintifyShopId(id) {
          return id && /^\\d+$/.test(id);
        },

        validateAnthropicKey(key) {
          return !key || key.startsWith('sk-ant-api');
        },

        validateFalKey(key) {
          // fal.ai uses UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
          return !key || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
        },

        validateGeminiKey(key) {
          return !key || key.startsWith('AIza');
        },

        canProceed() {
          if (this.currentStep === 0) {
            return this.prerequisites.docker &&
                   this.prerequisites.dockerCompose &&
                   this.prerequisites.nodejs;
          }
          if (this.currentStep === 1) {
            const s = this.formData.essentialServices;
            return this.validateSupabaseUrl(s.supabaseUrl) &&
                   s.supabaseAnonKey && s.supabaseAnonKey.startsWith('eyJ') &&
                   s.supabaseServiceKey && s.supabaseServiceKey.startsWith('eyJ') &&
                   this.validateStripeSecret(s.stripeSecretKey) &&
                   this.validateStripePublishable(s.stripePublishableKey) &&
                   this.validateStripeWebhook(s.stripeWebhookSecret) &&
                   this.validatePrintifyToken(s.printifyToken) &&
                   this.validatePrintifyShopId(s.printifyShopId);
          }
          return true;
        },

        saveState() {
          localStorage.setItem('podai-setup-state', JSON.stringify({
            currentStep: this.currentStep,
            formData: this.formData
          }));
        },

        maskValue(value) {
          if (!value || value.length === 0) {
            return 'Not set';
          }
          if (value.length <= 4) {
            return '****';
          }
          const lastFour = value.slice(-4);
          const masked = '*'.repeat(Math.min(value.length - 4, 20));
          return masked + lastFour;
        }
      }
    }
  </script>
</body>
</html>`;
}

// HTTP Request Router
function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API Routes
  if (url.pathname === '/api/check') {
    handlePrerequisitesCheck().then(data => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    });
    return;
  }

  if (url.pathname === '/api/generate-env' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const services = JSON.parse(body);
        const envContent = await handleGenerateEnv(services);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(envContent));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (url.pathname === '/api/write-env' && req.method === 'POST') {
    handleWriteEnvFiles().then(data => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    }).catch(e => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    });
    return;
  }

  if (url.pathname === '/api/deploy' && req.method === 'POST') {
    handleDeploy().then(data => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    });
    return;
  }

  if (url.pathname === '/api/deploy/status') {
    handleDeployStatus().then(data => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    });
    return;
  }

  if (url.pathname === '/api/deploy/stream') {
    handleDeployStream(req, res);
    return;
  }

  if (url.pathname === '/api/service/stop' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const { service } = JSON.parse(body);
        const result = await handleServiceStop(service);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (url.pathname === '/api/service/restart' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const { service } = JSON.parse(body);
        const result = await handleServiceRestart(service);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Serve HTML
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getHTMLTemplate());
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

// Start server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`\n🚀 POD AI Setup Wizard running at http://localhost:${PORT}\n`);
  console.log('Opening browser...\n');

  // Auto-open browser
  const platform = process.platform;
  const command = platform === 'darwin' ? 'open' :
                  platform === 'win32' ? 'start' :
                  'xdg-open';

  spawn(command, [`http://localhost:${PORT}`], { shell: true });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down setup wizard...');
  server.close(() => {
    console.log('Server closed. Goodbye!\n');
    process.exit(0);
  });
});
