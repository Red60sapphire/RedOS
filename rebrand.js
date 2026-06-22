#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = __dirname;

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.vscode']);
const SKIP_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);
const TEXT_EXTENSIONS = new Set([
    'js', 'ts', 'tsx', 'jsx', 'mjs', 'cjs',
    'json', 'md', 'mdx', 'txt',
    'yml', 'yaml', 'toml',
    'env', 'env.example', 'env.local',
    'css', 'scss', 'sass', 'less',
    'html', 'htm', 'xml', 'svg',
    'sh', 'bash', 'zsh', 'fish',
    'py', 'rs', 'go', 'java', 'kt',
    'php', 'rb', 'pl', 'lua',
    'ini', 'cfg', 'conf', 'config',
    'properties', 'gradle', 'maven',
    'dockerfile', 'dockerignore',
    'gitignore', 'gitattributes', 'gitmodules',
    'prettierrc', 'prettierignore',
    'eslintrc', 'eslintignore',
    'editorconfig',
    'nvmrc', 'nvmignore',
    'ajs', 'mjs',
    'c', 'h', 'cpp', 'hpp', 'cc', 'hh',
    'mk', 'make', 'makefile',
    'service', 'socket', 'device', 'mount', 'automount', 'swap', 'target', 'path', 'timer', 'slice', 'scope',
    'gitignore', 'gitmodules', 'dockerfile',
    'anura-run', 'anura-boot', 'anura-apk', 'twisp-service', 'hostname'
]);

const REPLACEMENTS = [
    { from: 'RedOS', to: 'RedOS' },
    { from: 'redos', to: 'redos' },
    { from: 'Red', to: 'Red' },
    { from: 'red', to: 'red' },
    { from: 'RED_', to: 'RED_' },
];

function shouldSkipDir(dirName) {
    return SKIP_DIRS.has(dirName);
}

function shouldSkipFile(fileName) {
    return SKIP_FILES.has(fileName);
}

function isTextFile(filePath) {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const baseName = path.basename(filePath).toLowerCase();
    const baseNameNoDot = baseName.startsWith('.') ? baseName.slice(1) : baseName;
    
    if (TEXT_EXTENSIONS.has(ext)) return true;
    if (TEXT_EXTENSIONS.has(baseNameNoDot)) return true;
    
    if (filePath.endsWith('.env') || filePath.endsWith('.env.example') || filePath.endsWith('.env.local')) {
        return true;
    }
    if (baseNameNoDot === 'makefile' || baseNameNoDot === 'dockerfile') {
        return true;
    }
    
    return false;
}

function isBinaryFile(filePath) {
    try {
        const buffer = fs.readFileSync(filePath, { encoding: null });
        for (let i = 0; i < Math.min(buffer.length, 8192); i++) {
            if (buffer[i] === 0) return true;
        }
        return false;
    } catch {
        return true;
    }
}

function walkDir(dir, fileList = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
            if (!shouldSkipDir(entry.name)) {
                walkDir(fullPath, fileList);
            }
        } else if (entry.isFile()) {
            if (!shouldSkipFile(entry.name) && isTextFile(fullPath) && !isBinaryFile(fullPath)) {
                fileList.push(fullPath);
            }
        }
    }
    
    return fileList;
}

function applyReplacements(content, filePath) {
    let modified = false;
    let newContent = content;
    
    for (const { from, to } of REPLACEMENTS) {
        const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        if (regex.test(newContent)) {
            newContent = newContent.replace(regex, to);
            modified = true;
        }
    }
    
    return { content: newContent, modified };
}

function main() {
    console.log('Scanning repository...');
    const files = walkDir(ROOT_DIR);
    console.log(`Found ${files.length} text files to process`);
    
    let modifiedCount = 0;
    const modifiedFiles = [];
    
    for (const filePath of files) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const { content: newContent, modified } = applyReplacements(content, filePath);
            
            if (modified) {
                fs.writeFileSync(filePath, newContent, 'utf-8');
                const relativePath = path.relative(ROOT_DIR, filePath);
                console.log(`Modified: ${relativePath}`);
                modifiedFiles.push(relativePath);
                modifiedCount++;
            }
        } catch (err) {
            console.error(`Error processing ${filePath}:`, err.message);
        }
    }
    
    console.log(`\nDone! Modified ${modifiedCount} files.`);
    if (modifiedFiles.length > 0) {
        console.log('\nModified files:');
        for (const f of modifiedFiles) {
            console.log(`  ${f}`);
        }
    }
}

main();