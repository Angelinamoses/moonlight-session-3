/* =======================================================================
   MOONLIGHT SESSION 3.0 — SCRIPT.JS
   Structure of this file:
     1. Configuration placeholders (edit these when going live)
     2. DOM element references
     3. Utility: toast notifications
     4. Navbar: sticky mobile menu toggle
     5. Scroll reveal animation (IntersectionObserver)
     6. Hero parallax effect
     7. Ticket price + total calculation
     8. Form validation
     9. Payment flow 
     10. Submit registration to backend
     11. Success screen + "Book Another Ticket"
   ======================================================================= */

/* -----------------------------------------------------------------------
   1. CONFIGURATION PLACEHOLDERS
   These are the ONLY values you should need to touch when connecting the
   real backend / payment gateway later.
------------------------------------------------------------------------ */

// Razorpay public "Key ID" (safe to expose on the frontend). Leave empty
// until you have a live/test key from the Razorpay dashboard.
const RAZORPAY_KEY = "rzp_live_TEDTCjjrNaJSqo";

// Deployed Google Apps Script Web App URL that receives the booking data
// and writes it to Google Sheets (see submitRegistration() below).

// Single source of truth for ticket price. Changing this one number
// updates the price shown in the UI and every total calculation.
const TICKET_PRICE = 399; // in INR — replace with real price when ready

/* -----------------------------------------------------------------------
   2. DOM ELEMENT REFERENCES
   Cached once at load time so we don't repeatedly query the DOM.
------------------------------------------------------------------------ */
const navToggle       = document.getElementById("navToggle");
const navMobile       = document.getElementById("navMobile");

const registrationForm   = document.getElementById("registrationForm");
const successScreen      = document.getElementById("successScreen");
const bookAnotherBtn     = document.getElementById("bookAnotherBtn");

const fullNameInput   = document.getElementById("fullName");
const emailInput      = document.getElementById("email");
const phoneInput      = document.getElementById("phone");
const ticketsSelect   = document.getElementById("tickets");

const ticketPriceDisplay = document.getElementById("ticketPriceDisplay");
const totalAmountDisplay = document.getElementById("totalAmountDisplay");

const payButton        = document.getElementById("payButton");
const payButtonText     = document.getElementById("payButtonText");
const payButtonSpinner  = document.getElementById("payButtonSpinner");

const toastContainer   = document.getElementById("toastContainer");


/* -----------------------------------------------------------------------
   3. TOAST NOTIFICATIONS
   showToast() creates a small dismissible card in the bottom-right corner.
   type controls the left accent color: "success" | "error" | "info"
------------------------------------------------------------------------ */
function showToast(message, type = "info", duration = 4000) {
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  // Automatically remove the toast after `duration` ms.
  setTimeout(() => {
    toast.classList.add("is-leaving"); // triggers the CSS fade/slide-out
    // Wait for the exit animation to finish before removing from DOM.
    setTimeout(() => toast.remove(), 300);
  }, duration);
}


/* -----------------------------------------------------------------------
   4. NAVBAR — mobile menu toggle
------------------------------------------------------------------------ */
navToggle.addEventListener("click", () => {
  const isOpen = navMobile.classList.toggle("is-open");
  navToggle.classList.toggle("is-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

// Close the mobile menu whenever a link inside it is tapped.
navMobile.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navMobile.classList.remove("is-open");
    navToggle.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});


/* -----------------------------------------------------------------------
   5. SCROLL REVEAL
   Any element with the .reveal class fades/slides into view the first
   time it enters the viewport, then stops being observed.
------------------------------------------------------------------------ */
const revealObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("reveal--visible");
        observer.unobserve(entry.target); // animate once only
      }
    });
  },
  { threshold: 0.15 } // fire when 15% of the element is visible
);

document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));


/* -----------------------------------------------------------------------
   6. HERO PARALLAX
   Elements marked with [data-parallax] move vertically at a fraction of
   the scroll speed, creating a subtle depth effect behind the hero text.
------------------------------------------------------------------------ */
const parallaxLayers = document.querySelectorAll("[data-parallax]");

function updateParallax() {
  const scrollY = window.scrollY;
  parallaxLayers.forEach((layer) => {
    const speed = parseFloat(layer.dataset.parallax); // 0.15, 0.3, etc.
    layer.style.transform = `translateY(${scrollY * speed}px)`;
  });
}

// requestAnimationFrame keeps the parallax update smooth and cheap.
let parallaxTicking = false;
window.addEventListener("scroll", () => {
  if (!parallaxTicking) {
    requestAnimationFrame(() => {
      updateParallax();
      parallaxTicking = false;
    });
    parallaxTicking = true;
  }
});


/* -----------------------------------------------------------------------
   7. TICKET PRICE + TOTAL CALCULATION
   Runs once on load and again every time the "Number of Tickets" dropdown
   changes, so the displayed total is always Number of Tickets × TICKET_PRICE.
------------------------------------------------------------------------ */
function formatCurrency(amount) {
  // Simple INR formatting, e.g. 1500 -> "₹ 1,500"
  return "₹ " + amount.toLocaleString("en-IN");
}

function updatePriceSummary() {
  const quantity = parseInt(ticketsSelect.value, 10) || 1;
  const total = quantity * TICKET_PRICE;

  ticketPriceDisplay.textContent = formatCurrency(TICKET_PRICE);
  totalAmountDisplay.textContent = formatCurrency(total);
}

ticketsSelect.addEventListener("change", updatePriceSummary);
updatePriceSummary(); // initial paint on page load


/* -----------------------------------------------------------------------
   8. FORM VALIDATION
   Each validator returns true/false and writes an error message into the
   matching .field__error span. All must pass before payment starts.
------------------------------------------------------------------------ */

// Basic RFC-5322-ish email pattern — good enough for client-side checks.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Indian mobile numbers: 10 digits, starting with 6, 7, 8, or 9.
// Optional leading +91 / 91 / 0 is stripped before testing.
const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;

function setFieldError(inputEl, errorEl, message) {
  inputEl.closest(".field").classList.toggle("field--error", Boolean(message));
  errorEl.textContent = message || "";
}

function validateFullName() {
  const value = fullNameInput.value.trim();
  if (!value) {
    setFieldError(fullNameInput, document.getElementById("fullNameError"), "Full name is required.");
    return false;
  }
  setFieldError(fullNameInput, document.getElementById("fullNameError"), "");
  return true;
}

function validateEmail() {
  const value = emailInput.value.trim();
  const errorEl = document.getElementById("emailError");
  if (!value) {
    setFieldError(emailInput, errorEl, "Email address is required.");
    return false;
  }
  if (!EMAIL_REGEX.test(value)) {
    setFieldError(emailInput, errorEl, "Enter a valid email address.");
    return false;
  }
  setFieldError(emailInput, errorEl, "");
  return true;
}

function validatePhone() {
  const raw = phoneInput.value.trim();
  const errorEl = document.getElementById("phoneError");
  // Strip common prefixes so "+91 98765 43210" and "9876543210" both work.
  const cleaned = raw.replace(/\D/g, "").replace(/^91/, "").replace(/^0/, "");

  if (!raw) {
    setFieldError(phoneInput, errorEl, "Phone number is required.");
    return false;
  }
  if (!INDIAN_PHONE_REGEX.test(cleaned)) {
    setFieldError(phoneInput, errorEl, "Enter a valid 10-digit Indian mobile number.");
    return false;
  }
  setFieldError(phoneInput, errorEl, "");
  return true;
}

// Runs all validators; returns true only if every field is valid.
function validateForm() {
  const isNameValid  = validateFullName();
  const isEmailValid = validateEmail();
  const isPhoneValid = validatePhone();
  return isNameValid && isEmailValid && isPhoneValid;
}

// Live-validate on blur so users get feedback before hitting submit.
fullNameInput.addEventListener("blur", validateFullName);
emailInput.addEventListener("blur", validateEmail);
phoneInput.addEventListener("blur", validatePhone);


/* -----------------------------------------------------------------------
   9. PAYMENT FLOW (Razorpay placeholders)
   NOTE: Razorpay is NOT integrated yet, as requested. The functions below
   are wired up so that dropping in the Razorpay Checkout script later
   only requires filling in the marked sections — no structural changes.
------------------------------------------------------------------------ */

// Toggles the Pay button between its normal and "processing" states.
function setPayButtonLoading(isLoading) {
  payButton.disabled = isLoading;
  payButtonSpinner.hidden = !isLoading;
  payButtonText.textContent = isLoading ? "Processing..." : "Pay & Register";
}

/**
 * startPayment()
 * Entry point for the payment flow. Currently a placeholder — in
 * production this will open Razorpay's Checkout modal using RAZORPAY_KEY
 * and the order details, then call paymentSuccess() on success.
 */

function startPayment() {

    const quantity = parseInt(ticketsSelect.value, 10) || 1;
    const amount = quantity * TICKET_PRICE;

    setPayButtonLoading(true);

    const options = {

        key: RAZORPAY_KEY,

        amount: amount * 100,

        currency: "INR",

        name: "Moonlight Session 3.0",

        description: quantity + " Ticket(s)",

        image: "",

        handler: async function(response) {
          payButton.disabled = true; // prevent double submission

            await paymentSuccess(response);

        },

        prefill: {

            name: fullNameInput.value,

            email: emailInput.value,

            contact: phoneInput.value

        },

        notes: {

            event: "Moonlight Session 3.0"

        },

        theme: {

            color: "#7C3AED"

        }

    };
    options.modal = {
    ondismiss: function () {
        setPayButtonLoading(false);
        showToast("Payment cancelled.", "info");
    }
};

    const rzp = new Razorpay(options);

    rzp.on("payment.failed", function () {

        setPayButtonLoading(false);

        showToast(
          "Payment was cancelled or failed. No booking has been made.",
          "error"
        );

    });

    rzp.open();

}
  // ---------------------------------------------------------------------
async function paymentSuccess(paymentResponse) {
  showToast("Payment successful! Confirming your booking...", "success");
  await submitRegistration(paymentResponse);
}


/* -----------------------------------------------------------------------
   10. SUBMIT REGISTRATION TO BACKEND
   Posts booking + payment details to the Google Apps Script Web App,
   which is expected to log the row into Google Sheets and trigger the
   invoice/QR/email pipeline (see project notes for the full pipeline).
------------------------------------------------------------------------ */
async function submitRegistration(paymentResponse) {

    const quantity = parseInt(ticketsSelect.value, 10) || 1;
    const amount = quantity * TICKET_PRICE;

    const formURL =
    "https://docs.google.com/forms/d/e/1FAIpQLSdMBbaCZq-8GIwWsBOdReEHBA0WajHegp3wIBA0FHJRHMdW3A/formResponse";

    const formData = new FormData();

    formData.append("entry.1549796671", fullNameInput.value.trim());
    formData.append("entry.169970297", emailInput.value.trim());
    formData.append("entry.784732075", phoneInput.value.trim());
    formData.append("entry.519109136", quantity);
    formData.append("entry.1535997084", amount);
    formData.append("entry.1741527543", paymentResponse.razorpay_payment_id);

    try {

        await fetch(formURL, {
    method: "POST",
    mode: "no-cors",
    body: formData
});

setTimeout(() => {
    showBookingSuccess();
}, 1500)

    } catch (err) {

        console.error(err);

        showToast("Submission failed.", "error");
    }

}


/* -----------------------------------------------------------------------
   11. SUCCESS SCREEN
------------------------------------------------------------------------ */
function showBookingSuccess() {

    registrationForm.style.display = "none";

    successScreen.classList.add("show");

    setPayButtonLoading(false);

}

// "Book Another Ticket" resets the form and swaps back to the booking view.
bookAnotherBtn.addEventListener("click", () => {

    registrationForm.reset();

    updatePriceSummary();

    successScreen.classList.remove("show");

    registrationForm.style.display = "flex";

    // Clear any leftover validation error states.
    [fullNameInput, emailInput, phoneInput].forEach((input) => {
      input.closest(".field").classList.remove("field--error");
    });

    // Scroll back to the top of the registration card for a clean restart.
    document.getElementById("register").scrollIntoView({ behavior: "smooth" });
});


/* -----------------------------------------------------------------------
   FORM SUBMIT HANDLER
   Validates the form, then kicks off the payment flow. This is the single
   entry point triggered by clicking "Pay & Register".
------------------------------------------------------------------------ */
registrationForm.addEventListener("submit", (event) => {
  event.preventDefault(); // stop native form submission / page reload

  if (!validateForm()) {
    showToast("Please fix the highlighted fields before continuing.", "error");
    return;
  }

  startPayment();
});