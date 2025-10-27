using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;           // Correct
using MatchReferee.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Rewrite;
using System.Text.Json.Serialization;
using System.IO;                        // For File.Exists
using System.Collections.Generic;      // For List<string>

// ===============================================
// 1. BUILDER & ENVIRONMENT VARIABLE SETUP
// ===============================================

var builder = WebApplication.CreateBuilder(args);

// --- DEBUG: Show where we're looking for the file ---
var path = Environment.GetEnvironmentVariable("FIREBASE_CREDENTIALS_PATH");
Console.WriteLine($"Looking for: {path}");
if (path != null && File.Exists(path))
    Console.WriteLine("FILE FOUND!");
else
    Console.WriteLine("FILE NOT FOUND!");

// --- LOAD FIREBASE CREDENTIALS SECURELY ---
GoogleCredential credential;

if (!string.IsNullOrWhiteSpace(path) && File.Exists(path))
{
    credential = GoogleCredential.FromFile(path);
}
else
{
    // Optional: Allow full JSON via env var (e.g., Docker secrets)
    var json = Environment.GetEnvironmentVariable("FIREBASE_CREDENTIALS_JSON");
    if (!string.IsNullOrWhiteSpace(json))
    {
        credential = GoogleCredential.FromJson(json);
    }
    else
    {
        throw new InvalidOperationException(
            "Firebase credentials not found. Set FIREBASE_CREDENTIALS_PATH to a valid JSON file " +
            "or set FIREBASE_CREDENTIALS_JSON with the full service account JSON.");
    }
}

// ===============================================
// 2. CONFIGURE SERVICES
// ===============================================

// Add controllers with JSON options
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

// Configure Firebase with secure credentials
FirebaseApp.Create(new AppOptions()
{
    Credential = credential,
    ProjectId = builder.Configuration["Firebase:ProjectId"]
});

// Configure JWT Bearer Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var projectId = builder.Configuration["Firebase:ProjectId"];
        options.Authority = $"https://securetoken.google.com/{projectId}";
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = $"https://securetoken.google.com/{projectId}",
            ValidateAudience = true,
            ValidAudience = projectId,
            ValidateLifetime = true
        };
    });

// Register FirebaseService
builder.Services.AddSingleton<FirebaseService>();
builder.Services.AddHttpClient();

// CORS Policy
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", builder =>
    {
        builder.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

builder.Services.AddAuthorization();

// ===============================================
// 3. BUILD & CONFIGURE APP
// ===============================================
var app = builder.Build();
app.UseHttpsRedirection();
app.UseHsts();

// Configure HTTP pipeline
app.UseCors("AllowAll");

// URL Rewriting
app.UseRewriter(new RewriteOptions()
    //Top level
    .AddRewrite("^/?$", "index.html", skipRemainingRules: true)
    .AddRewrite("^signin/?$", "signin.html", skipRemainingRules: true)
    .AddRewrite("^register/?$", "register.html", skipRemainingRules: true)
    .AddRewrite("^about/?$", "about.html", skipRemainingRules: true)
    .AddRewrite("^referees/?$", "referees.html", skipRemainingRules: true)
    .AddRewrite("^coaches/?$", "coaches.html", skipRemainingRules: true)
    .AddRewrite("^clubs/?$", "clubs.html", skipRemainingRules: true)
    .AddRewrite("^leagues/?$", "leagues.html", skipRemainingRules: true)

    //Registration URLs
    .AddRewrite("^register/referee/?$", "register-referee.html", skipRemainingRules: true)
    .AddRewrite("^register/coach/?$", "register-coach.html", skipRemainingRules: true)
    .AddRewrite("^register/club/?$", "register-club.html", skipRemainingRules: true)

    //Secure URLs
    .AddRewrite("^secure/landing/?$", "landing.html", skipRemainingRules: true)
    );

// Default files
app.UseDefaultFiles(new DefaultFilesOptions
{
    DefaultFileNames = new List<string> { "index.html" }
});

app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();