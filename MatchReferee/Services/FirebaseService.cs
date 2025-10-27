// Services/FirebaseService.cs
using FirebaseAdmin;
using MatchReferee.Models;
using System.Text.Json;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Net.Http;
using System.Net.Http.Headers;

namespace MatchReferee.Services
{
    public class FirebaseService
    {
        private readonly FirebaseApp _firebaseApp;
        private readonly HttpClient _httpClient;
        private readonly string _databaseUrl;

        public FirebaseService()
        {
            _firebaseApp = FirebaseApp.DefaultInstance
                ?? throw new InvalidOperationException("FirebaseApp not initialized.");

            var projectId = _firebaseApp.Options.ProjectId;
            _databaseUrl = $"https://{projectId}-default-rtdb.europe-west1.firebasedatabase.app";

            _httpClient = new HttpClient();
        }

        private string GetUrl(string path) => $"{_databaseUrl}/{path}.json";

        // === GET USER ===
        public async Task<UserProfile?> GetUserAsync(string uid)
        {
            var url = GetUrl($"users/{uid}");
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
                return null;

            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<UserProfile>(json);
        }

        // === CREATE / UPDATE USER ===
        public async Task CreateOrUpdateUserAsync(UserProfile profile)
        {
            var url = GetUrl($"users/{profile.FirebaseUid}");
            var json = JsonSerializer.Serialize(profile);
            var content = new StringContent(json);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/json");

            await _httpClient.PutAsync(url, content);
        }

        // === AUTHORIZED EMAILS ===
        public async Task AddAuthorizedEmailAsync(string clubUid, string email)
        {
            var key = email.ToLower().Replace(".", "_").Replace("@", "_");
            var url = GetUrl($"authorized_emails/{key}");
            var data = new
            {
                clubUid,
                email = email.ToLower(),
                addedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };

            var json = JsonSerializer.Serialize(data);
            var content = new StringContent(json);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/json");

            await _httpClient.PutAsync(url, content);
        }

        public async Task<int> GetAuthorizedEmailCountAsync(string clubUid)
        {
            var url = GetUrl("authorized_emails") + $"?orderBy=\"clubUid\"&equalTo=\"{clubUid}\"";
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
                return 0;

            var json = await response.Content.ReadAsStringAsync();
            var dict = JsonSerializer.Deserialize<Dictionary<string, object>>(json);
            return dict?.Count ?? 0;
        }

        public async Task<List<string>> GetAuthorizedEmailsAsync(string clubUid)
        {
            var url = GetUrl("authorized_emails") + $"?orderBy=\"clubUid\"&equalTo=\"{clubUid}\"";
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
                return new List<string>();

            var json = await response.Content.ReadAsStringAsync();
            var dict = JsonSerializer.Deserialize<Dictionary<string, object>>(json);

            var emails = new List<string>();
            if (dict != null)
            {
                foreach (var kvp in dict)
                {
                    if (kvp.Value is JsonElement element && element.TryGetProperty("email", out var emailProp))
                    {
                        emails.Add(emailProp.GetString()!);
                    }
                }
            }
            return emails;
        }
    }
}