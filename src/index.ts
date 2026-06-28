#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import dotenv from 'dotenv';
import { REPL } from './cli/repl';
import { registerCommands } from './commands/index';
import { configManager } from './config/manager';
import { printBanner, printError, printSuccess, printInfo } from './utils/terminal';
import { logger } from './utils/logger';

// Load .env from project root if present
dotenv.config();

const program = new Command();

program
  .name('aicli')
  .description('AI Coding CLI — A production-quality terminal AI coding assistant')
  .version('1.0.0')
  .option('-p, --path <path>', 'Project path to work in', process.cwd())
  .option('--provider <name>', 'Override active provider')
  .option('--model <model>', 'Override active model')
  .option('--no-stream', 'Disable streaming')
  .option('--no-index', 'Disable auto-indexing');

program
  .command('init')
  .description('Initialize aicli configuration')
  .action(async () => {
    printBanner();
    printInfo('Initializing AICLI configuration...');
    const dir = configManager.getConfigDir();
    printSuccess(`Config directory: ${dir}`);
    printInfo('Set your API keys with:');
    console.log('  aicli config set provider.openrouter.apiKey <your-key>');
    console.log('  aicli config set provider.anthropic.apiKey <your-key>');
    console.log('  aicli config set provider.openai.apiKey <your-key>');
    console.log('  aicli config set provider.gemini.apiKey <your-key>');
    printInfo('\nOr set environment variables:');
    console.log('  OPENROUTER_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY');
  });

program
  .command('config')
  .description('Manage configuration')
  .argument('[action]', 'Action: get | set | list')
  .argument('[key]', 'Config key')
  .argument('[value]', 'Config value')
  .action((action, key, value) => {
    if (action === 'set' && key && value) {
      const parts = key.split('.');
      if (parts[0] === 'provider' && parts[1] && parts[2] === 'apiKey') {
        const { ProviderName } = require('./config/types');
        configManager.setApiKey(parts[1] as any, value);
        printSuccess(`Set API key for ${parts[1]}`);
      } else {
        printError('Unknown config key format. Use: provider.<name>.apiKey');
      }
    } else {
      const cfg = configManager.get();
      console.log(JSON.stringify(cfg, (key, val) => {
        // Redact API keys in output
        if (key === 'apiKey' && val) return '[REDACTED]';
        if (key === 'token' && val) return '[REDACTED]';
        return val;
      }, 2));
    }
  });

// Main action: start REPL
program.action(async (opts) => {
  try {
    // Register all slash commands
    registerCommands();

    const cfg = configManager.get();

    // Apply CLI option overrides
    if (opts.provider) {
      configManager.setActiveProvider(opts.provider);
    }
    if (opts.model) {
      configManager.setDefaultModel(cfg.activeProvider, opts.model);
    }
    if (opts.stream === false) {
      configManager.set('streamingEnabled', false);
    }
    if (opts.index === false) {
      configManager.set('autoIndex', false);
    }

    const projectPath = path.resolve(opts.path || process.cwd());
    const repl = new REPL(projectPath);
    await repl.start();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    printError(`Fatal error: ${msg}`);
    logger.error('Fatal startup error', { err });
    process.exit(1);
  }
});

program.parse(process.argv);
