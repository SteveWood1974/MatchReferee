using Microsoft.EntityFrameworkCore;
using MatchReferee.Models;

namespace MatchReferee.Data
{
    public class MatchRefereeContext : DbContext
    {
        public MatchRefereeContext(DbContextOptions<MatchRefereeContext> options)
            : base(options)
        {
        }

        public DbSet<UserProfile> UserProfiles { get; set; }
    }
}
