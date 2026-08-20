(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  // Progressive reveal
  const revealItems = $$(".reveal");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px" }
    );
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("in-view"));
  }

  // Mobile menu
  const menuToggle = $(".menu-toggle");
  const mainNav = $("#main-nav");
  const closeMenu = () => {
    menuToggle?.setAttribute("aria-expanded", "false");
    mainNav?.classList.remove("open");
  };
  menuToggle?.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!open));
    mainNav.classList.toggle("open", !open);
  });
  $$("a", mainNav).forEach((link) => link.addEventListener("click", closeMenu));
  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) closeMenu();
  });

  // Toast
  const toast = $("#toast");
  const toastMessage = $("#toast-message");
  let toastTimer;
  const showToast = (message) => {
    toastMessage.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3400);
  };

  // Fixture search and filters
  const searchForm = $("#fixture-search");
  const searchInput = $("#search-input");
  const competitionSelect = $("#competition-select");
  const dateInput = $("#date-input");
  const matchCards = $$(".match-card");
  const filterButtons = $$(".match-filter [data-filter]");
  const noResults = $("#no-results");
  let activeFilter = "all";
  let expanded = false;

  const filterMatches = ({ scroll = false } = {}) => {
    const query = searchInput.value.trim().toLowerCase();
    const selectFilter = competitionSelect.value;
    const category = selectFilter !== "all" ? selectFilter : activeFilter;
    const date = dateInput.value;
    const isSearching = Boolean(query || date || category !== "all");
    let matches = 0;

    matchCards.forEach((card) => {
      const categoryMatch = category === "all" || card.dataset.category === category;
      const queryMatch = !query || card.dataset.search.includes(query);
      const dateMatch = !date || card.dataset.date === date;
      const visible = categoryMatch && queryMatch && dateMatch;
      const canShowExtra = expanded || isSearching;

      card.classList.toggle("show", card.classList.contains("extra-match") && canShowExtra);
      card.classList.toggle("filtered-out", !visible || (card.classList.contains("extra-match") && !canShowExtra));
      if (visible && (!card.classList.contains("extra-match") || canShowExtra)) matches += 1;
    });

    noResults.hidden = matches > 0;
    if (scroll) $("#matches").scrollIntoView({ behavior: "smooth", block: "start" });
    return matches;
  };

  const setFilter = (filter, shouldScroll = true) => {
    activeFilter = filter;
    competitionSelect.value = filter;
    expanded = filter !== "all" || expanded;
    filterButtons.forEach((button) => button.classList.toggle("active", button.dataset.filter === filter));
    const count = filterMatches({ scroll: shouldScroll });
    if (count) showToast(`${count} ${count === 1 ? "match" : "matches"} available`);
  };

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => setFilter(button.dataset.filter, false));
  });

  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    expanded = true;
    activeFilter = competitionSelect.value;
    filterButtons.forEach((button) => button.classList.toggle("active", button.dataset.filter === activeFilter));
    const count = filterMatches({ scroll: true });
    showToast(count ? `${count} ${count === 1 ? "fixture" : "fixtures"} found` : "No fixtures matched your search");
  });

  competitionSelect?.addEventListener("change", () => {
    activeFilter = competitionSelect.value;
    expanded = true;
    filterButtons.forEach((button) => button.classList.toggle("active", button.dataset.filter === activeFilter));
  });

  $$(".trending-row button").forEach((button) => {
    button.addEventListener("click", () => {
      expanded = true;
      searchInput.value = button.dataset.query || "";
      if (button.dataset.filter) {
        activeFilter = button.dataset.filter;
        competitionSelect.value = activeFilter;
      } else {
        activeFilter = "all";
        competitionSelect.value = "all";
      }
      filterButtons.forEach((item) => item.classList.toggle("active", item.dataset.filter === activeFilter));
      const count = filterMatches({ scroll: true });
      showToast(count ? `${count} matching ${count === 1 ? "fixture" : "fixtures"}` : "No upcoming fixtures found");
    });
  });

  $$("[data-competition-link]").forEach((link) => {
    link.addEventListener("click", () => {
      searchInput.value = "";
      dateInput.value = "";
      setFilter(link.dataset.competitionLink, false);
    });
  });

  $("#all-fixtures")?.addEventListener("click", (event) => {
    expanded = !expanded;
    event.currentTarget.textContent = expanded ? "Show featured fixtures" : "Show all fixtures";
    searchInput.value = "";
    dateInput.value = "";
    activeFilter = "all";
    competitionSelect.value = "all";
    filterButtons.forEach((button) => button.classList.toggle("active", button.dataset.filter === "all"));
    filterMatches();
  });

  $("#search-toggle")?.addEventListener("click", () => {
    searchForm.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => searchInput.focus(), 450);
  });

  // Accordion
  $$(".accordion-item button").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest(".accordion-item");
      const willOpen = !item.classList.contains("open");
      $$(".accordion-item").forEach((other) => {
        other.classList.remove("open");
        $("button", other).setAttribute("aria-expanded", "false");
      });
      if (willOpen) {
        item.classList.add("open");
        button.setAttribute("aria-expanded", "true");
      }
    });
  });

  // Modal helpers
  let previouslyFocused = null;
  const setModal = (modal, open) => {
    if (open) {
      previouslyFocused = document.activeElement;
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      window.setTimeout(() => $(".modal-close", modal)?.focus(), 80);
    } else {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      if (!$$(".modal.open, .story-modal.open").length) document.body.classList.remove("modal-open");
      previouslyFocused?.focus?.();
    }
  };

  // Ticket selector
  const ticketModal = $("#ticket-modal");
  const modalMatch = $("#modal-match");
  const qtyOutput = $("#qty-output");
  const modalTotal = $("#modal-total");
  const cartCount = $("#cart-count");
  const tierInputs = $$("input[name='tier']");
  let basePrice = 3000;
  let quantity = 1;
  let cartQuantity = 0;

  const money = (value) => `MWK ${Number(value).toLocaleString("en-US")}`;
  const tierMultiplier = () => ({ standard: 1, covered: 2, vip: 4 }[$("input[name='tier']:checked").value]);
  const updateTotal = () => {
    qtyOutput.value = quantity;
    qtyOutput.textContent = quantity;
    modalTotal.textContent = money(basePrice * tierMultiplier() * quantity);
  };
  const updateTierPrices = () => {
    $("#standard-price").textContent = money(basePrice);
    $("#covered-price").textContent = money(basePrice * 2);
    $("#vip-price").textContent = money(basePrice * 4);
    updateTotal();
  };

  const openTicketModal = (button) => {
    modalMatch.textContent = button.dataset.match;
    basePrice = Number(button.dataset.price || 3000);
    quantity = 1;
    tierInputs[0].checked = true;
    $$(".ticket-option").forEach((option, index) => option.classList.toggle("selected", index === 0));
    updateTierPrices();
    setModal(ticketModal, true);
  };

  $$(".buy-ticket").forEach((button) => button.addEventListener("click", () => openTicketModal(button)));
  $$('[data-close-modal]').forEach((element) => element.addEventListener("click", () => setModal(ticketModal, false)));
  $("#qty-minus")?.addEventListener("click", () => { quantity = Math.max(1, quantity - 1); updateTotal(); });
  $("#qty-plus")?.addEventListener("click", () => { quantity = Math.min(6, quantity + 1); updateTotal(); });
  tierInputs.forEach((input) => {
    input.addEventListener("change", () => {
      $$(".ticket-option").forEach((option) => option.classList.toggle("selected", $("input", option).checked));
      updateTotal();
    });
  });
  $("#add-to-cart")?.addEventListener("click", () => {
    cartQuantity += quantity;
    cartCount.textContent = cartQuantity;
    setModal(ticketModal, false);
    showToast(`${quantity} ${quantity === 1 ? "ticket" : "tickets"} added to My Tickets`);
  });
  $("#cart-button")?.addEventListener("click", () => {
    showToast(cartQuantity ? `${cartQuantity} ${cartQuantity === 1 ? "ticket" : "tickets"} reserved — checkout connection is ready` : "Your ticket list is empty");
  });

  // How-it-works story
  const storyModal = $("#story-modal");
  $("#watch-story")?.addEventListener("click", () => setModal(storyModal, true));
  $$('[data-close-story]').forEach((element) => element.addEventListener("click", () => setModal(storyModal, false)));

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (ticketModal.classList.contains("open")) setModal(ticketModal, false);
    if (storyModal.classList.contains("open")) setModal(storyModal, false);
  });

  // Newsletter demo validation
  $("#newsletter-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = $("#newsletter-email");
    if (!email.checkValidity()) {
      email.reportValidity();
      return;
    }
    showToast("You're on the list — fixture alerts are coming your way");
    event.currentTarget.reset();
  });

  // Placeholder links that require production destinations
  $$('.socials a, .footer-bottom a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href").slice(1);
      if (!document.getElementById(id)) {
        event.preventDefault();
        showToast("This link will be connected during production setup");
      }
    });
  });

  // Keep the active main nav item in sync with sections.
  const navSections = ["matches", "competitions", "how-it-works", "support"];
  if ("IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          $$(".main-nav a").forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    navSections.forEach((id) => {
      const section = document.getElementById(id);
      if (section) sectionObserver.observe(section);
    });
  }

  $("#year").textContent = new Date().getFullYear();
})();
