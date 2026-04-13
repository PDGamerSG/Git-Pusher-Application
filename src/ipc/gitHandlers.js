const simpleGit = require('simple-git');
const { spawn } = require('child_process');
const { BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

function sendToRenderer(data) {
  const wins = BrowserWindow.getAllWindows();
  if (wins.length > 0) {
    wins[0].webContents.send('terminal-output', data);
  }
}

function runGitCommand(repoPath, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, { cwd: repoPath });
    let output = '';

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      sendToRenderer(text);
    });

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      sendToRenderer(text);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`git ${args.join(' ')} exited with code ${code}\n${output}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

function isNoUpstreamBranchError(message) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('no upstream branch') || normalized.includes('--set-upstream');
}

function registerGitHandlers(ipcMain) {
  ipcMain.handle('get-repo-status', async (_event, repoPath) => {
    try {
      const git = simpleGit(repoPath);
      const status = await git.status();
      const branch = status.current;
      const changedFiles = status.files.map(f => ({
        path: f.path,
        status: f.working_dir || f.index
      }));
      return { branch, changedFiles, error: null };
    } catch (err) {
      return { branch: null, changedFiles: [], error: err.message };
    }
  });

  ipcMain.handle('get-recent-commits', async (_event, repoPath) => {
    try {
      const git = simpleGit(repoPath);
      const log = await git.log({ maxCount: 3 });
      return {
        commits: log.all.map(c => ({
          hash: c.hash.substring(0, 7),
          message: c.message,
          date: c.date,
          author: c.author_name
        })),
        error: null
      };
    } catch (err) {
      return { commits: [], error: err.message };
    }
  });

  ipcMain.handle('run-push', async (_event, { repoPath, commitMessage }) => {
    try {
      const git = simpleGit(repoPath);
      const initialStatus = await git.status();
      if (initialStatus.files.length === 0) {
        const message = 'No changes detected. Nothing to commit or push.';
        sendToRenderer(`\n✗ ${message}\n`);
        return { success: false, error: message };
      }

      const normalizedCommitMessage = (commitMessage || '').trim();
      if (!normalizedCommitMessage) {
        const message = 'Commit message is empty.';
        sendToRenderer(`\n✗ ${message}\n`);
        return { success: false, error: message };
      }

      sendToRenderer('\n$ git add .\n');
      await runGitCommand(repoPath, ['add', '.']);

      sendToRenderer('\n$ git commit -m "' + normalizedCommitMessage + '"\n');
      await runGitCommand(repoPath, ['commit', '-m', normalizedCommitMessage]);

      sendToRenderer('\n$ git push\n');
      try {
        await runGitCommand(repoPath, ['push']);
      } catch (err) {
        if (!isNoUpstreamBranchError(err.message)) {
          throw err;
        }

        const branchName = (await runGitCommand(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
        if (!branchName || branchName === 'HEAD') {
          throw new Error('Cannot determine current branch for upstream setup.');
        }

        sendToRenderer('\nNo upstream branch found. Retrying with upstream setup...\n');
        sendToRenderer(`\n$ git push --set-upstream origin ${branchName}\n`);
        await runGitCommand(repoPath, ['push', '--set-upstream', 'origin', branchName]);
      }

      sendToRenderer('\n✓ Push complete!\n');
      return { success: true, error: null };
    } catch (err) {
      sendToRenderer('\n✗ Error: ' + err.message + '\n');
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('check-git-init', async (_event, repoPath) => {
    try {
      const gitDir = path.join(repoPath, '.git');
      const exists = fs.existsSync(gitDir);
      if (!exists) {
        return { initialized: false, hasRemote: false };
      }
      // Check if remote 'origin' exists
      const git = simpleGit(repoPath);
      const remotes = await git.getRemotes(true);
      const hasOrigin = remotes.some(r => r.name === 'origin');
      return { initialized: true, hasRemote: hasOrigin };
    } catch (err) {
      return { initialized: false, hasRemote: false, error: err.message };
    }
  });

  ipcMain.handle('init-and-push', async (_event, { repoPath, remoteUrl }) => {
    try {
      const gitDir = path.join(repoPath, '.git');
      const alreadyInit = fs.existsSync(gitDir);

      // 1. git init (only if not already initialized)
      if (!alreadyInit) {
        sendToRenderer('$ git init\n');
        await runGitCommand(repoPath, ['init']);
      }

      // 2. Check if origin already exists
      const git = simpleGit(repoPath);
      const remotes = await git.getRemotes(true);
      const hasOrigin = remotes.some(r => r.name === 'origin');

      if (hasOrigin) {
        // Replace existing origin
        sendToRenderer('\n$ git remote set-url origin ' + remoteUrl + '\n');
        await runGitCommand(repoPath, ['remote', 'set-url', 'origin', remoteUrl]);
      } else {
        sendToRenderer('\n$ git remote add origin ' + remoteUrl + '\n');
        await runGitCommand(repoPath, ['remote', 'add', 'origin', remoteUrl]);
      }

      // 3. Verify remote
      sendToRenderer('\n$ git remote -v\n');
      await runGitCommand(repoPath, ['remote', '-v']);

      // 4. Stage all files
      sendToRenderer('\n$ git add .\n');
      await runGitCommand(repoPath, ['add', '.']);

      // 5. Check if there's anything to commit
      const status = await git.status();
      if (status.files.length === 0) {
        // Nothing staged — could be empty dir or everything already committed
        const log = await git.log({ maxCount: 1 }).catch(() => null);
        if (!log || log.total === 0) {
          sendToRenderer('\n⚠ No files to commit. Add some files first.\n');
          return { success: false, error: 'No files to commit. The folder may be empty.' };
        }
        // Already have commits, just push
        sendToRenderer('\nNo new changes to commit. Pushing existing commits...\n');
      } else {
        // 6. Commit
        sendToRenderer('\n$ git commit -m "Initial Commit"\n');
        await runGitCommand(repoPath, ['commit', '-m', 'Initial Commit']);
      }

      // 7. Rename branch to main
      sendToRenderer('\n$ git branch -M main\n');
      await runGitCommand(repoPath, ['branch', '-M', 'main']);

      // 8. Push
      sendToRenderer('\n$ git push -u origin main\n');
      await runGitCommand(repoPath, ['push', '-u', 'origin', 'main']);

      sendToRenderer('\n✓ Repository initialized and pushed to remote!\n');
      return { success: true, error: null };
    } catch (err) {
      sendToRenderer('\n✗ Error: ' + err.message + '\n');
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-diff-stat', async (_event, repoPath) => {
    try {
      const git = simpleGit(repoPath);
      const diff = await git.diff(['--stat']);
      const diffCached = await git.diff(['--cached', '--stat']);
      const combined = [diff, diffCached].filter(Boolean).join('\n');
      return { diff: combined || 'No changes detected', error: null };
    } catch (err) {
      return { diff: '', error: err.message };
    }
  });
}

module.exports = { registerGitHandlers };
