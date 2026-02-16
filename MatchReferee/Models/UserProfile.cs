using System;
using System.Collections.Generic;

namespace MatchReferee.Models
{
    public class UserProfile
    {
        public required string FirebaseUid { get; set; }

        public string? Name { get; set; }                 // ← matches fullName

        // ── Added from HTML form ─────────────────────────────────────────────
        public string? PhoneNumber { get; set; }          // was commented out → now active
        public string? Postcode { get; set; }             // or could merge into Address
        public string? AgeRange { get; set; }             // e.g. "18-24", "Prefer not to say"
        public string? Gender { get; set; }
        public string? Pronouns { get; set; }
        public string? Bio { get; set; }
        public string? ProfilePhotoUrl { get; set; }      // URL after upload

        // ── Existing + slightly renamed for clarity ─────────────────────────
        public string? Address { get; set; }              // full address (optional)
        public string? AffiliationNumber { get; set; }
        public UserRole Role { get; set; }

        public bool SubscriptionActive { get; set; } = false;
        public int? MaxLogins { get; set; }

        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset? UpdatedAt { get; set; }
        public bool? ProfileCompleted { get; set; }

        // Referee-specific
        public string? RefereeLevel { get; set; }
        public int? YearsExperience { get; set; }
        public List<string>? Regions { get; set; }

        // Multi-role flags
        public bool IsCoach { get; set; }
        public string? TeamAgeGroup { get; set; }
        public bool IsClubRep { get; set; }

        // Optional: future
        // public Dictionary<string, bool> Availability { get; set; } = new();
    }

    public enum UserRole
    {
        Referee,
        Coach,
        Club,
        League
    }
}