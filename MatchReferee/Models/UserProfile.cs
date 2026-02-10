// Models/UserProfile.cs
using System;
using System.Collections.Generic;

namespace MatchReferee.Models
{
    public class UserProfile
    {
        /// <summary>
        /// Firebase UID (primary key)
        /// </summary>
        public required string FirebaseUid { get; set; }

        /// <summary>
        /// User's display/full name
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Physical or postal address (optional)
        /// </summary>
        public string? Address { get; set; }

        /// <summary>
        /// Referee affiliation/registration number (required for referees)
        /// </summary>
        public string? AffiliationNumber { get; set; }

        /// <summary>
        /// Primary role of the user
        /// </summary>
        public UserRole Role { get; set; }

        /// <summary>
        /// Whether the subscription/payment is currently active
        /// </summary>
        public bool SubscriptionActive { get; set; } = false;

        /// <summary>
        /// Maximum number of allowed linked/logged-in users (for clubs)
        /// </summary>
        public int? MaxLogins { get; set; }

        // ───────────────────────────────────────────────
        // New fields added for profile completion
        // ───────────────────────────────────────────────

        /// <summary>
        /// Timestamp when the profile was first created
        /// </summary>
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        /// <summary>
        /// Timestamp of the last profile update
        /// </summary>
        public DateTimeOffset? UpdatedAt { get; set; }

        /// <summary>
        /// Whether the user has completed the detailed profile setup
        /// </summary>
        public bool? ProfileCompleted { get; set; }

        // ───────────────────────────────────────────────
        // Referee-specific fields
        // ───────────────────────────────────────────────

        /// <summary>
        /// Referee grading/level (e.g. "Level 6", "Supply")
        /// </summary>
        public string? RefereeLevel { get; set; }

        /// <summary>
        /// Number of years of refereeing experience
        /// </summary>
        public int? YearsExperience { get; set; }

        /// <summary>
        /// Regions/areas the referee is willing to cover
        /// </summary>
        public List<string>? Regions { get; set; }

        // ───────────────────────────────────────────────
        // Multi-role / secondary role flags
        // ───────────────────────────────────────────────

        /// <summary>
        /// True if this user also acts as a coach/team manager
        /// </summary>
        public bool IsCoach { get; set; }

        /// <summary>
        /// Team/age group the user mainly coaches (if IsCoach = true)
        /// </summary>
        public string? TeamAgeGroup { get; set; }

        /// <summary>
        /// True if this user also acts as a club representative/admin
        /// </summary>
        public bool IsClubRep { get; set; }

        // Optional future extensions (placeholders)
        // public string? PhoneNumber { get; set; }
        // public string? ProfilePhotoUrl { get; set; }
        // public Dictionary<string, bool> Availability { get; set; } = new();
    }

    public enum UserRole
    {
        Referee,
        Coach,
        Club
        // League can be added later if needed
    }
}