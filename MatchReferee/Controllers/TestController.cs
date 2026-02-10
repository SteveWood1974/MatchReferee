using Microsoft.AspNetCore.Mvc;

namespace MatchReferee.Controllers
{
    [Route("api/test")]
    [ApiController]
    public class TestController : ControllerBase
    {
        [HttpGet]
        public IActionResult Get()
        {
            return Ok(new { message = "Test controller is alive", time = DateTime.UtcNow });
        }
    }
}