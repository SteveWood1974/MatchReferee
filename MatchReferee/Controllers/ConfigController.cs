using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace MatchReferee.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ConfigController : ControllerBase
    {
        private readonly IConfiguration _config;

        public ConfigController(IConfiguration config)
        {
            _config = config;
        }

        [HttpGet("firebase")]
        [AllowAnonymous]  // Public endpoint
        public IActionResult GetFirebaseConfig()
        {
            return Ok(new
            {
                apiKey = _config["FirebaseConfig:ApiKey"],
                authDomain = _config["FirebaseConfig:AuthDomain"],
                projectId = _config["FirebaseConfig:ProjectId"],
                storageBucket = _config["FirebaseConfig:StorageBucket"],
                messagingSenderId = _config["FirebaseConfig:MessagingSenderId"],
                appId = _config["FirebaseConfig:AppId"],
                measurementId = _config["FirebaseConfig:MeasurementId"]
            });
        }
    }
}