using MatchReferee.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace MatchReferee.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class HomeController : ControllerBase
    {
        [HttpGet("landing")]
        [Authorize]
        public IActionResult GetLandingPage()
        {
            var userId = User.FindFirst("user_id")?.Value;
            return Ok(new { Message = $"Welcome to MatchReferee, {userId}!" });
        }
    }
}
