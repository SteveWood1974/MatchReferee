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
            Console.WriteLine("REGISTRATION: Request received");
            Console.WriteLine($"  Role: {request.Role}");
            Console.WriteLine($"  FirstName: {request.FirstName}");
            Console.WriteLine($"  FirstName: {request.LastName}");

            if (!ModelState.IsValid)
            {
                Console.WriteLine("REGISTRATION: ModelState invalid");
                return BadRequest(ModelState);
            }

            try
            {
                Console.WriteLine("REGISTRATION: Verifying token...");
                var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(request.IdToken);
                var uid = decodedToken.Uid;
                Console.WriteLine($"REGISTRATION: Token verified. UID = {uid}");

                Console.WriteLine("REGISTRATION: Checking existing user...");
                var existing = await _firebaseService.GetUserAsync(uid);
                if (existing != null)
                {
                    Console.WriteLine("REGISTRATION: User already exists");
                    return BadRequest("User already exists");
                }

                Console.WriteLine("REGISTRATION: Mapping role...");
                var role = request.Role.ToLower() switch
                {
                    "referee" => UserRole.Referee,
                    "coach" => UserRole.Coach,
                    "club" => UserRole.Club,
                    _ => throw new BadHttpRequestException("Invalid role")
                };
                Console.WriteLine($"REGISTRATION: Role mapped to {role}");

                Console.WriteLine("REGISTRATION: Creating UserProfile...");
                var userProfile = new UserProfile
                {
                    FirebaseUid = uid,
                    FirstName = request.FirstName,
                    LastName = request.LastName,
                    Role = role,
                    SubscriptionActive = false,
                    MaxLogins = role == UserRole.Club ? 0 : null
                };

                Console.WriteLine("REGISTRATION: Saving profile to DB...");
                await _firebaseService.CreateOrUpdateUserAsync(userProfile);

                Console.WriteLine("ModelState valid: " + ModelState.IsValid);
                if (!ModelState.IsValid)
                {
                    foreach (var err in ModelState.Values.SelectMany(v => v.Errors))
                        Console.WriteLine("Model error: " + err.ErrorMessage);
                }

                Console.WriteLine("REGISTRATION: Profile saved OK");

                Console.WriteLine("REGISTRATION: Setting custom claims...");
                var claims = new Dictionary<string, object>
        {
            { "role", request.Role.ToLower() }
        };
                if (role == UserRole.Coach || role == UserRole.Club)
                    claims["status"] = "payment_pending";
                else
                    claims["status"] = "active";

                await FirebaseAuth.DefaultInstance.SetCustomUserClaimsAsync(uid, claims);
                Console.WriteLine("REGISTRATION: Claims set OK");

                Console.WriteLine("REGISTRATION: Success");
                return Ok(new { Message = "User registered successfully" });
            }
            catch (FirebaseAuthException ex)
            {
                Console.WriteLine($"REGISTRATION ERROR (Auth): {ex.Message}");
                Console.WriteLine(ex.StackTrace);
                return BadRequest($"Firebase auth error: {ex.Message}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"REGISTRATION ERROR: {ex.Message}");
                Console.WriteLine(ex.StackTrace);
                return StatusCode(500, $"Internal error: {ex.Message}");
            }
        }

        // -----------------------------------------------------------------
        // REQUEST MODEL
        // -----------------------------------------------------------------
        public class RegisterRequest
        {
            public required string IdToken { get; set; }
            public required string FirstName { get; set; }
            public required string LastName { get; set; }
            public required string Role { get; set; }
        }
    }
}