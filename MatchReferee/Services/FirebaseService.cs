using Firebase.Database;
using Firebase.Database.Query;
using MatchReferee.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace MatchReferee.Services
{
    public class FirebaseService
    {
        private readonly FirebaseClient _firebase;

        public FirebaseService()
        {
            _firebase = new FirebaseClient("https://matchreferee-a9cd9-default-rtdb.firebaseio.com/");
        }

        // USERS
        public async Task<UserProfile?> GetUserAsync(string uid)
        {
            return await _firebase
                .Child("users")
                .Child(uid)
                .OnceSingleAsync<UserProfile>();
        }

        public async Task CreateOrUpdateUserAsync(UserProfile profile)
        {
            await _firebase
                .Child("users")
                .Child(profile.FirebaseUid)
                .PutAsync(profile);
        }

        // AUTHORIZED EMAILS
        public async Task AddAuthorizedEmailAsync(string clubUid, string email)
        {
            var key = email.ToLower().Replace(".", "_").Replace("@", "_");
            await _firebase
                .Child("authorized_emails")
                .Child(key)
                .PutAsync(new
                {
                    clubUid,
                    email = email.ToLower(),
                    addedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                });
        }

        public async Task<int> GetAuthorizedEmailCountAsync(string clubUid)
        {
            var snapshot = await _firebase
                .Child("authorized_emails")
                .OrderBy("clubUid")
                .EqualTo(clubUid)
                .OnceAsync<object>();

            return snapshot.Count;
        }

        public async Task<List<string>> GetAuthorizedEmailsAsync(string clubUid)
        {
            var snapshot = await _firebase
                .Child("authorized_emails")
                .OrderBy("clubUid")
                .EqualTo(clubUid)
                .OnceAsync<Dictionary<string, object>>();

            return snapshot
                .Select(x => x.Object["email"]?.ToString())
                .Where(e => e != null)
                .ToList()!;
        }
    }
}