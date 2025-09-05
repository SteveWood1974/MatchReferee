using FirebaseAdmin.Auth;
using Microsoft.AspNetCore.Mvc;
using MatchReferee.Data;
using MatchReferee.Models;

namespace MatchReferee.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly MatchRefereeContext _context;

        public AuthController(MatchRefereeContext context)
        {
            _context = context;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            try
            {
                // Verify Firebase token
                var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(request.IdToken);
                var uid = decodedToken.Uid;

                // Check if user already exists
                var existingUser = _context.UserProfiles.FirstOrDefault(u => u.FirebaseUid == uid);
                if (existingUser != null)
                {
                    return BadRequest("User already exists");
                }

                // Create new user profile
                var userProfile = new UserProfile
                {
                    FirebaseUid = uid,
                    Name = request.Name,
                    Address = request.Address,
                    AffiliationNumber = request.AffiliationNumber,
                    Role = request.Role
                };

                _context.UserProfiles.Add(userProfile);
                await _context.SaveChangesAsync();

                return Ok(new { Message = "User registered successfully" });
            }
            catch (Exception ex)
            {
                return BadRequest($"Registration failed: {ex.Message}");
            }
        }
    }

    public class RegisterRequest
    {
        public string IdToken { get; set; }
        public string Name { get; set; }
        public string Address { get; set; }
        public string AffiliationNumber { get; set; }
        public UserRole Role { get; set; }
    }
}
