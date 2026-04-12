using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Newtonsoft.Json;

namespace GitPusherBand
{
    public sealed class ProjectStore
    {
        private readonly object _syncRoot = new object();

        public ProjectStore()
        {
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            ProjectsFilePath = Path.Combine(appData, "GitPusher", "projects.json");
        }

        public string ProjectsFilePath { get; }

        public bool TryLoad(out ProjectsState state, out string error)
        {
            lock (_syncRoot)
            {
                return TryLoadUnsafe(out state, out error);
            }
        }

        public bool TrySetActiveProjectId(string projectId, out ProjectsState updatedState, out string error)
        {
            lock (_syncRoot)
            {
                if (!TryLoadUnsafe(out var state, out error))
                {
                    updatedState = new ProjectsState();
                    return false;
                }

                var exists = state.Projects.Any(project => string.Equals(project.Id, projectId, StringComparison.Ordinal));
                if (!exists)
                {
                    updatedState = state;
                    error = "project not found";
                    return false;
                }

                state.ActiveProjectId = projectId;
                if (!TrySaveUnsafe(state, out error))
                {
                    updatedState = state;
                    return false;
                }

                updatedState = state;
                return true;
            }
        }

        public ProjectInfo GetActiveProject(ProjectsState state)
        {
            if (state == null || state.Projects == null || state.Projects.Count == 0)
            {
                return null;
            }

            if (!string.IsNullOrWhiteSpace(state.ActiveProjectId))
            {
                var active = state.Projects.FirstOrDefault(project =>
                    string.Equals(project.Id, state.ActiveProjectId, StringComparison.Ordinal));
                if (active != null)
                {
                    return active;
                }
            }

            return state.Projects[0];
        }

        private bool TryLoadUnsafe(out ProjectsState state, out string error)
        {
            state = new ProjectsState();
            error = null;

            if (!File.Exists(ProjectsFilePath))
            {
                return true;
            }

            string rawJson;
            try
            {
                rawJson = File.ReadAllText(ProjectsFilePath, Encoding.UTF8);
            }
            catch (IOException ioEx)
            {
                error = ioEx.Message;
                return false;
            }
            catch (UnauthorizedAccessException unauthorizedEx)
            {
                error = unauthorizedEx.Message;
                return false;
            }

            if (string.IsNullOrWhiteSpace(rawJson))
            {
                return true;
            }

            try
            {
                state = JsonConvert.DeserializeObject<ProjectsState>(rawJson) ?? new ProjectsState();
                state.Projects = state.Projects ?? new List<ProjectInfo>();
                state.ActiveProjectId = state.ActiveProjectId ?? string.Empty;
                state.GrokApiKey = state.GrokApiKey ?? string.Empty;
                return true;
            }
            catch (JsonException jsonEx)
            {
                state = new ProjectsState();
                error = jsonEx.Message;
                return false;
            }
        }

        private bool TrySaveUnsafe(ProjectsState state, out string error)
        {
            error = null;
            var directory = Path.GetDirectoryName(ProjectsFilePath);

            if (string.IsNullOrEmpty(directory))
            {
                error = "invalid projects file path";
                return false;
            }

            try
            {
                Directory.CreateDirectory(directory);
                var json = JsonConvert.SerializeObject(state, Formatting.Indented);
                File.WriteAllText(ProjectsFilePath, json, new UTF8Encoding(false));
                return true;
            }
            catch (IOException ioEx)
            {
                error = ioEx.Message;
                return false;
            }
            catch (UnauthorizedAccessException unauthorizedEx)
            {
                error = unauthorizedEx.Message;
                return false;
            }
        }
    }

    public sealed class ProjectsState
    {
        [JsonProperty("projects")]
        public List<ProjectInfo> Projects { get; set; } = new List<ProjectInfo>();

        [JsonProperty("activeProjectId")]
        public string ActiveProjectId { get; set; } = string.Empty;

        [JsonProperty("grokApiKey")]
        public string GrokApiKey { get; set; } = string.Empty;
    }

    public sealed class ProjectInfo
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("name")]
        public string Name { get; set; } = string.Empty;

        [JsonProperty("path")]
        public string Path { get; set; } = string.Empty;
    }
}
