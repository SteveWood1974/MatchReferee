using FirebaseAdmin.Auth;
using Firebase.Database;
using Firebase.Database.Query;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Stripe;
using Stripe.Checkout;
using MatchReferee.Models;
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
        private readonly FirebaseClient _firebase;

        public PaymentController(IConfiguration cfg)
        {
            _cfg = cfg;
            _firebase = new FirebaseClient("https://matchreferee-a9cd9-default-rtdb.firebaseio.com/");
            StripeConfiguration.ApiKey = _cfg["Stripe:SecretKey"] ?? throw new InvalidOperationException("Stripe:SecretKey missing.");
        }

        // GET: /api/payment/config → For frontend
        [HttpGet("config")]
        [AllowAnonymous]
        public IActionResult GetConfig()
        {
            var publishableKey = _cfg["Stripe:PublishableKey"];
            if (string.IsNullOrEmpty(publishableKey))
                return StatusCode(500, "Stripe publishable key not configured.");

            return Ok(new { PublishableKey = publishableKey });
        }

        // POST: /api/payment/create-session → Start checkout
        [HttpPost("create-session")]
        [Authorize]
        public async Task<IActionResult> CreateSession([FromBody] SubscriptionRequest? request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Tier))
                return BadRequest("Invalid request: Tier is required.");

            var uid = User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(uid))
                return Unauthorized();

            var clubProfile = await _firebase
                .Child("users")
                .Child(uid)
                .OnceSingleAsync<UserProfile>();

            if (clubProfile == null || clubProfile.Role != UserRole.Club)
                return Unauthorized("Only clubs can create payment sessions.");

            // Map tier to price ID and max logins
            var (priceId, maxLogins) = request.Tier switch
            {
                "1-4" => (_cfg["Stripe:PriceId_1_4"], 4),
                "5-9" => (_cfg["Stripe:PriceId_5_9"], 9),
                "10+" => (_cfg["Stripe:PriceId_10Plus"], 999),
                _ => (null, 0)
            };

            if (string.IsNullOrEmpty(priceId))
                return BadRequest($"Invalid tier: {request.Tier}");

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
                CancelUrl = $"{Request.Scheme}://{Request.Host}/payment-cancel.html"
            };

            var session = await new SessionService().CreateAsync(sessionOptions);
            return Ok(new { SessionId = session.Id });
        }

        // POST: /api/payment/webhook → Stripe events
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
                    var profile = await _firebase
                        .Child("users")
                        .Child(firebaseUser.Uid)
                        .OnceSingleAsync<UserProfile>();

                    if (profile != null && profile.Role == UserRole.Club)
                    {
                        var priceId = session.LineItems?.Data?[0]?.Price?.Id;

                        profile.MaxLogins = priceId switch
                        {
                            var p when p == _cfg["Stripe:PriceId_1_4"] => 4,
                            var p when p == _cfg["Stripe:PriceId_5_9"] => 9,
                            _ => 999
                        };
                        profile.SubscriptionActive = true;

                        // Save back to Firebase
                        await _firebase
                            .Child("users")
                            .Child(firebaseUser.Uid)
                            .PutAsync(profile);

                        // Update Firebase Auth custom claim
                        await FirebaseAuth.DefaultInstance.SetCustomUserClaimsAsync(
                            firebaseUser.Uid,
                            new Dictionary<string, object>
                            {
                                { "status", "active" }
                            });
                    }
                }
                catch (System.Exception ex)
                {
                    // Never fail the webhook
                    Console.WriteLine($"[Webhook Error] {ex.Message}");
                }
            }

            // Always return 200 OK to Stripe
            return Ok();
        }
    }

    // Request DTO
    public class SubscriptionRequest
    {
        public string? Tier { get; set; }
    }
}