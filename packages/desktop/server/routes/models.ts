/**
 * Model and provider routes
 *
 * Handles model preferences, model providers, and provider authentication.
 */

import { existsSync, statSync } from 'node:fs';

import {
  getMachineConfigFilePath,
  readMachineInstructionFiles,
  readMachineSkillDirs,
  writeMachineInstructionFiles,
  writeMachineSkillDirs,
} from '@neon-pilot/core';
import type { Express } from 'express';

import { logError } from '../middleware/index.js';
import { subscribeProviderOAuthLogin } from '../models/providerAuth.js';
import type { ServerRouteContext } from './context.js';

let getRuntimeScopeFn: () => string = () => {
  throw new Error('getRuntimeScope not initialized for model routes');
};

let materializeWebRuntimeConfigFn: (profile: string) => void = () => {
  throw new Error('materializeWebRuntimeConfig not initialized for model routes');
};

function readInstructionFilesState() {
  return {
    configFile: getMachineConfigFilePath(),
    instructionFiles: readMachineInstructionFiles(),
  };
}

function readSkillFoldersState() {
  return {
    configFile: getMachineConfigFilePath(),
    skillDirs: readMachineSkillDirs(),
  };
}

function initializeModelRoutesContext(
  context: Pick<ServerRouteContext, 'getRuntimeScope' | 'materializeWebRuntimeConfig' | 'getAuthFile' | 'getSettingsFile'>,
): void {
  getRuntimeScopeFn = context.getRuntimeScope;
  materializeWebRuntimeConfigFn = context.materializeWebRuntimeConfig;
  void context.getAuthFile;
  void context.getSettingsFile;
}

/**
 * Register model routes on the given router.
 */
export function registerModelRoutes(
  router: Pick<Express, 'get' | 'post' | 'patch' | 'delete'>,
  context: Pick<ServerRouteContext, 'getRuntimeScope' | 'materializeWebRuntimeConfig' | 'getAuthFile' | 'getSettingsFile'>,
): void {
  initializeModelRoutesContext(context);
  // ── Models ────────────────────────────────────────────────────────────────

  router.get('/api/skill-folders', (_req, res) => {
    try {
      res.json(readSkillFoldersState());
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).json({ error: String(err) });
    }
  });

  router.patch('/api/skill-folders', (req, res) => {
    try {
      const { skillDirs } = req.body as { skillDirs?: unknown };
      if (!Array.isArray(skillDirs) || !skillDirs.every((entry) => typeof entry === 'string')) {
        res.status(400).json({ error: 'skillDirs must be an array of strings' });
        return;
      }

      for (const rawDir of skillDirs) {
        const dirPath = rawDir.trim();
        if (!dirPath) {
          continue;
        }
        if (!existsSync(dirPath)) {
          res.status(400).json({ error: `Directory does not exist: ${dirPath}` });
          return;
        }
        if (!statSync(dirPath).isDirectory()) {
          res.status(400).json({ error: `Not a directory: ${dirPath}` });
          return;
        }
      }

      writeMachineSkillDirs(skillDirs);
      materializeWebRuntimeConfigFn(getRuntimeScopeFn());
      res.json(readSkillFoldersState());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('does not exist') || message.includes('Not a directory') ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  router.get('/api/instructions', (_req, res) => {
    try {
      res.json(readInstructionFilesState());
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).json({ error: String(err) });
    }
  });

  router.patch('/api/instructions', (req, res) => {
    try {
      const { instructionFiles } = req.body as { instructionFiles?: unknown };
      if (!Array.isArray(instructionFiles) || !instructionFiles.every((entry) => typeof entry === 'string')) {
        res.status(400).json({ error: 'instructionFiles must be an array of strings' });
        return;
      }

      for (const rawFile of instructionFiles) {
        const filePath = rawFile.trim();
        if (!filePath) {
          continue;
        }
        if (!existsSync(filePath)) {
          res.status(400).json({ error: `File does not exist: ${filePath}` });
          return;
        }
        if (!statSync(filePath).isFile()) {
          res.status(400).json({ error: `Not a file: ${filePath}` });
          return;
        }
      }

      writeMachineInstructionFiles(instructionFiles);
      materializeWebRuntimeConfigFn(getRuntimeScopeFn());
      res.json(readInstructionFilesState());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('does not exist') || message.includes('Not a file') ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  // ── Model Providers ────────────────────────────────────────────────────────

  // ── Provider Auth ─────────────────────────────────────────────────────────

  router.get('/api/provider-auth/oauth/:loginId/events', (req, res) => {
    try {
      const loginId = req.params.loginId;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const unsubscribe = subscribeProviderOAuthLogin(loginId, (login: { status: string }) => {
        res.write(`data: ${JSON.stringify(login)}\n\n`);
        if (login.status === 'completed' || login.status === 'failed') {
          clearTimeout(timeoutId);
          unsubscribe();
          res.end();
        }
      });

      // Timeout after 10 minutes
      const timeoutId = setTimeout(
        () => {
          unsubscribe();
          res.end();
        },
        10 * 60 * 1000,
      );

      req.on('close', () => {
        unsubscribe();
      });
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).json({ error: String(err) });
    }
  });
}
