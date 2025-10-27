// Controllers/AuthController.cs
using FirebaseAdmin;
using FirebaseAdmin.Auth;
using MatchReferee.Models;
using MatchReferee.Services;          // <-- FirebaseService lives here
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace MatchReferee.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly FirebaseService _firebaseService;

        // DI – FirebaseService is registered as a singleton in Program.cs
        public AuthController(FirebaseService firebaseService)
        {
            _firebaseService = firebaseService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                // 1. Verify Firebase ID token
                var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(request.IdToken);
                var uid = decodedToken.Uid;

                // 2. Check if user already exists (via service)
                var existing = await _firebaseService.GetUserAsync(uid);
                if (existing != null)
                    return BadRequest("User already exists");

                // 3. Convert Role string → enum
                var role = request.Role.ToLower() switch
                {
                    "referee" => UserRole.Referee,
                    "coach" => UserRole.Coach,
                    "club" => UserRole.Club,
                    _ => throw new BadHttpRequestException("Invalid role. Must be 'Referee', 'Coach', or 'Club'.")
                };

                // 4. Build UserProfile
                var userProfile = new UserProfile
                {
                    FirebaseUid = uid,
                    Name = request.Name,
                    Address = request.Address,
                    AffiliationNumber = request.AffiliationNumber,
                    Role = role,
                    SubscriptionActive = false,
                    MaxLogins = role == UserRole.Club ? 0 : null
                };

                // 5. Save to Realtime DB (via FirebaseService – REST)
                await _firebaseService.CreateOrUpdateUserAsync(userProfile);

                // 6. Set custom claims
                var claims = new Dictionary<string, object>
                {
                    { "role", request.Role.ToLower() }
                };

                if (role == UserRole.Coach)
                {
                    claims["status"] = "payment_pending";  // Coach must pay
                }
                else if (role == UserRole.Club)
                {
                    claims["status"] = "payment_pending";  // Club pays later
                }
                else // Referee
                {
                    claims["status"] = "active";
                    userProfile.SubscriptionActive = true;
                }

                await FirebaseAuth.DefaultInstance.SetCustomUserClaimsAsync(uid, claims);

                return Ok(new { Message = "User registered successfully" });
            }
            catch (FirebaseAuthException ex)
            {
                return BadRequest($"Firebase auth error: {ex.Message}");
            }
            catch (BadHttpRequestException)
            {
                return BadRequest("Invalid role");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal error: {ex.Message}");
            }
        }

        // -----------------------------------------------------------------
        // REQUEST MODEL
        // -----------------------------------------------------------------
        public class RegisterRequest
        {
            public required string IdToken { get; set; }
            public required string Name { get; set; }
            public required string Address { get; set; }
            public string? AffiliationNumber { get; set; }
            public required string Role { get; set; }
        }
    }
}