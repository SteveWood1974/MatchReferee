namespace MatchReferee.Models
{
    public class UserProfile
    {
        public required string FirebaseUid { get; set; }
        public string? Name { get; set; }
        public string? Address { get; set; }
        public string? AffiliationNumber { get; set; }
        public UserRole Role { get; set; }
        public bool SubscriptionActive { get; set; } = false;
        public int? MaxLogins { get; set; }
    }

    public enum UserRole
    {
        Referee,
        Coach,
        Club
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