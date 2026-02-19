# Match Referee

**The platform built by football people, for football people.**

Picture this:  
It’s Saturday at 8:17 a.m.  
Your phone buzzes again — another referee has pulled out last minute.  
The parents are already arriving, the kids are buzzing, but there’s no official.  
You’re texting mates, calling around, promising favours you can’t keep…  
Sound familiar?

We’ve all been there.

That’s why **Match Referee** exists.

We’re a small team who’ve spent years refereeing, coaching under-11s, running Sunday league sides, and volunteering at grassroots clubs. We know the heartache of no-shows, the stress of chasing payments, the embarrassment of asking the same overworked ref week after week. We’ve lived it.

So we decided to fix it — properly.

No middlemen.  
No crazy fees.  
Just a straightforward way for coaches to find reliable referees who actually turn up, and for referees to get the games they want without the endless WhatsApp groups and awkward follow-ups.

### For Referees – Take Back Your Weekends

Imagine opening your phone on a Tuesday evening and seeing only matches that actually suit you:  
right distance, right level, right day.  
No more spam. No more “sorry mate, already booked”.  

You pick the game you want, get instant confirmation, see the coach’s reliability score (just like they see yours), chat about the pitch markings, and get polite reminders so nothing gets forgotten.

After the whistle?  
Leave honest feedback, earn badges for being early, fair, and dependable.  
Watch your profile grow stronger — more bookings, better games, real respect from the people you work with.

It’s not just extra matches.  
It’s feeling valued again.

**Free to join. No subscription.**

### For Coaches – Focus on the Kids, Not the Chaos

You already give up your Saturday mornings.  
The last thing you need is spending Friday night begging for a ref.

With Match Referee you post the fixture once — pitch, kick-off, level, fee, even your quirky club rules.  
Verified local referees see it and claim it.  
Double confirmation + 48-hour and 2-hour reminders mean 9 out of 10 actually show up.  

You can filter for 4+ star refs, re-book your favourites, avoid the ones who let you down before.  
Chat in-app about where to park or which goalposts are wonky.  
After the game, rate them honestly — it helps everyone.

Suddenly your weekends feel lighter.  
More time warming up the team, less time panicking.

**Free for coaches too.**

### For Clubs – Make Every Saturday Feel Organised

Clubs run on goodwill and volunteers who are already stretched thin.  
When referees cancel, the whole day unravels — unhappy parents, stressed coaches, kids who lose confidence.

Give your club its own branded page on Match Referee.  
Coaches post games in seconds.  
Refs apply directly.  
You set the club’s standard fees, pitch rules, parking notes — once.  

Auto-reminders keep attendance sky-high.  
Everyone looks professional.  
Parents notice.  
Coaches stay longer because the admin burden disappears.

From just £20 a month — it pays for itself the first time you avoid a cancellation disaster.

### We’re Just Getting Started

The site launches properly on **1 July 2026** (we’re counting down the days).  
Right now it’s pre-launch — sign up early so you’re first in line when we open the doors.

Come join us.  
Let’s make grassroots football feel like it should again:  
fun, fair, and actually about the game.

→ [Sign up as a Referee](https://matchreferee.co.uk/register/referee)  
→ [Sign up as a Coach](https://matchreferee.co.uk/register/coach)  
→ [Bring Your Club On Board](https://matchreferee.co.uk/register/club)

Built with love for the beautiful game — and a serious dislike of Saturday morning stress.

See you on the touchline.

Steve & the Match Referee team  
https://matchreferee.co.uk  
https://github.com/SteveWood1974/MatchReferee


MatchReferee/ (repo root)
├── .gitattributes
├── .gitignore
├── MatchReferee.sln
│
└── MatchReferee/                  ← Main ASP.NET Core project
    ├── Controllers/               ← API endpoints (AuthController, ProfileController, etc.)
    ├── Models/
    ├── Services/                  ← Business logic (e.g. FirebaseService)
    ├── Properties/                ← launchSettings.json, etc.
    ├── Data/                      ← Placeholder folder (declared in .csproj)
    ├── wwwroot/                   ← ALL web site files (static frontend)
    │   ├── css/
    │   ├── img/                   ← (or images/ in some references)
    │   ├── js/
    │   ├── parts/
    │   ├── public/                ← Marketing & public pages
    │   │   ├── about.html
    │   │   ├── register.html
    │   │   ├── signin.html
    │   │   ├── referees.html
    │   │   ├── coaches.html
    │   │   ├── clubs.html
    │   │   ├── leagues.html
    │   │   ├── register-referee.html
    │   │   ├── register-coach.html
    │   │   ├── register-club.html
    │   │   ├── register-league.html
    │   │   ├── forgot-password.html
    │   │   ├── reset-password.html
    │   │   ├── verify-email.html
    │   │   ├── privacy.html
    │   │   ├── terms.html
    │   │   └── favicon.png
    │   ├── secure/                ← Auth-protected area (static pages)
    │   │   ├── landing.html
    │   │   ├── profile.html
    │   │   ├── referees/
    │   │   │   └── dashboard-referee.html
    │   │   ├── coaches/
    │   │   │   └── dashboard-coach.html
    │   │   ├── clubs/
    │   │   │   └── dashboard-club.html
    │   │   ├── leagues/
    │   │   └── admin/
    │   ├── 404.html
    │   ├── index.html
    │   └── payment.html           ← (referenced in rewrites)
    │
    ├── MatchReferee.csproj
    ├── Program.cs
    ├── dotnet-tools.json
    └── (occasional .gitattributes / .gitignore copies)
