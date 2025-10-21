using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;
using MatchReferee.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Rewrite;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

// Configure Firebase
FirebaseApp.Create(new AppOptions()
{
    Credential = GoogleCredential.FromFile("matchreferee-a9cd9-firebase-adminsdk-fbsvc-f99c236622.json"),
    ProjectId = builder.Configuration["Firebase:ProjectId"]
});

// Configure Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = $"https://securetoken.google.com/{builder.Configuration["Firebase:ProjectId"]}";
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = $"https://securetoken.google.com/{builder.Configuration["Firebase:ProjectId"]}",
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Firebase:ProjectId"],
            ValidateLifetime = true
        };
    });

// Configure FirebaseContext
builder.Services.AddSingleton<FirebaseService>();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", builder =>
    {
        builder.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

builder.Services.AddAuthorization();

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseCors("AllowAll");

// Serve static files (e.g., images, CSS, JS)
app.UseStaticFiles();

// Rewrite URLs
app.UseRewriter(new RewriteOptions()
    .AddRewrite("^/?$", "index.html", skipRemainingRules: true)
    .AddRewrite("^login/?$", "login.html", skipRemainingRules: true)
    .AddRewrite("^register/?$", "register.html", skipRemainingRules: true)
    .AddRewrite("^landing/?$", "landing.html", skipRemainingRules: true)
    .AddRewrite("^about/?$", "about.html", skipRemainingRules: true));

// Serve default files for directory requests
app.UseDefaultFiles(new DefaultFilesOptions
{
    DefaultFileNames = new List<string> { "index.html" }
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
