// Controllers/ProfileController.cs
using FirebaseAdmin;
using FirebaseAdmin.Auth;
using MatchReferee.Models;
using MatchReferee.Services;          // <-- FirebaseService lives here
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace MatchReferee.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]   // Requires valid Firebase JWT
    public class ProfileController : ControllerBase
    {
        private readonly FirebaseService _firebaseService;

        public ProfileController(FirebaseService firebaseService)
        {
            _firebaseService = firebaseService ?? throw new ArgumentNullException(nameof(firebaseService));
        }

        /// <summary>
        /// Gets the current user's profile from the Realtime Database.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetProfile()
        {
            try
            {
                // Get UID from the validated Firebase JWT (set by JwtBearer middleware)
                string? uid = User.FindFirst("user_id")?.Value
                           ?? User.FindFirst("sub")?.Value;

                if (string.IsNullOrEmpty(uid))
                {
                    return Unauthorized("User ID not found in token.");
                }

                // Fetch profile from Realtime DB
                UserProfile? profile = await _firebaseService.GetUserAsync(uid);

                if (profile == null)
                {
                    return NotFound("Profile not found.");
                }

                // Return a safe, client-friendly version of the profile
                var response = new
                {
                    Name = profile.Name,
                    Email = User.Identity?.Name,  // from token (usually email)
                    Role = profile.Role.ToString(),
                    SubscriptionActive = profile.SubscriptionActive,
                    MaxLogins = profile.MaxLogins,
                    AffiliationNumber = profile.AffiliationNumber,
                    Address = profile.Address,
                    CreatedAt = profile.CreatedAt,
                    // Add more fields here when you extend UserProfile
                    ProfileCompleted = profile.ProfileCompleted ?? false
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                // In production: log the exception
                Console.Error.WriteLine($"GetProfile failed: {ex.Message}");
                return StatusCode(500, "An error occurred while retrieving your profile.");
            }
        }

        /// <summary>
        /// Updates the current user's profile.
        /// Can be used for initial profile completion or later edits.
        /// </summary>
        [HttpPost("update")]
        public async Task<IActionResult> UpdateProfile([FromBody] ProfileUpdateRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                // Get UID from token
                string? uid = User.FindFirst("user_id")?.Value
                           ?? User.FindFirst("sub")?.Value;

                if (string.IsNullOrEmpty(uid))
                {
                    return Unauthorized("User ID not found in token.");
                }

                // Fetch existing profile
                UserProfile? profile = await _firebaseService.GetUserAsync(uid);
                if (profile == null)
                {
                    return NotFound("Profile not found.");
                }

                // Update allowed fields (never let client overwrite critical fields like Role, FirebaseUid)
                if (!string.IsNullOrWhiteSpace(request.Name))
                    profile.Name = request.Name.Trim();

                if (request.Address != null)
                    profile.Address = request.Address.Trim();

                // Referee-specific fields
                if (profile.Role == UserRole.Referee)
                {
                    if (!string.IsNullOrWhiteSpace(request.AffiliationNumber))
                        profile.AffiliationNumber = request.AffiliationNumber.Trim();

                    if (!string.IsNullOrWhiteSpace(request.RefereeLevel))
                        profile.RefereeLevel = request.RefereeLevel.Trim();

                    if (request.YearsExperience.HasValue)
                        profile.YearsExperience = request.YearsExperience.Value;

                    if (request.Regions != null && request.Regions.Count > 0)
                        profile.Regions = request.Regions;
                }

                // Multi-role flags
                if (request.IsCoach.HasValue)
                    profile.IsCoach = request.IsCoach.Value;

                if (request.IsClubRep.HasValue)
                    profile.IsClubRep = request.IsClubRep.Value;

                if (!string.IsNullOrWhiteSpace(request.TeamAgeGroup))
                    profile.TeamAgeGroup = request.TeamAgeGroup.Trim();

                // Mark as completed
                profile.ProfileCompleted = true;
                profile.UpdatedAt = DateTimeOffset.UtcNow;

                // Save changes
                await _firebaseService.CreateOrUpdateUserAsync(profile);

                return Ok(new { Message = "Profile updated successfully" });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"UpdateProfile failed: {ex.Message}");
                return StatusCode(500, "An error occurred while updating your profile.");
            }
        }

        // -------------------------------------------------------------------------
        //  DTOs for requests
        // -------------------------------------------------------------------------

        public class ProfileUpdateRequest
        {
            public string? Name { get; set; }
            public string? Address { get; set; }
            public string? AffiliationNumber { get; set; }      // only for referees
            public string? RefereeLevel { get; set; }           // e.g. "Level 6"
            public int? YearsExperience { get; set; }
            public List<string>? Regions { get; set; }          // e.g. ["North", "Midlands"]
            public bool? IsCoach { get; set; }
            public string? TeamAgeGroup { get; set; }           // e.g. "U14 Boys"
            public bool? IsClubRep { get; set; }
        }
    }
}