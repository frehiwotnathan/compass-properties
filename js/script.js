const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector("#site-nav");
const siteHeader = document.querySelector(".site-header");

menuToggle.addEventListener("click", () => {
  const expanded = menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(expanded));
  menuToggle.setAttribute("aria-label", expanded ? "Close menu" : "Open menu");
  siteNav.classList.toggle("is-open", expanded);
});

siteNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open menu");
    siteNav.classList.remove("is-open");
  });
});

document.querySelector("#year").textContent = new Date().getFullYear();

function updateHeader() {
  siteHeader.classList.toggle("is-scrolled", window.scrollY > 24);
}
window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

document.querySelectorAll("[data-open-details]").forEach((button) => {
  button.addEventListener("click", () => {
    const dialog = document.querySelector(`#details-${button.dataset.openDetails}`);
    if (!dialog) {
      console.error(`Could not find project details for "${button.dataset.openDetails}".`);
      return;
    }
    dialog.showModal();
  });
});

document.querySelectorAll(".details-dialog").forEach((dialog) => {
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

const hero = document.querySelector(".hero");
const slides = [...hero.querySelectorAll(".hero-slide")];
const slideIndex = hero.querySelector(".hero-index");
const slideToggle = hero.querySelector("[data-slide-toggle]");
let activeSlide = 0;
let slideTimer;
let slideshowPaused = false;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function showSlide(index) {
  activeSlide = (index + slides.length) % slides.length;
  slides.forEach((slide, slideNumber) => {
    const isActive = slideNumber === activeSlide;
    slide.classList.toggle("is-active", isActive);
    slide.setAttribute("aria-hidden", String(!isActive));
  });
  slideIndex.textContent = `${String(activeSlide + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
}

function stopSlideTimer() {
  window.clearInterval(slideTimer);
}

function startSlideTimer() {
  stopSlideTimer();
  if (!slideshowPaused && !reducedMotion.matches && !document.hidden && !hero.matches(":hover") && !hero.contains(document.activeElement)) {
    slideTimer = window.setInterval(() => showSlide(activeSlide + 1), 7000);
  }
}

function updateSlideToggle() {
  slideToggle.hidden = reducedMotion.matches;
  slideToggle.textContent = slideshowPaused ? "▶" : "Ⅱ";
  slideToggle.setAttribute("aria-label", `${slideshowPaused ? "Play" : "Pause"} slideshow`);
}

hero.querySelector("[data-slide-previous]").addEventListener("click", () => {
  showSlide(activeSlide - 1);
  startSlideTimer();
});
hero.querySelector("[data-slide-next]").addEventListener("click", () => {
  showSlide(activeSlide + 1);
  startSlideTimer();
});
slideToggle.addEventListener("click", () => {
  slideshowPaused = !slideshowPaused;
  updateSlideToggle();
  startSlideTimer();
});
hero.addEventListener("mouseenter", stopSlideTimer);
hero.addEventListener("mouseleave", startSlideTimer);
hero.addEventListener("focusin", stopSlideTimer);
hero.addEventListener("focusout", (event) => {
  if (!hero.contains(event.relatedTarget)) startSlideTimer();
});
document.addEventListener("visibilitychange", startSlideTimer);
reducedMotion.addEventListener("change", () => {
  updateSlideToggle();
  startSlideTimer();
});
updateSlideToggle();
startSlideTimer();

const contactForm = document.querySelector("#contact-form");
const contactMessage = document.querySelector("#contact-message");
const projectSelect = contactForm.querySelector('[name="project"]');

document.querySelectorAll("[data-contact-project]").forEach((link) => {
  link.addEventListener("click", () => {
    projectSelect.value = link.dataset.contactProject;
    if (link.hasAttribute("data-close-dialog")) link.closest("dialog").close();
  });
});

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  contactMessage.textContent = "Sending your message…";
  contactMessage.classList.remove("error");
  const submitButton = contactForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import("./supabase-config.js");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("The contact form is not connected yet. Please call 0985505722.");
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const values = new FormData(contactForm);
    const { error } = await supabase.from("compass_contact_messages").insert({
      name: values.get("name").trim(),
      email: values.get("email").trim(),
      phone: values.get("phone").trim(),
      project: values.get("project"),
      message: values.get("message").trim(),
    });
    if (error) throw error;
    contactForm.reset();
    contactMessage.textContent = "Thank you. Your message has been sent to our team.";
  } catch (error) {
    console.error("Could not send Compass contact message:", error);
    contactMessage.textContent = `Your message could not be sent: ${error.message}`;
    contactMessage.classList.add("error");
  } finally {
    submitButton.disabled = false;
  }
});
