using FirebaseAdmin.Auth;
using Firebase.Database;
using Firebase.Database.Query;
using MatchReferee.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace MatchReferee.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly FirebaseClient _firebase;

        public AuthController()
        {
            _firebase = new FirebaseClient("https://matchreferee-a9cd9-default-rtdb.firebaseio.com/");
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            try
            {
                // Verify Firebase token
                var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(request.IdToken);
                var uid = decodedToken.Uid;

                // Check if user already exists in Realtime DB
                var existingUser = await _firebase
                    .Child("users")
                    .Child(uid)
                    .OnceSingleAsync<UserProfile>();

                if (existingUser != null)
                    return BadRequest("User already exists");

                // Create new user profile
                var userProfile = new UserProfile
                {
                    FirebaseUid = uid,
                    Name = request.Name,
                    Address = request.Address,
                    AffiliationNumber = request.AffiliationNumber,
                    Role = request.Role,
                    SubscriptionActive = false,
                    MaxLogins = request.Role == UserRole.Club ? 0 : null
                };

                // Save to Firebase Realtime DB
                await _firebase
                    .Child("users")
                    .Child(uid)
                    .PutAsync(userProfile);

                // Set custom claims
                var claims = new Dictionary<string, object>
                {
                    { "role", request.Role.ToString().ToLower() }
                };

                if (request.Role == UserRole.Coach)
                    claims["status"] = "pending";
                else if (request.Role == UserRole.Club)
                    claims["status"] = "payment_pending";
                else
                    claims["status"] = "active";

                await FirebaseAuth.DefaultInstance.SetCustomUserClaimsAsync(uid, claims);

                return Ok(new { Message = "User registered successfully", Role = request.Role });
            }
            catch (Exception ex)
            {
                return BadRequest($"Registration failed: {ex.Message}");
            }
        }

        [HttpPost("authorize-coach")]
        [Authorize]
        public async Task<IActionResult> AuthorizeCoach([FromBody] AuthorizeRequest request)
        {
            var uid = User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(uid)) return Unauthorized();

            // Get club profile
            var club = await _firebase
                .Child("users")
                .Child(uid)
                .OnceSingleAsync<UserProfile>();

            if (club == null || club.Role != UserRole.Club || !club.SubscriptionActive)
                return Unauthorized();

            // Count current authorized coaches
            var authorizedEmails = await _firebase
                .Child("authorized_emails")
                .OrderBy("clubUid")
                .EqualTo(uid)
                .OnceAsync<Dictionary<string, object>>();

            if (authorizedEmails.Count >= (club.MaxLogins ?? 0))
                return BadRequest("Max logins reached");

            // Add new authorized email
            var emailKey = request.Email.ToLower().Replace(".", "_").Replace("@", "_");
            await _firebase
                .Child("authorized_emails")
                .Child(emailKey)
                .PutAsync(new
                {
                    clubUid = uid,
                    email = request.Email.ToLower(),
                    addedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                });

            // Update coach status if they exist
            try
            {
                var firebaseUser = await FirebaseAuth.DefaultInstance.GetUserByEmailAsync(request.Email);
                var coach = await _firebase
                    .Child("users")
                    .Child(firebaseUser.Uid)
                    .OnceSingleAsync<UserProfile>();

                if (coach != null && coach.Role == UserRole.Coach)
                {
                    await FirebaseAuth.DefaultInstance.SetCustomUserClaimsAsync(
                        firebaseUser.Uid,
                        new Dictionary<string, object> { { "status", "active" } });
                }
            }
            catch (FirebaseAuthException)
            {
                // Coach not signed up yet — that's fine
            }

            return Ok(new { Message = "Coach authorized successfully" });
        }
    }

    // === REQUEST MODELS ===
    public class RegisterRequest
    {
        public required string IdToken { get; set; }
        public string? Name { get; set; }
        public string? Address { get; set; }
        public string? AffiliationNumber { get; set; }
        public UserRole Role { get; set; }
    }

    public class AuthorizeRequest
    {
        public required string Email { get; set; }
    }
}