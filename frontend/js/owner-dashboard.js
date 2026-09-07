const API_BASE_URL = "http://localhost:4000/api";
const BOOKINGS_LIMIT = 5;
const NOTIFICATIONS_LIMIT = 3;

let petsCache = [];
let bookingsOffset = 0;
let bookingsHasMore = false;
let notificationsOffset = 0;
let notificationsHasMore = false;

function getSavedUser() {
    const savedUser = localStorage.getItem("petsitterhubUser");

    if (!savedUser) {
        return null;
    }

    return JSON.parse(savedUser);
}

function getSavedToken() {
    return localStorage.getItem("petsitterhubToken");
}

function authHeaders() {
    return {
        Authorization: `Bearer ${getSavedToken()}`
    };
}

function guardOwnerDashboard() {
    const user = getSavedUser();
    const token = getSavedToken();

    if (!user || !token) {
        window.location.href = "login.html";
        return false;
    }

    if (user.role !== "owner") {
        window.location.href = "../index.html";
        return false;
    }

    return true;
}

function showPetsMessage(type, text) {
    $("#petsMessage")
        .removeClass("d-none alert-success alert-danger")
        .addClass(`alert-${type}`)
        .text(text);
}

function clearPetsMessage() {
    $("#petsMessage")
        .addClass("d-none")
        .removeClass("alert-success alert-danger")
        .text("");
}

function showBookingsMessage(type, text) {
    $("#bookingsMessage")
        .removeClass("d-none alert-success alert-danger")
        .addClass(`alert-${type}`)
        .text(text);
}

function clearBookingsMessage() {
    $("#bookingsMessage")
        .addClass("d-none")
        .removeClass("alert-success alert-danger")
        .text("");
}

function petTypeLabel(petType) {
    const labels = {
        cane: "Cane",
        gatto: "Gatto",
        roditore: "Roditore",
        uccello: "Uccello",
        rettile: "Rettile"
    };

    return labels[petType] || petType;
}

function formatMoney(value) {
    return new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR"
    }).format(Number(value || 0));
}

function formatDateTime(value) {
    return new Date(value).toLocaleString("it-IT", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function paymentMethodText(method) {
    const labels = {
        bank_transfer: "Bonifico",
        demo_card: "Carta demo"
    };

    return labels[method] || "Da scegliere";
}

function bookingStateClass(booking) {
    if (booking.status === "pending") {
        return "booking-status-pending";
    }

    if (booking.status === "accepted" && !booking.payment_status) {
        return "booking-status-accepted";
    }

    if (booking.status === "rejected") {
        return "booking-status-rejected";
    }

    if (booking.status === "cancelled" || booking.payment_status === "refunded") {
        return "booking-status-cancelled";
    }

    if (booking.status === "completed") {
        return "booking-status-completed";
    }

    return "booking-status-accepted";
}

function bookingStateText(booking) {
    if (booking.status === "pending") {
        return "IN ATTESA DI CONFERMA";
    }

    if (booking.status === "accepted" && !booking.payment_status) {
        return "IN ATTESA DI PAGAMENTO";
    }

    if (booking.payment_status === "refunded") {
        return "ANNULLATO - RIMBORSO AVVIATO";
    }

    if (booking.status === "cancelled") {
        return "ANNULLATO";
    }

    if (booking.status === "rejected") {
        return "RICHIESTA RIFIUTATA";
    }

    if (booking.payment_status === "authorized") {
        return "BONIFICO IN VERIFICA";
    }

    if (booking.payment_status === "paid") {
        return "PAGAMENTO EFFETTUATO";
    }

    return "STATO NON DISPONIBILE";
}

function canCancelBooking(booking) {
    return ["pending", "accepted"].includes(booking.status);
}

function canPayBooking(booking) {
    return booking.status === "accepted" && (!booking.payment_status || booking.payment_status === "failed");
}

function canReviewBooking(booking) {
    return booking.status === "completed" && booking.can_review;
}

function escapeHtmlAttribute(value) {
    return $("<div>").text(value || "").html().replace(/"/g, "&quot;");
}

function renderPets(pets) {
    if (!pets.length) {
        $("#petsList").html('<div class="empty-state">Non hai ancora inserito animali.</div>');
        return;
    }

    $("#petsList").html(pets.map(function (pet) {
        return `
            <article class="pet-card">
                <div>
                    <strong>${pet.name}</strong>
                    <p class="mb-1">${petTypeLabel(pet.species)}${pet.breed ? ` - ${pet.breed}` : ""}</p>
                    <p class="text-muted mb-0">${pet.notes || "Nessuna nota inserita."}</p>
                </div>
                <div class="d-flex gap-2 mt-3">
                    <button class="btn btn-sm btn-outline-primary edit-pet-button" type="button" data-id="${pet.id}">
                        Modifica
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-pet-button" type="button" data-id="${pet.id}">
                        Elimina
                    </button>
                </div>
            </article>
        `;
    }).join(""));
}

function loadPets() {
    $("#petsList").html('<div class="empty-state">Caricamento animali...</div>');

    $.ajax({
        url: `${API_BASE_URL}/pets`,
        method: "GET",
        headers: authHeaders(),
        success: function (response) {
            petsCache = response.pets || [];
            renderPets(petsCache);
        },
        error: function () {
            $("#petsList").html('<div class="empty-state text-danger">Errore durante il caricamento degli animali.</div>');
        }
    });
}

function resetPetForm() {
    $("#petId").val("");
    $("#petForm")[0].reset();
    $("#savePetButton").text("Salva animale");
    $("#cancelEditPetButton").addClass("d-none");
    clearPetsMessage();
}

function getPetFormData() {
    return {
        name: $("#petName").val().trim(),
        species: $("#petSpecies").val(),
        breed: $("#petBreed").val().trim() || null,
        notes: $("#petNotes").val().trim() || null
    };
}

function startPetEdit(petId) {
    const pet = petsCache.find(function (item) {
        return Number(item.id) === Number(petId);
    });

    if (!pet) {
        return;
    }

    $("#petId").val(pet.id);
    $("#petName").val(pet.name);
    $("#petSpecies").val(pet.species);
    $("#petBreed").val(pet.breed || "");
    $("#petNotes").val(pet.notes || "");
    $("#savePetButton").text("Salva modifiche");
    $("#cancelEditPetButton").removeClass("d-none");
    window.scrollTo({ top: $("#petForm").offset().top - 120, behavior: "smooth" });
}

function deletePet(petId) {
    $.ajax({
        url: `${API_BASE_URL}/pets/${petId}`,
        method: "DELETE",
        headers: authHeaders(),
        success: function () {
            resetPetForm();
            loadPets();
        },
        error: function () {
            showPetsMessage("danger", "Non è stato possibile eliminare l'animale.");
        }
    });
}

function savePet(event) {
    event.preventDefault();
    clearPetsMessage();

    const petId = $("#petId").val();
    const method = petId ? "PUT" : "POST";
    const url = petId ? `${API_BASE_URL}/pets/${petId}` : `${API_BASE_URL}/pets`;

    $.ajax({
        url,
        method,
        headers: authHeaders(),
        contentType: "application/json",
        data: JSON.stringify(getPetFormData()),
        success: function () {
            showPetsMessage("success", petId ? "Animale aggiornato correttamente." : "Animale aggiunto correttamente.");
            resetPetForm();
            loadPets();
        },
        error: function (xhr) {
            const message = xhr.responseJSON && xhr.responseJSON.error
                ? xhr.responseJSON.error
                : "Non è stato possibile salvare l'animale.";
            showPetsMessage("danger", message);
        }
    });
}

function renderPaymentForm(booking) {
    if (!canPayBooking(booking)) {
        return "";
    }

    return `
        <form class="payment-form payment-summary row g-2 mt-3" data-id="${booking.id}">
            <div class="col-md-7">
                <label class="form-label" for="payment-method-${booking.id}">Metodo pagamento</label>
                <select class="form-select payment-method" id="payment-method-${booking.id}" required>
                    <option value="demo_card">Carta demo</option>
                    <option value="bank_transfer">Bonifico</option>
                </select>
            </div>
            <div class="col-md-5 d-flex align-items-end">
                <button class="btn btn-primary w-100" type="submit">Paga</button>
            </div>
        </form>
    `;
}

function renderReviewForm(booking) {
    if (!canReviewBooking(booking)) {
        return "";
    }

    const editing = Boolean(booking.review_id);
    const selectedRating = Number(booking.review_rating || 0);
    const comment = escapeHtmlAttribute(booking.review_comment);

    return `
        <form class="review-form row g-2 mt-3" data-id="${booking.id}" data-review-id="${booking.review_id || ""}">
            <div class="col-md-4">
                <label class="form-label" for="review-rating-${booking.id}">Recensione</label>
                <select class="form-select review-rating" id="review-rating-${booking.id}" required>
                    <option value="">Voto</option>
                    <option value="5" ${selectedRating === 5 ? "selected" : ""}>5 stelle</option>
                    <option value="4" ${selectedRating === 4 ? "selected" : ""}>4 stelle</option>
                    <option value="3" ${selectedRating === 3 ? "selected" : ""}>3 stelle</option>
                    <option value="2" ${selectedRating === 2 ? "selected" : ""}>2 stelle</option>
                    <option value="1" ${selectedRating === 1 ? "selected" : ""}>1 stella</option>
                </select>
            </div>
            <div class="col-md-8">
                <label class="form-label" for="review-comment-${booking.id}">Commento</label>
                <input class="form-control review-comment" id="review-comment-${booking.id}" type="text" value="${comment}" placeholder="Scrivi una recensione">
            </div>
            <div class="col-12">
                <button class="btn btn-outline-primary btn-sm" type="submit">
                    ${editing ? "Modifica recensione" : "Invia recensione"}
                </button>
            </div>
        </form>
    `;
}

function renderUnreadMessagesBadge(booking) {
    const unreadMessages = Number(booking.unread_messages || 0);

    return `
        <span class="message-count-badge ${unreadMessages > 0 ? "" : "d-none"}" id="message-count-${booking.id}">
            ${unreadMessages}
        </span>
    `;
}

function renderBookings(bookings, append) {
    if (!append) {
        $("#bookingsList").html("");
    }

    if (!bookings.length && !append) {
        $("#bookingsList").html('<div class="empty-state">Nessuna prenotazione trovata.</div>');
        $("#loadMoreBookingsButton").addClass("d-none");
        return;
    }

    const html = bookings.map(function (booking) {
        return `
            <article class="booking-card">
                <div class="booking-card-header">
                    <div>
                        <h3 class="h5 mb-2">${booking.service_name}</h3>
                        <p class="mb-1">Con: ${booking.sitter_first_name} ${booking.sitter_last_name}</p>
                        <p class="mb-1">Animale: ${booking.pet_name} (${petTypeLabel(booking.pet_type)})</p>
                        <p class="mb-1">Dal ${formatDateTime(booking.starts_at)} al ${formatDateTime(booking.ends_at)}</p>
                        <p class="mb-1">Totale: ${formatMoney(booking.total_price)}</p>
                        <p class="mb-0">Pagamento: ${paymentMethodText(booking.payment_method)}</p>
                    </div>
                    <span class="booking-status ${bookingStateClass(booking)}">${bookingStateText(booking)}</span>
                </div>

                ${booking.provider_reference ? `<p class="text-muted mt-2 mb-0">Riferimento: ${booking.provider_reference}</p>` : ""}
                ${booking.notes ? `<p class="text-muted mt-2 mb-0">Note: ${booking.notes}</p>` : ""}
                ${renderPaymentForm(booking)}
                ${renderReviewForm(booking)}

                <div class="d-flex flex-wrap gap-2 mt-3">
                    ${canCancelBooking(booking) ? `
                        <button class="btn btn-outline-secondary btn-sm cancel-booking-button" type="button" data-id="${booking.id}">
                            Annulla
                        </button>
                    ` : ""}
                    <button class="btn btn-outline-secondary btn-sm toggle-messages-button position-relative" type="button" data-id="${booking.id}">
                        Messaggi
                        ${renderUnreadMessagesBadge(booking)}
                    </button>
                </div>

                <div class="booking-message-box d-none" id="messages-${booking.id}">
                    <div class="booking-messages-list mb-3"></div>
                    <div class="input-group">
                        <input class="form-control message-input" type="text" placeholder="Scrivi un messaggio">
                        <button class="btn btn-primary send-message-button" type="button" data-id="${booking.id}">
                            Invia
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join("");

    $("#bookingsList").append(html);
    $("#loadMoreBookingsButton").toggleClass("d-none", !bookingsHasMore);
}

function loadBookings(append = false) {
    if (!append) {
        bookingsOffset = 0;
        $("#bookingsList").html('<div class="empty-state">Caricamento prenotazioni...</div>');
    }

    clearBookingsMessage();
    const period = $("#bookingPeriod").val() || "future";

    $.ajax({
        url: `${API_BASE_URL}/bookings?period=${period}&limit=${BOOKINGS_LIMIT}&offset=${bookingsOffset}`,
        method: "GET",
        headers: authHeaders(),
        success: function (response) {
            const bookings = response.bookings || [];
            bookingsHasMore = bookings.length === BOOKINGS_LIMIT;
            bookingsOffset += bookings.length;
            renderBookings(bookings, append);
        },
        error: function () {
            $("#bookingsList").html('<div class="empty-state text-danger">Errore durante il caricamento delle prenotazioni.</div>');
        }
    });
}

function cancelBooking(bookingId) {
    $.ajax({
        url: `${API_BASE_URL}/bookings/${bookingId}/cancel`,
        method: "PATCH",
        headers: authHeaders(),
        success: function () {
            loadBookings();
            loadNotifications();
        },
        error: function () {
            showBookingsMessage("danger", "Non è stato possibile annullare la prenotazione.");
        }
    });
}

function payBooking(bookingId, method) {
    $.ajax({
        url: `${API_BASE_URL}/bookings/${bookingId}/payments`,
        method: "POST",
        headers: authHeaders(),
        contentType: "application/json",
        data: JSON.stringify({ method }),
        success: function () {
            loadBookings();
            loadNotifications();
        },
        error: function (xhr) {
            const message = xhr.responseJSON && xhr.responseJSON.error
                ? xhr.responseJSON.error
                : "Pagamento non completato.";
            showBookingsMessage("danger", message);
        }
    });
}

function sendReview(bookingId, form) {
    const reviewId = form.data("review-id");
    const editing = Boolean(reviewId);

    $.ajax({
        url: editing
            ? `${API_BASE_URL}/reviews/${reviewId}`
            : `${API_BASE_URL}/bookings/${bookingId}/reviews`,
        method: editing ? "PUT" : "POST",
        headers: authHeaders(),
        contentType: "application/json",
        data: JSON.stringify({
            rating: form.find(".review-rating").val(),
            comment: form.find(".review-comment").val().trim()
        }),
        success: function () {
            showBookingsMessage(
                "success",
                editing ? "Recensione modificata correttamente." : "Recensione inviata correttamente."
            );
            loadBookings();
        },
        error: function (xhr) {
            const message = xhr.responseJSON && xhr.responseJSON.error
                ? xhr.responseJSON.error
                : "Non è stato possibile inviare la recensione.";
            showBookingsMessage("danger", message);
        }
    });
}

function renderMessages(container, messages) {
    if (!messages.length) {
        container.html('<div class="empty-state">Nessun messaggio.</div>');
        return;
    }

    container.html(messages.map(function (message) {
        return `
            <div class="booking-message-item">
                <strong>${message.sender_first_name} ${message.sender_last_name}</strong>
                <p class="mb-0">${message.body}</p>
            </div>
        `;
    }).join(""));
}

function loadMessages(bookingId) {
    const box = $(`#messages-${bookingId}`);
    const list = box.find(".booking-messages-list");

    list.html('<div class="empty-state">Caricamento messaggi...</div>');

    $.ajax({
        url: `${API_BASE_URL}/bookings/${bookingId}/messages`,
        method: "GET",
        headers: authHeaders(),
        success: function (response) {
            renderMessages(list, response.messages || []);
            $(`#message-count-${bookingId}`).addClass("d-none").text("0");
        },
        error: function () {
            list.html('<div class="empty-state text-danger">Errore durante il caricamento dei messaggi.</div>');
        }
    });
}

function sendMessage(bookingId, input) {
    const body = input.val().trim();

    if (!body) {
        return;
    }

    $.ajax({
        url: `${API_BASE_URL}/bookings/${bookingId}/messages`,
        method: "POST",
        headers: authHeaders(),
        contentType: "application/json",
        data: JSON.stringify({ body }),
        success: function () {
            input.val("");
            loadMessages(bookingId);
        },
        error: function () {
            showBookingsMessage("danger", "Non è stato possibile inviare il messaggio.");
        }
    });
}

function renderNotifications(notifications, append) {
    if (!append) {
        $("#ownerNotificationsList").html("");
    }

    if (!notifications.length && !append) {
        $("#ownerNotificationsList").html('<div class="empty-state">Nessuna notifica.</div>');
        $("#loadMoreNotificationsButton").addClass("d-none");
        return;
    }

    const html = notifications.map(function (notification) {
        return `
            <article class="notification-item ${notification.is_read ? "" : "notification-unread"}">
                <div>
                    <strong>${notification.title}</strong>
                    <p class="mb-1">${notification.body}</p>
                    <small class="text-muted">${formatDateTime(notification.created_at)}</small>
                </div>
                <div class="d-flex gap-2 mt-2">
                    ${notification.is_read ? "" : `
                        <button class="btn btn-outline-primary btn-sm read-notification-button" type="button" data-id="${notification.id}">
                            Segna come letta
                        </button>
                    `}
                    <button class="btn btn-outline-danger btn-sm delete-notification-button" type="button" data-id="${notification.id}">
                        Elimina
                    </button>
                </div>
            </article>
        `;
    }).join("");

    $("#ownerNotificationsList").append(html);
    $("#loadMoreNotificationsButton").toggleClass("d-none", !notificationsHasMore);
}

function updateNotificationsControls(unreadCount, totalCount) {
    $("#ownerNotificationsBadge")
        .toggleClass("d-none", unreadCount === 0)
        .text(unreadCount);

    $("#markAllNotificationsReadButton").toggleClass("d-none", unreadCount === 0);
    $("#deleteAllNotificationsButton").toggleClass("d-none", totalCount === 0);
}

function loadNotifications(append = false) {
    if (!append) {
        notificationsOffset = 0;
    }

    $.ajax({
        url: `${API_BASE_URL}/notifications?limit=${NOTIFICATIONS_LIMIT}&offset=${notificationsOffset}`,
        method: "GET",
        headers: authHeaders(),
        success: function (response) {
            const notifications = response.notifications || [];
            notificationsHasMore = notifications.length === NOTIFICATIONS_LIMIT;
            notificationsOffset += notifications.length;

            updateNotificationsControls(response.unreadCount || 0, notificationsOffset);
            renderNotifications(notifications, append);
        },
        error: function () {
            $("#ownerNotificationsList").html('<div class="empty-state text-danger">Errore durante il caricamento delle notifiche.</div>');
        }
    });
}

function markNotificationAsRead(notificationId) {
    $.ajax({
        url: `${API_BASE_URL}/notifications/${notificationId}/read`,
        method: "PATCH",
        headers: authHeaders(),
        success: function () {
            loadNotifications();
        }
    });
}

function markAllNotificationsAsRead() {
    $.ajax({
        url: `${API_BASE_URL}/notifications/read-all`,
        method: "PATCH",
        headers: authHeaders(),
        success: function () {
            loadNotifications();
        }
    });
}

function deleteNotification(notificationId) {
    $.ajax({
        url: `${API_BASE_URL}/notifications/${notificationId}`,
        method: "DELETE",
        headers: authHeaders(),
        success: function () {
            loadNotifications();
        }
    });
}

function deleteAllNotifications() {
    $.ajax({
        url: `${API_BASE_URL}/notifications`,
        method: "DELETE",
        headers: authHeaders(),
        success: function () {
            loadNotifications();
        }
    });
}

$(document).ready(function () {
    if (!guardOwnerDashboard()) {
        return;
    }

    loadPets();
    loadBookings();
    loadNotifications();

    $("#refreshPetsButton").on("click", loadPets);

    $("#bookingPeriod").on("change", function () {
        loadBookings();
    });

    $("#loadMoreBookingsButton").on("click", function () {
        loadBookings(true);
    });

    $("#petForm").on("submit", savePet);
    $("#cancelEditPetButton").on("click", resetPetForm);

    $("#petsList").on("click", ".edit-pet-button", function () {
        startPetEdit($(this).data("id"));
    });

    $("#petsList").on("click", ".delete-pet-button", function () {
        deletePet($(this).data("id"));
    });

    $("#bookingsList").on("click", ".cancel-booking-button", function () {
        cancelBooking($(this).data("id"));
    });

    $("#bookingsList").on("click", ".toggle-messages-button", function () {
        const bookingId = $(this).data("id");
        const box = $(`#messages-${bookingId}`);

        box.toggleClass("d-none");

        if (!box.hasClass("d-none")) {
            loadMessages(bookingId);
        }
    });

    $("#bookingsList").on("click", ".send-message-button", function () {
        const bookingId = $(this).data("id");
        const input = $(`#messages-${bookingId}`).find(".message-input");
        sendMessage(bookingId, input);
    });

    $("#bookingsList").on("submit", ".payment-form", function (event) {
        event.preventDefault();
        const bookingId = $(this).data("id");
        const method = $(this).find(".payment-method").val();
        payBooking(bookingId, method);
    });

    $("#bookingsList").on("submit", ".review-form", function (event) {
        event.preventDefault();
        sendReview($(this).data("id"), $(this));
    });

    $("#loadMoreNotificationsButton").on("click", function () {
        loadNotifications(true);
    });

    $("#markAllNotificationsReadButton").on("click", markAllNotificationsAsRead);
    $("#deleteAllNotificationsButton").on("click", deleteAllNotifications);

    $("#ownerNotificationsList").on("click", ".read-notification-button", function () {
        markNotificationAsRead($(this).data("id"));
    });

    $("#ownerNotificationsList").on("click", ".delete-notification-button", function () {
        deleteNotification($(this).data("id"));
    });
});
