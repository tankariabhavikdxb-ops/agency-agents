<?php /** Serve All Sports front page. */ $theme_uri = esc_url(get_template_directory_uri()); ?>
<!doctype html>
<html <?php language_attributes(); ?>>
  <head>
    <meta charset="<?php bloginfo('charset'); ?>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#07130f" />
    <meta
      name="description"
      content="Discover Malawi football fixtures and secure verified tickets for the TNM Super League, cup matches, and Flames internationals."
    />
    <meta property="og:title" content="Serve All Sports — Malawi Football Tickets" />
    <meta
      property="og:description"
      content="Your trusted home for Malawi football tickets. Find the fixture, choose your seat, and get matchday ready."
    />
    <meta property="og:image" content="<?php echo $theme_uri; ?>/assets/hero-matchday.jpg" />
    <title>Serve All Sports — Malawi Football Tickets | TNM Super League &amp; Flames</title>
    <link rel="icon" href="<?php echo $theme_uri; ?>/favicon.svg" type="image/svg+xml" />
    <link rel="manifest" href="<?php echo $theme_uri; ?>/site.webmanifest" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <?php wp_head(); ?>
  </head>
  <body <?php body_class(); ?>>
    <?php wp_body_open(); ?>
    <a class="skip-link" href="#main-content">Skip to content</a>

    <div class="notice-bar">
      <div class="container notice-inner">
        <p><span class="live-dot" aria-hidden="true"></span> Tickets now available for Matchweek 14</p>
        <a href="#matches">Explore fixtures <span aria-hidden="true">↗</span></a>
      </div>
    </div>

    <header class="site-header" id="top">
      <div class="container nav-wrap">
        <a class="brand" href="#top" aria-label="Serve All Sports home">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 54" role="img">
              <path d="M24 1.5 45 10v15.4C45 39 36.3 48 24 52.5 11.7 48 3 39 3 25.4V10L24 1.5Z" fill="currentColor" />
              <path d="M14 18.2c0-4.2 3.5-6.8 9.8-6.8 4 0 7.7 1 10.4 2.7l-3.1 6.1c-2.5-1.4-5.3-2.1-7.6-2.1-1.6 0-2.4.4-2.4 1.2 0 2.8 13.8.5 13.8 10.8 0 4.7-3.8 7.5-10.4 7.5-4.6 0-9.2-1.3-12.2-3.6l3.4-6c2.7 2 6.2 3 9 3 1.9 0 2.8-.5 2.8-1.5 0-3-13.5-.5-13.5-11.3Z" fill="#fff" />
            </svg>
          </span>
          <span class="brand-copy">
            <strong>Serve All Sports</strong>
            <small>Malawi</small>
          </span>
        </a>

        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Open menu">
          <span></span><span></span><span></span>
        </button>

        <nav class="main-nav" id="main-nav" aria-label="Main navigation">
          <a class="active" href="#matches">Tickets</a>
          <a href="#competitions">Competitions</a>
          <a href="#how-it-works">How it works</a>
          <a href="#support">Support</a>
        </nav>

        <div class="nav-actions">
          <button class="icon-button" type="button" id="search-toggle" aria-label="Open search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>
          </button>
          <button class="cart-button" type="button" id="cart-button" aria-label="Open ticket cart">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5h2l1.7 9.5h9.7l2-6.5H6"></path><circle cx="9" cy="19" r="1.25"></circle><circle cx="17" cy="19" r="1.25"></circle></svg>
            <span class="cart-label">My tickets</span>
            <span class="cart-count" id="cart-count" aria-live="polite">0</span>
          </button>
        </div>
      </div>
    </header>

    <main id="main-content">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-image" role="img" aria-label="A packed Malawi football stadium at sunset"></div>
        <div class="hero-shade"></div>
        <div class="container hero-content">
          <div class="hero-copy reveal">
            <div class="eyebrow light"><span></span> Malawi's home of matchday</div>
            <h1 id="hero-title">Feel every<br /><em>moment.</em></h1>
            <p>Verified tickets for the biggest matches in Malawi. Secure your seat and join the roar.</p>
            <div class="hero-actions">
              <a class="button button-primary" href="#matches">Find your match <span aria-hidden="true">↗</span></a>
              <button class="play-link" type="button" id="watch-story">
                <span class="play-icon" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m7 5 7 5-7 5V5Z"></path></svg></span>
                See how it works
              </button>
            </div>
          </div>

          <div class="hero-ticket reveal delay-1" aria-label="Featured match">
            <div class="ticket-topline">
              <span>Featured match</span>
              <span class="selling-fast"><i></i> Selling fast</span>
            </div>
            <div class="ticket-competition">TNM Super League · Matchweek 14</div>
            <div class="ticket-teams">
              <div class="ticket-team">
                <span class="team-crest wanderers">MW</span>
                <strong>Mighty<br />Wanderers</strong>
              </div>
              <div class="versus"><span>22 Aug</span><strong>VS</strong><small>14:30</small></div>
              <div class="ticket-team">
                <span class="team-crest lions">RL</span>
                <strong>Red<br />Lions</strong>
              </div>
            </div>
            <div class="ticket-venue">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"></path><circle cx="12" cy="10" r="2"></circle></svg>
              Kamuzu Stadium, Blantyre
            </div>
            <button class="ticket-cta buy-ticket" type="button" data-match="Mighty Wanderers vs Red Lions" data-price="3000">
              <span>From <strong>MWK 3,000</strong></span>
              <span>Get tickets <b aria-hidden="true">→</b></span>
            </button>
          </div>
        </div>

        <div class="hero-stats">
          <div class="container stats-inner">
            <div><strong>50K+</strong><span>Tickets delivered</span></div>
            <div><strong>100%</strong><span>Verified entry</span></div>
            <div><strong>16</strong><span>Super League clubs</span></div>
            <div class="trust-note"><span class="shield-check" aria-hidden="true">✓</span><p><b>Official. Secure. Local.</b><br />Built for Malawi's supporters.</p></div>
          </div>
        </div>
      </section>

      <section class="quick-search" aria-label="Find a fixture">
        <div class="container">
          <form class="search-panel reveal" id="fixture-search">
            <label class="search-field search-keywords">
              <span>What are you looking for?</span>
              <div>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>
                <input id="search-input" type="search" placeholder="Team, match or venue" autocomplete="off" />
              </div>
            </label>
            <label class="search-field">
              <span>Competition</span>
              <div>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4c0 3-1.8 5-4 5s-4-2-4-5V4Z"></path><path d="M8 6H4v1c0 2.2 1.8 4 4 4m8-5h4v1c0 2.2-1.8 4-4 4M12 13v4m-4 3h8"></path></svg>
                <select id="competition-select">
                  <option value="all">All competitions</option>
                  <option value="league">TNM Super League</option>
                  <option value="cup">Malawi Cup</option>
                  <option value="international">Flames internationals</option>
                </select>
              </div>
            </label>
            <label class="search-field">
              <span>Match date</span>
              <div>
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"></rect><path d="M8 3v4m8-4v4M3.5 10h17"></path></svg>
                <input id="date-input" type="date" min="2026-08-20" />
              </div>
            </label>
            <button class="button button-dark search-submit" type="submit">Search tickets <span aria-hidden="true">→</span></button>
          </form>
          <div class="trending-row reveal delay-1">
            <span>Popular now</span>
            <button type="button" data-query="Big Bullets">FCB Big Bullets</button>
            <button type="button" data-query="Mighty Wanderers">Mighty Wanderers</button>
            <button type="button" data-query="Silver Strikers">Silver Strikers</button>
            <button type="button" data-filter="international">The Flames</button>
          </div>
        </div>
      </section>

      <section class="matches-section section" id="matches" aria-labelledby="matches-title">
        <div class="container">
          <div class="section-heading split reveal">
            <div>
              <div class="eyebrow"><span></span> Upcoming fixtures</div>
              <h2 id="matches-title">Choose your <em>match.</em></h2>
            </div>
            <a class="text-link" href="#all-fixtures">View all fixtures <span aria-hidden="true">↗</span></a>
          </div>

          <div class="match-filter reveal" role="group" aria-label="Filter matches">
            <button class="active" type="button" data-filter="all">All matches</button>
            <button type="button" data-filter="league">TNM Super League</button>
            <button type="button" data-filter="cup">Malawi Cup</button>
            <button type="button" data-filter="international">The Flames</button>
          </div>

          <div class="matches-grid" id="matches-grid">
            <article class="match-card reveal" data-category="league" data-search="mighty wanderers red lions kamuzu stadium blantyre" data-date="2026-08-22">
              <div class="match-card-top">
                <span>TNM Super League</span>
                <span class="availability low"><i></i> Selling fast</span>
              </div>
              <div class="match-date"><strong>22</strong><span>AUG<br />SAT</span><small>14:30 CAT</small></div>
              <div class="match-teams">
                <div><span class="team-crest wanderers">MW</span><strong>Mighty Wanderers</strong></div>
                <b>VS</b>
                <div><span class="team-crest lions">RL</span><strong>Red Lions</strong></div>
              </div>
              <div class="match-location">
                <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"></path><circle cx="12" cy="10" r="2"></circle></svg> Kamuzu Stadium</span>
                <span>Blantyre</span>
              </div>
              <div class="match-action">
                <p>From <strong>MWK 3,000</strong></p>
                <button type="button" class="button button-outline buy-ticket" data-match="Mighty Wanderers vs Red Lions" data-price="3000">Get tickets <span aria-hidden="true">→</span></button>
              </div>
            </article>

            <article class="match-card reveal delay-1" data-category="league" data-search="silver strikers goshen city dedza dynamos silver stadium lilongwe" data-date="2026-08-23">
              <div class="match-card-top">
                <span>TNM Super League</span>
                <span class="availability"><i></i> Available</span>
              </div>
              <div class="match-date"><strong>23</strong><span>AUG<br />SUN</span><small>14:30 CAT</small></div>
              <div class="match-teams">
                <div><span class="team-crest strikers">SS</span><strong>Silver Strikers</strong></div>
                <b>VS</b>
                <div><span class="team-crest dynamos">GD</span><strong>Dedza Dynamos</strong></div>
              </div>
              <div class="match-location">
                <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"></path><circle cx="12" cy="10" r="2"></circle></svg> Silver Stadium</span>
                <span>Lilongwe</span>
              </div>
              <div class="match-action">
                <p>From <strong>MWK 3,000</strong></p>
                <button type="button" class="button button-outline buy-ticket" data-match="Silver Strikers vs Dedza Dynamos" data-price="3000">Get tickets <span aria-hidden="true">→</span></button>
              </div>
            </article>

            <article class="match-card reveal delay-2" data-category="league" data-search="luanar mitundu fcb nyasa big bullets aubrey dimba stadium mitundu" data-date="2026-08-23">
              <div class="match-card-top">
                <span>TNM Super League</span>
                <span class="availability"><i></i> Available</span>
              </div>
              <div class="match-date"><strong>23</strong><span>AUG<br />SUN</span><small>14:30 CAT</small></div>
              <div class="match-teams">
                <div><span class="team-crest mitundu">LM</span><strong>Luanar Mitundu</strong></div>
                <b>VS</b>
                <div><span class="team-crest bullets">BB</span><strong>FCB Big Bullets</strong></div>
              </div>
              <div class="match-location">
                <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"></path><circle cx="12" cy="10" r="2"></circle></svg> Aubrey Dimba Stadium</span>
                <span>Mitundu</span>
              </div>
              <div class="match-action">
                <p>From <strong>MWK 3,000</strong></p>
                <button type="button" class="button button-outline buy-ticket" data-match="Luanar Mitundu vs FCB Big Bullets" data-price="3000">Get tickets <span aria-hidden="true">→</span></button>
              </div>
            </article>

            <article class="match-card extra-match" data-category="cup" data-search="malawi cup quarter final kamuzu stadium" data-date="2026-09-05">
              <div class="match-card-top"><span>Malawi Cup</span><span class="availability"><i></i> Available</span></div>
              <div class="match-date"><strong>05</strong><span>SEP<br />SAT</span><small>15:00 CAT</small></div>
              <div class="match-teams">
                <div><span class="team-crest bullets">BB</span><strong>FCB Big Bullets</strong></div><b>VS</b>
                <div><span class="team-crest strikers">SS</span><strong>Silver Strikers</strong></div>
              </div>
              <div class="match-location"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"></path><circle cx="12" cy="10" r="2"></circle></svg> Kamuzu Stadium</span><span>Blantyre</span></div>
              <div class="match-action"><p>From <strong>MWK 5,000</strong></p><button type="button" class="button button-outline buy-ticket" data-match="FCB Big Bullets vs Silver Strikers" data-price="5000">Get tickets <span aria-hidden="true">→</span></button></div>
            </article>

            <article class="match-card extra-match" data-category="international" data-search="malawi flames international bingu national stadium lilongwe" data-date="2026-09-12">
              <div class="match-card-top"><span>Flames International</span><span class="availability"><i></i> Presale</span></div>
              <div class="match-date"><strong>12</strong><span>SEP<br />SAT</span><small>15:00 CAT</small></div>
              <div class="match-teams">
                <div><span class="team-crest flames">MW</span><strong>Malawi Flames</strong></div><b>VS</b>
                <div><span class="team-crest tba">TBA</span><strong>Opponent TBA</strong></div>
              </div>
              <div class="match-location"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"></path><circle cx="12" cy="10" r="2"></circle></svg> Bingu National Stadium</span><span>Lilongwe</span></div>
              <div class="match-action"><p>From <strong>MWK 5,000</strong></p><button type="button" class="button button-outline buy-ticket" data-match="Malawi Flames International" data-price="5000">Get tickets <span aria-hidden="true">→</span></button></div>
            </article>
          </div>
          <p class="no-results" id="no-results" hidden>No matches found. Try another team, competition, or date.</p>
          <div class="mobile-view-all"><button type="button" class="button button-dark" id="all-fixtures">Show all fixtures</button></div>
          <p class="fixture-note">Fixture details are shown for demonstration and remain subject to official confirmation.</p>
        </div>
      </section>

      <section class="competition-section section" id="competitions" aria-labelledby="competition-title">
        <div class="container competition-grid">
          <div class="competition-photo reveal">
            <img src="<?php echo $theme_uri; ?>/assets/stadium-night.jpg" alt="Supporters watching football under stadium floodlights" />
            <div class="photo-badge"><strong>90</strong><span>minutes<br />of pure energy</span></div>
          </div>
          <div class="competition-content reveal delay-1">
            <div class="eyebrow light"><span></span> More than a match</div>
            <h2 id="competition-title">Where Malawi<br /><em>comes alive.</em></h2>
            <p>From Blantyre derbies to international nights in Lilongwe, this is football that moves a nation.</p>
            <div class="competition-list">
              <a href="#matches" data-competition-link="league">
                <span class="competition-number">01</span>
                <span><strong>TNM Super League</strong><small>16 clubs · Nationwide</small></span>
                <b aria-hidden="true">↗</b>
              </a>
              <a href="#matches" data-competition-link="cup">
                <span class="competition-number">02</span>
                <span><strong>Malawi Cup</strong><small>Knockout football · One champion</small></span>
                <b aria-hidden="true">↗</b>
              </a>
              <a href="#matches" data-competition-link="international">
                <span class="competition-number">03</span>
                <span><strong>The Flames</strong><small>International fixtures · One nation</small></span>
                <b aria-hidden="true">↗</b>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section class="steps-section section" id="how-it-works" aria-labelledby="steps-title">
        <div class="container">
          <div class="section-heading centered reveal">
            <div class="eyebrow"><span></span> Simple &amp; secure</div>
            <h2 id="steps-title">Matchday in <em>three steps.</em></h2>
            <p>No queues. No uncertainty. Just choose, pay, and get ready for kickoff.</p>
          </div>
          <div class="steps-grid">
            <article class="step-card reveal">
              <span class="step-number">01</span>
              <div class="step-icon"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="14" cy="14" r="8"></circle><path d="m20 20 7 7"></path></svg></div>
              <h3>Find your fixture</h3>
              <p>Search by team, competition, venue, or date to find the match you want.</p>
            </article>
            <article class="step-card feature reveal delay-1">
              <span class="step-number">02</span>
              <div class="step-icon"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 8h22v16H5z"></path><path d="M5 13h22M10 19h5"></path></svg></div>
              <h3>Choose &amp; pay</h3>
              <p>Select your ticket category and pay safely using a supported local method.</p>
            </article>
            <article class="step-card reveal delay-2">
              <span class="step-number">03</span>
              <div class="step-icon"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="3" width="18" height="26" rx="3"></rect><path d="M11 8h10v10H11zM10 23h12"></path></svg></div>
              <h3>Scan &amp; cheer</h3>
              <p>Get your secure digital ticket, scan at the gate, and take your seat.</p>
            </article>
          </div>
        </div>
      </section>

      <section class="trust-section section" aria-labelledby="trust-title">
        <div class="container trust-grid">
          <div class="trust-copy reveal">
            <div class="eyebrow"><span></span> Made for supporters</div>
            <h2 id="trust-title">Your matchday,<br /><em>sorted.</em></h2>
            <p>We make getting into the game as exciting as being there—with trusted tickets and support that stays close.</p>
            <div class="trust-points">
              <div><span>✓</span><p><strong>Verified tickets</strong><small>Every ticket is checked and protected.</small></p></div>
              <div><span>⌁</span><p><strong>Instant delivery</strong><small>Your ticket arrives directly on your phone.</small></p></div>
              <div><span>◉</span><p><strong>Local support</strong><small>Real help before, during, and after booking.</small></p></div>
            </div>
            <a class="button button-dark" href="#support">About our guarantee <span aria-hidden="true">→</span></a>
          </div>
          <div class="trust-image reveal delay-1">
            <img src="<?php echo $theme_uri; ?>/assets/fans-celebrating.jpg" alt="Malawi supporters celebrating together in the stands" />
            <div class="quote-card">
              <div class="stars" aria-label="5 out of 5 stars">★★★★★</div>
              <blockquote>“Booked in two minutes. We were through the gate before kickoff.”</blockquote>
              <p><span>TM</span><strong>Tadala M.<small>Blantyre</small></strong></p>
            </div>
          </div>
        </div>
      </section>

      <section class="digital-section" aria-labelledby="digital-title">
        <div class="container digital-grid">
          <div class="digital-image reveal">
            <div class="phone-ring"></div>
            <img src="<?php echo $theme_uri; ?>/assets/mobile-ticket.jpg" alt="A supporter holding a digital match ticket on a phone" />
          </div>
          <div class="digital-copy reveal delay-1">
            <div class="eyebrow light"><span></span> Your ticket. Your phone.</div>
            <h2 id="digital-title">Ready before<br /><em>kickoff.</em></h2>
            <p>Your secure ticket is delivered instantly. Keep it on your phone, show it at the gate, and you're in.</p>
            <div class="digital-benefits">
              <span><b>✓</b> No printing</span>
              <span><b>✓</b> Secure QR entry</span>
              <span><b>✓</b> Works offline</span>
            </div>
            <a class="button button-primary" href="#matches">Get match ready <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>

      <section class="clubs-strip" aria-label="Featured football clubs">
        <div class="clubs-track">
          <span><i class="mini-crest bullets">BB</i> FCB Big Bullets</span>
          <b>•</b>
          <span><i class="mini-crest wanderers">MW</i> Mighty Wanderers</span>
          <b>•</b>
          <span><i class="mini-crest strikers">SS</i> Silver Strikers</span>
          <b>•</b>
          <span><i class="mini-crest flames">MW</i> Malawi Flames</span>
          <b>•</b>
          <span><i class="mini-crest bullets">BB</i> FCB Big Bullets</span>
          <b>•</b>
          <span><i class="mini-crest wanderers">MW</i> Mighty Wanderers</span>
          <b>•</b>
          <span><i class="mini-crest strikers">SS</i> Silver Strikers</span>
        </div>
      </section>

      <section class="faq-section section" id="support" aria-labelledby="faq-title">
        <div class="container faq-grid">
          <div class="faq-intro reveal">
            <div class="eyebrow"><span></span> Matchday support</div>
            <h2 id="faq-title">Questions?<br /><em>We've got you.</em></h2>
            <p>Everything you need to know before you book.</p>
            <a class="text-link" href="mailto:support@sasmw.com">Talk to support <span aria-hidden="true">↗</span></a>
          </div>
          <div class="accordion reveal delay-1">
            <div class="accordion-item open">
              <h3><button type="button" aria-expanded="true"><span>How do I receive my ticket?</span><i></i></button></h3>
              <div class="accordion-panel"><p>Once payment is confirmed, your secure digital ticket is delivered by email and made available on your phone. Present the QR code at the stadium gate.</p></div>
            </div>
            <div class="accordion-item">
              <h3><button type="button" aria-expanded="false"><span>Are all tickets verified?</span><i></i></button></h3>
              <div class="accordion-panel"><p>Yes. Every listed ticket is validated before sale, and each QR code is unique to your order.</p></div>
            </div>
            <div class="accordion-item">
              <h3><button type="button" aria-expanded="false"><span>Which payment methods can I use?</span><i></i></button></h3>
              <div class="accordion-panel"><p>The checkout is prepared for supported mobile money, bank card, and other local payment options. Availability can vary by event.</p></div>
            </div>
            <div class="accordion-item">
              <h3><button type="button" aria-expanded="false"><span>What happens if a match is postponed?</span><i></i></button></h3>
              <div class="accordion-panel"><p>Your ticket remains valid for the rescheduled fixture. If an event is cancelled, eligible ticket holders receive refund instructions automatically.</p></div>
            </div>
            <div class="accordion-item">
              <h3><button type="button" aria-expanded="false"><span>Can I buy tickets for friends and family?</span><i></i></button></h3>
              <div class="accordion-panel"><p>Absolutely. Select the number of tickets you need at checkout, then keep them together or share individual tickets with your guests.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section class="cta-section" aria-labelledby="cta-title">
        <div class="cta-bg"></div>
        <div class="container cta-content reveal">
          <span class="cta-ball" aria-hidden="true">⚽</span>
          <div>
            <div class="eyebrow light"><span></span> The next roar starts here</div>
            <h2 id="cta-title">Don't just watch.<br /><em>Be there.</em></h2>
          </div>
          <a class="button button-primary" href="#matches">Find your match <span aria-hidden="true">↗</span></a>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container footer-grid">
        <div class="footer-brand">
          <a class="brand brand-light" href="#top" aria-label="Serve All Sports home">
            <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 54"><path d="M24 1.5 45 10v15.4C45 39 36.3 48 24 52.5 11.7 48 3 39 3 25.4V10L24 1.5Z" fill="currentColor"/><path d="M14 18.2c0-4.2 3.5-6.8 9.8-6.8 4 0 7.7 1 10.4 2.7l-3.1 6.1c-2.5-1.4-5.3-2.1-7.6-2.1-1.6 0-2.4.4-2.4 1.2 0 2.8 13.8.5 13.8 10.8 0 4.7-3.8 7.5-10.4 7.5-4.6 0-9.2-1.3-12.2-3.6l3.4-6c2.7 2 6.2 3 9 3 1.9 0 2.8-.5 2.8-1.5 0-3-13.5-.5-13.5-11.3Z" fill="#fff"/></svg></span>
            <span class="brand-copy"><strong>Serve All Sports</strong><small>Malawi</small></span>
          </a>
          <p>Malawi's trusted home for football tickets, bringing supporters closer to every kickoff.</p>
          <div class="socials">
            <a href="#facebook" aria-label="Facebook">f</a>
            <a href="#instagram" aria-label="Instagram">◎</a>
            <a href="#x" aria-label="X">𝕏</a>
          </div>
        </div>
        <div class="footer-links"><h3>Tickets</h3><a href="#matches">All matches</a><a href="#matches">TNM Super League</a><a href="#matches">Malawi Cup</a><a href="#matches">The Flames</a></div>
        <div class="footer-links"><h3>Help</h3><a href="#how-it-works">How it works</a><a href="#support">Ticket guarantee</a><a href="#support">FAQs</a><a href="mailto:support@sasmw.com">Contact support</a></div>
        <div class="footer-newsletter">
          <h3>Never miss kickoff</h3>
          <p>Fixture alerts and ticket releases, straight to your inbox.</p>
          <form id="newsletter-form"><label class="sr-only" for="newsletter-email">Email address</label><input id="newsletter-email" type="email" placeholder="Your email address" required /><button type="submit" aria-label="Subscribe">→</button></form>
          <small>By subscribing you agree to receive match updates.</small>
        </div>
      </div>
      <div class="container footer-bottom">
        <p>© <span id="year">2026</span> Serve All Sports Malawi. All rights reserved.</p>
        <div><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#cookies">Cookies</a></div>
        <span>Made for the love of the game <i aria-hidden="true">♥</i></span>
      </div>
    </footer>

    <div class="modal" id="ticket-modal" aria-hidden="true">
      <div class="modal-backdrop" data-close-modal></div>
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button class="modal-close" type="button" data-close-modal aria-label="Close ticket selector">×</button>
        <div class="modal-tag">Secure booking</div>
        <h2 id="modal-title">Choose your tickets</h2>
        <p class="modal-match" id="modal-match">Match name</p>
        <div class="ticket-options">
          <label class="ticket-option selected"><input type="radio" name="tier" value="standard" checked /><span><strong>Standard</strong><small>General admission</small></span><b id="standard-price">MWK 3,000</b></label>
          <label class="ticket-option"><input type="radio" name="tier" value="covered" /><span><strong>Covered stand</strong><small>Reserved section</small></span><b id="covered-price">MWK 6,000</b></label>
          <label class="ticket-option"><input type="radio" name="tier" value="vip" /><span><strong>VIP</strong><small>Premium matchday view</small></span><b id="vip-price">MWK 12,000</b></label>
        </div>
        <div class="quantity-row"><span><strong>Quantity</strong><small>Maximum 6 per order</small></span><div class="quantity"><button type="button" id="qty-minus" aria-label="Decrease quantity">−</button><output id="qty-output">1</output><button type="button" id="qty-plus" aria-label="Increase quantity">+</button></div></div>
        <div class="modal-total"><span>Total</span><strong id="modal-total">MWK 3,000</strong></div>
        <button class="button button-primary modal-add" id="add-to-cart" type="button">Add to my tickets <span aria-hidden="true">→</span></button>
        <p class="secure-note">✓ Protected ticket · Secure checkout · Instant delivery</p>
      </div>
    </div>

    <div class="story-modal" id="story-modal" aria-hidden="true">
      <div class="modal-backdrop" data-close-story></div>
      <div class="story-dialog" role="dialog" aria-modal="true" aria-labelledby="story-title">
        <button class="modal-close light-close" type="button" data-close-story aria-label="Close story">×</button>
        <div class="story-image"><img src="<?php echo $theme_uri; ?>/assets/hero-matchday.jpg" alt="Crowds welcoming players onto the football pitch" /></div>
        <div class="story-copy"><span>From search to stadium</span><h2 id="story-title">Your next match is only three steps away.</h2><p>Find your fixture, choose a verified ticket, and scan the secure QR code at the gate. Simple.</p><a class="button button-primary" href="#matches" data-close-story>Find a match</a></div>
      </div>
    </div>

    <div class="toast" id="toast" role="status" aria-live="polite"><span>✓</span><p id="toast-message">Done</p></div>
    <?php wp_footer(); ?>
  </body>
</html>
