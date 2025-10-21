namespace MatchReferee.Models
{
    public class UserProfile
    {
        public int Id { get; set; }
        public required string FirebaseUid { get; set; }
        public string? Name { get; set; }
        public string? Address { get; set; }
        public string? AffiliationNumber { get; set; }
        public UserRole Role { get; set; }

        // New: For Clubs
        public int? MaxLogins { get; set; }  // Based on subscription tier (1-4, 5-9, 10+)
        public bool SubscriptionActive { get; set; } = false;
    }

    public enum UserRole
    {
        Referee,
        Coach,
        Club,
        League,
        Support,
        Admin
    }

    // New: For coach authorization
    public class AuthorizedEmail
    {
        public int Id { get; set; }
        public int ClubId { get; set; }  // Foreign key to UserProfile (Club)
        public string? Email { get; set; }
        public UserProfile? Club { get; set; }
    }
}