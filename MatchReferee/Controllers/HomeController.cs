using MatchReferee.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace MatchReferee.Controllers
{
    [Route("api/landing")]
    [ApiController]
    public class LandingController : ControllerBase
    {
        [HttpGet("landing")]
        [Authorize]
        public IActionResult GetLandingPage()
        {
            var uid = User.FindFirst("sub")?.Value;
            return Ok(new { Message = $"Welcome to MatchReferee, {uid}!" });
        }
    }
}
