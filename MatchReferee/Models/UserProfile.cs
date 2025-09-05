namespace MatchReferee.Models
{
    public class UserProfile
    {
        public int Id { get; set; }
        public string FirebaseUid { get; set; }
        public string Name { get; set; }
        public string Address { get; set; }
        public string AffiliationNumber { get; set; }
        public UserRole Role { get; set; }
    }

    public enum UserRole
    {
        Coach,
        Referee,
        LeagueAdministrator,
        SystemAdministrator
    }
}
