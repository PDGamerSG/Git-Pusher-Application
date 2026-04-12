const simpleGit = require('simple-git');
const { spawn } = require('child_process');
const { BrowserWindow } = require('electron');

function sendToRenderer(data) {
  const wins = BrowserWindow.getAllWindows();
  if (wins.length > 0) {
    wins[0].webContents.send('terminal-output', data);
  }
}

function runGitCommand(repoPath, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, { cwd: repoPath, shell: true });
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
      const log = await git.log({ maxCount: 5 });
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
      sendToRenderer('\n$ git add .\n');
      await runGitCommand(repoPath, ['add', '.']);

      sendToRenderer('\n$ git commit -m "' + commitMessage + '"\n');
      await runGitCommand(repoPath, ['commit', '-m', commitMessage]);

      sendToRenderer('\n$ git push\n');
      await runGitCommand(repoPath, ['push']);

      sendToRenderer('\n✓ Push complete!\n');
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
