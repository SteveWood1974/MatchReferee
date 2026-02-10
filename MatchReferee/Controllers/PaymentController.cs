// Controllers/PaymentController.cs
using FirebaseAdmin.Auth;
using MatchReferee.Models;
using MatchReferee.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Stripe;
using Stripe.Checkout;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

namespace MatchReferee.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PaymentController : ControllerBase
    {
        private readonly IConfiguration _cfg;
        private readonly FirebaseService _firebaseService;

        public PaymentController(IConfiguration cfg, FirebaseService firebaseService)
        {
            _cfg = cfg;
            _firebaseService = firebaseService;

            StripeConfiguration.ApiKey = _cfg["Stripe:SecretKey"]
                ?? throw new InvalidOperationException("Stripe:SecretKey missing.");
        }

        [HttpGet("config")]
        [AllowAnonymous]
        public IActionResult GetConfig()
        {
            var publishableKey = _cfg["Stripe:PublishableKey"];  // FIXED
            if (string.IsNullOrEmpty(publishableKey))
                return StatusCode(500, "Stripe publishable key not configured.");

            return Ok(new { PublishableKey = publishableKey });
        }

        [HttpPost("create-session")]
        [Authorize]
        public async Task<IActionResult> CreateSession([FromBody] SubscriptionRequest? request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Tier))
                return BadRequest("Tier is required.");

            var uid = User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(uid))
                return Unauthorized();

            var profile = await _firebaseService.GetUserAsync(uid);
            if (profile == null)
                return Unauthorized();

            string? priceId = (profile.Role, request.Tier.ToLower()) switch
            {
                (UserRole.Coach, "coach") => _cfg["Stripe:PriceId_Coach"],
                (UserRole.Club, "1-4") => _cfg["Stripe:PriceId_1_4"],
                (UserRole.Club, "5-9") => _cfg["Stripe:PriceId_5_9"],
                (UserRole.Club, "10+") => _cfg["Stripe:PriceId_10Plus"],
                _ => null
            };

            if (string.IsNullOrEmpty(priceId))
                return BadRequest("Invalid tier for your role.");

            var firebaseUser = await FirebaseAuth.DefaultInstance.GetUserAsync(uid);

            var sessionOptions = new SessionCreateOptions
            {
                CustomerEmail = firebaseUser.Email,
                PaymentMethodTypes = new List<string> { "card" },
                Mode = "subscription",
                LineItems = new List<SessionLineItemOptions>
                {
                    new SessionLineItemOptions
                    {
                        Price = priceId,
                        Quantity = 1
                    }
                },
                SuccessUrl = $"{Request.Scheme}://{Request.Host}/payment-success.html?session_id={{CHECKOUT_SESSION_ID}}",
                CancelUrl = $"{Request.Scheme}://{Request.Host}/payment-cancel.html",
                Metadata = new Dictionary<string, string>
                {
                    { "uid", uid },
                    { "role", profile.Role.ToString().ToLower() }
                }
            };

            var session = await new SessionService().CreateAsync(sessionOptions);
            return Ok(new { SessionId = session.Id });
        }

        [HttpPost("webhook")]
        public async Task<IActionResult> Webhook()
        {
            var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
            Event stripeEvent;

            try
            {
                stripeEvent = EventUtility.ConstructEvent(
                    json,
                    Request.Headers["Stripe-Signature"],
                    _cfg["Stripe:WebhookSecret"] ?? throw new InvalidOperationException("Webhook secret missing."));
            }
            catch (StripeException ex)
            {
                return BadRequest($"Webhook error: {ex.Message}");
            }

            if (stripeEvent.Type == "checkout.session.completed")
            {
                var session = stripeEvent.Data.Object as Session;
                if (session?.CustomerEmail == null) return Ok();

                try
                {
                    var firebaseUser = await FirebaseAuth.DefaultInstance.GetUserByEmailAsync(session.CustomerEmail);
                    var profile = await _firebaseService.GetUserAsync(firebaseUser.Uid);

                    if (profile == null) return Ok();

                    var priceId = session.LineItems?.Data?[0]?.Price?.Id;

                    if (profile.Role == UserRole.Coach && priceId == _cfg["Stripe:PriceId_Coach"])
                    {
                        profile.SubscriptionActive = true;
                        await _firebaseService.CreateOrUpdateUserAsync(profile);

                        await FirebaseAuth.DefaultInstance.SetCustomUserClaimsAsync(
                            firebaseUser.Uid,
                            new Dictionary<string, object> { { "status", "active" } });
                    }
                    else if (profile.Role == UserRole.Club)
                    {
                        profile.MaxLogins = priceId switch
                        {
                            var p when p == _cfg["Stripe:PriceId_1_4"] => 4,
                            var p when p == _cfg["Stripe:PriceId_5_9"] => 9,
                            _ => 999
                        };
                        profile.SubscriptionActive = true;
                        await _firebaseService.CreateOrUpdateUserAsync(profile);

                        await FirebaseAuth.DefaultInstance.SetCustomUserClaimsAsync(
                            firebaseUser.Uid,
                            new Dictionary<string, object> { { "status", "active" } });
                    }
                }
                catch (System.Exception ex)
                {
                    Console.WriteLine($"[Webhook Error] {ex.Message}");
                }
            }

            return Ok();
        }
    }

    public class SubscriptionRequest
    {
        public string? Tier { get; set; }
    }
}