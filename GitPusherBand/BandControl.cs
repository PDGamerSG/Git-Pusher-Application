using System;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace GitPusherBand
{
    public partial class BandControl : UserControl
    {
        private const string DefaultPlaceholder = "type feature and Enter...";
        private const string PushingPlaceholder = "pushing...";
        private const int CueBannerMessage = 0x1501;

        private static readonly Uri PushEndpoint = new Uri("http://localhost:43210/push");

        private readonly ProjectStore _projectStore;
        private readonly HttpClient _httpClient;
        private readonly Timer _feedbackTimer;
        private readonly Color _defaultInputChromeColor = Color.FromArgb(0x1a, 0x1a, 0x1a);
        private readonly Color _successInputChromeColor = Color.FromArgb(46, 204, 113);
        private readonly Color _errorInputChromeColor = Color.FromArgb(231, 76, 60);
        private readonly Color _defaultInputTextColor = Color.White;
        private readonly Color _errorInputTextColor = Color.FromArgb(255, 180, 180);

        private FileSystemWatcher _storeWatcher;
        private ProjectsState _currentState = new ProjectsState();
        private bool _isPushing;
        private bool _clearTextAfterFeedback;
        private bool _isDisposed;

        public BandControl()
        {
            InitializeComponent();

            _projectStore = new ProjectStore();
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
            _feedbackTimer = new Timer { Interval = 1000 };
            _feedbackTimer.Tick += FeedbackTimer_Tick;

            featureTextBox.HandleCreated += FeatureTextBox_HandleCreated;
            folderIconPictureBox.Image = CreateFolderIconBitmap();
            Disposed += BandControl_Disposed;

            LoadProjectsFromStore();
            InitializeStoreWatcher();
            SetCueBanner(DefaultPlaceholder);
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, string lParam);

        private void FeatureTextBox_HandleCreated(object sender, EventArgs e)
        {
            SetCueBanner(DefaultPlaceholder);
        }

        private async void FeatureTextBox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode != Keys.Enter)
            {
                return;
            }

            e.SuppressKeyPress = true;
            e.Handled = true;
            await SubmitPushAsync();
        }

        private void ProjectNameLabel_Click(object sender, EventArgs e)
        {
            LoadProjectsFromStore();
            projectContextMenu.Show(projectNameLabel, 0, projectNameLabel.Height);
        }

        private void ProjectMenuItem_Click(object sender, EventArgs e)
        {
            if (!(sender is ToolStripMenuItem menuItem) || !(menuItem.Tag is string projectId))
            {
                return;
            }

            if (!_projectStore.TrySetActiveProjectId(projectId, out var updatedState, out var error))
            {
                FlashError(string.IsNullOrWhiteSpace(error) ? "project switch failed" : error);
                return;
            }

            _currentState = updatedState;
            UpdateProjectLabel();
            RebuildProjectMenu();
        }

        private async Task SubmitPushAsync()
        {
            if (_isPushing)
            {
                return;
            }

            var featureName = featureTextBox.Text.Trim();
            if (featureName.Length == 0)
            {
                return;
            }

            if (!_projectStore.TryLoad(out var state, out var loadError))
            {
                FlashError(string.IsNullOrWhiteSpace(loadError) ? "projects.json error" : "projects.json error");
                return;
            }

            var activeProject = _projectStore.GetActiveProject(state);
            if (activeProject == null || string.IsNullOrWhiteSpace(activeProject.Path))
            {
                FlashError("select a project first");
                return;
            }

            SetPushingState(true);

            string pushError;
            try
            {
                pushError = await PushToElectronAsync(activeProject.Path, featureName, state.GrokApiKey);
            }
            finally
            {
                SetPushingState(false);
            }

            if (string.IsNullOrEmpty(pushError))
            {
                featureTextBox.Clear();
                FlashSuccess();
                return;
            }

            FlashError(pushError);
        }

        private async Task<string> PushToElectronAsync(string repoPath, string featureName, string apiKey)
        {
            var requestBody = JsonConvert.SerializeObject(new PushRequest
            {
                RepoPath = repoPath,
                FeatureName = featureName,
                ApiKey = apiKey ?? string.Empty
            });

            using (var content = new StringContent(requestBody, Encoding.UTF8, "application/json"))
            {
                HttpResponseMessage response;
                try
                {
                    response = await _httpClient.PostAsync(PushEndpoint, content);
                }
                catch (HttpRequestException)
                {
                    return "app not running";
                }
                catch (TaskCanceledException)
                {
                    return "push timeout";
                }

                if (response.IsSuccessStatusCode)
                {
                    return null;
                }

                var responseBody = await response.Content.ReadAsStringAsync();
                return ParseErrorText(responseBody);
            }
        }

        private void LoadProjectsFromStore()
        {
            if (!_projectStore.TryLoad(out var state, out var error))
            {
                _currentState = new ProjectsState();
                projectNameLabel.Text = "projects.json error";
                projectContextMenu.Items.Clear();
                return;
            }

            _currentState = state;
            UpdateProjectLabel();
            RebuildProjectMenu();
        }

        private void UpdateProjectLabel()
        {
            var activeProject = _projectStore.GetActiveProject(_currentState);
            if (activeProject == null)
            {
                projectNameLabel.Text = "No projects";
                return;
            }

            var displayName = string.IsNullOrWhiteSpace(activeProject.Name) ? activeProject.Path : activeProject.Name;
            projectNameLabel.Text = displayName + " \u25BE";
        }

        private void RebuildProjectMenu()
        {
            projectContextMenu.Items.Clear();

            if (_currentState.Projects == null || _currentState.Projects.Count == 0)
            {
                var emptyItem = new ToolStripMenuItem("No projects saved")
                {
                    Enabled = false,
                    ForeColor = Color.White,
                    BackColor = Color.FromArgb(0x1a, 0x1a, 0x1a)
                };
                projectContextMenu.Items.Add(emptyItem);
                return;
            }

            foreach (var project in _currentState.Projects)
            {
                var item = new ToolStripMenuItem(project.Name)
                {
                    Tag = project.Id,
                    Checked = string.Equals(project.Id, _currentState.ActiveProjectId, StringComparison.Ordinal),
                    ForeColor = Color.White,
                    BackColor = Color.FromArgb(0x1a, 0x1a, 0x1a)
                };

                item.Click += ProjectMenuItem_Click;
                projectContextMenu.Items.Add(item);
            }
        }

        private void SetPushingState(bool pushing)
        {
            _isPushing = pushing;
            featureTextBox.Enabled = !pushing;
            featureTextBox.ForeColor = _defaultInputTextColor;

            if (pushing)
            {
                SetCueBanner(PushingPlaceholder);
                return;
            }

            if (!_feedbackTimer.Enabled)
            {
                SetCueBanner(DefaultPlaceholder);
            }
        }

        private void FlashSuccess()
        {
            _clearTextAfterFeedback = false;
            inputBorderPanel.BackColor = _successInputChromeColor;
            RestartFeedbackTimer();
        }

        private void FlashError(string message)
        {
            _clearTextAfterFeedback = true;
            featureTextBox.ForeColor = _errorInputTextColor;
            featureTextBox.Text = LimitStatusText(message);
            featureTextBox.SelectionStart = featureTextBox.TextLength;
            inputBorderPanel.BackColor = _errorInputChromeColor;
            RestartFeedbackTimer();
        }

        private void RestartFeedbackTimer()
        {
            _feedbackTimer.Stop();
            _feedbackTimer.Start();
        }

        private void FeedbackTimer_Tick(object sender, EventArgs e)
        {
            _feedbackTimer.Stop();
            inputBorderPanel.BackColor = _defaultInputChromeColor;

            if (_clearTextAfterFeedback)
            {
                _clearTextAfterFeedback = false;
                featureTextBox.Clear();
                featureTextBox.ForeColor = _defaultInputTextColor;
            }

            if (!_isPushing)
            {
                SetCueBanner(DefaultPlaceholder);
            }
        }

        private void SetCueBanner(string text)
        {
            if (!featureTextBox.IsHandleCreated)
            {
                return;
            }

            SendMessage(featureTextBox.Handle, CueBannerMessage, new IntPtr(1), text ?? string.Empty);
        }

        private void InitializeStoreWatcher()
        {
            var directory = Path.GetDirectoryName(_projectStore.ProjectsFilePath);
            if (string.IsNullOrEmpty(directory))
            {
                return;
            }

            try
            {
                Directory.CreateDirectory(directory);
            }
            catch (IOException)
            {
                return;
            }
            catch (UnauthorizedAccessException)
            {
                return;
            }

            _storeWatcher = new FileSystemWatcher(directory, Path.GetFileName(_projectStore.ProjectsFilePath))
            {
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.CreationTime | NotifyFilters.Size
            };

            _storeWatcher.Changed += StoreWatcher_Changed;
            _storeWatcher.Created += StoreWatcher_Changed;
            _storeWatcher.Deleted += StoreWatcher_Changed;
            _storeWatcher.Renamed += StoreWatcher_Renamed;
            _storeWatcher.EnableRaisingEvents = true;
        }

        private void StoreWatcher_Changed(object sender, FileSystemEventArgs e)
        {
            QueueReloadFromWatcher();
        }

        private void StoreWatcher_Renamed(object sender, RenamedEventArgs e)
        {
            QueueReloadFromWatcher();
        }

        private void QueueReloadFromWatcher()
        {
            if (_isDisposed || !IsHandleCreated)
            {
                return;
            }

            BeginInvoke((MethodInvoker)LoadProjectsFromStore);
        }

        private void BandControl_Disposed(object sender, EventArgs e)
        {
            if (_isDisposed)
            {
                return;
            }

            _isDisposed = true;

            _feedbackTimer.Stop();
            _feedbackTimer.Dispose();

            if (_storeWatcher != null)
            {
                _storeWatcher.EnableRaisingEvents = false;
                _storeWatcher.Changed -= StoreWatcher_Changed;
                _storeWatcher.Created -= StoreWatcher_Changed;
                _storeWatcher.Deleted -= StoreWatcher_Changed;
                _storeWatcher.Renamed -= StoreWatcher_Renamed;
                _storeWatcher.Dispose();
                _storeWatcher = null;
            }

            if (folderIconPictureBox.Image != null)
            {
                folderIconPictureBox.Image.Dispose();
                folderIconPictureBox.Image = null;
            }

            _httpClient.Dispose();
        }

        private static string ParseErrorText(string responseBody)
        {
            if (string.IsNullOrWhiteSpace(responseBody))
            {
                return "push failed";
            }

            try
            {
                var json = JObject.Parse(responseBody);
                var error = json["error"]?.ToString();
                if (!string.IsNullOrWhiteSpace(error))
                {
                    return LimitStatusText(error);
                }

                var message = json["message"]?.ToString();
                if (!string.IsNullOrWhiteSpace(message))
                {
                    return LimitStatusText(message);
                }
            }
            catch (JsonException)
            {
            }

            return LimitStatusText(responseBody);
        }

        private static string LimitStatusText(string text)
        {
            var clean = string.IsNullOrWhiteSpace(text)
                ? "push failed"
                : text.Replace("\r", " ").Replace("\n", " ").Trim();

            const int maxLength = 36;
            if (clean.Length <= maxLength)
            {
                return clean;
            }

            return clean.Substring(0, maxLength - 3) + "...";
        }

        private static Bitmap CreateFolderIconBitmap()
        {
            var bitmap = new Bitmap(16, 16);

            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.Clear(Color.Transparent);

                using (var tabBrush = new SolidBrush(Color.FromArgb(244, 197, 104)))
                using (var bodyBrush = new SolidBrush(Color.FromArgb(226, 168, 69)))
                using (var outlinePen = new Pen(Color.FromArgb(146, 102, 38)))
                {
                    graphics.FillRectangle(tabBrush, 2, 2, 6, 4);
                    graphics.FillRectangle(bodyBrush, 1, 5, 14, 9);
                    graphics.DrawRectangle(outlinePen, 1, 5, 13, 8);
                }
            }

            return bitmap;
        }

        private sealed class PushRequest
        {
            [JsonProperty("repoPath")]
            public string RepoPath { get; set; }

            [JsonProperty("featureName")]
            public string FeatureName { get; set; }

            [JsonProperty("apiKey")]
            public string ApiKey { get; set; }
        }
    }
}
